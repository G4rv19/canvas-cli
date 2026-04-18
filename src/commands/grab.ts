import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { loadBrowserEndpoint, getConfigDir } from '../config/index.js';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface FileLink {
  name: string;
  url: string;
  type: 'pdf' | 'docx' | 'pptx' | 'other';
}

async function connectBrowser(): Promise<{ browser: Browser; page: Page; domain: string }> {
  const info = await loadBrowserEndpoint();
  if (!info) {
    throw new Error('No background browser found. Run `canvas login` first.');
  }
  const browser = await puppeteer.connect({ browserWSEndpoint: info.wsEndpoint });
  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());
  return { browser, page, domain: info.domain };
}

async function extractFileLinks(page: Page, url: string): Promise<{ links: FileLink[]; pageText: string }> {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));

  const result = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const links: { name: string; url: string }[] = [];

    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      const text = a.textContent?.trim() || '';
      if (
        href.includes('/files/') ||
        href.match(/\.(pdf|docx|doc|pptx|ppt|xlsx|xls)(\?|$)/i)
      ) {
        links.push({ name: text || href.split('/').pop() || 'unknown', url: href });
      }
    }

    // Also grab embedded iframes (some Canvas pages embed files)
    const iframes = Array.from(document.querySelectorAll('iframe[src]'));
    for (const iframe of iframes) {
      const src = iframe.getAttribute('src') || '';
      if (src.includes('/files/') || src.match(/\.(pdf|docx)/i)) {
        links.push({ name: iframe.getAttribute('title') || 'embedded file', url: src });
      }
    }

    // Get page text content
    const content = document.querySelector('#content') || document.body;
    const pageText = content.textContent?.replace(/\s+/g, ' ').trim() || '';

    return { links, pageText };
  });

  const fileLinks: FileLink[] = result.links.map((l) => {
    let fullUrl = l.url;
    if (fullUrl.startsWith('/')) {
      fullUrl = `https://${page.url().split('/')[2]}${fullUrl}`;
    }
    // Check both URL and link text for file type
    const combined = `${fullUrl} ${l.name}`;
    const type = combined.match(/\.pdf(\?|$|\s)/i)
      ? 'pdf'
      : combined.match(/\.docx?(\?|$|\s)/i)
        ? 'docx'
        : combined.match(/\.pptx?(\?|$|\s)/i)
          ? 'pptx'
          : 'other';
    return { name: l.name, url: fullUrl, type: type as FileLink['type'] };
  });

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = fileLinks.filter((l) => {
    // Normalize: strip /download suffix and query params for dedup
    const key = l.url.replace(/\/download\b/, '').split('?')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { links: unique, pageText: result.pageText };
}

async function downloadFile(page: Page, url: string, downloadDir: string, name: string): Promise<string> {
  // Get cookies from browser to use with Node fetch
  const domain = new URL(page.url()).hostname;
  const cookies = await page.cookies(`https://${domain}`);
  const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  // Ensure the URL points to the download endpoint
  let downloadUrl = url;
  if (url.includes('/files/') && !url.includes('/download')) {
    downloadUrl = url.replace(/\?.*$/, '') + '/download';
  }

  // Follow redirects manually with cookies
  let currentUrl = downloadUrl;
  let response: Response | null = null;
  for (let i = 0; i < 10; i++) {
    response = await globalThis.fetch(currentUrl, {
      headers: { Cookie: cookieString },
      redirect: 'manual',
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) break;
      currentUrl = location.startsWith('/') ? `https://${domain}${location}` : location;
      continue;
    }
    break;
  }

  if (!response || !response.ok) {
    throw new Error(`HTTP ${response?.status || 'no response'}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
  const filePath = join(downloadDir, safeName);
  await writeFile(filePath, buffer);
  return filePath;
}

async function extractPdfText(filePath: string): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const buffer = await readFile(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  // @ts-expect-error load is marked private in types but is the public API
  await parser.load();
  const result = await parser.getText();
  parser.destroy();
  if (typeof result === 'string') return result;
  const obj = result as { text?: string; pages?: { text: string; num: number }[] };
  return obj.text || obj.pages?.map((p) => p.text).join('\n\n') || '';
}

async function extractPptxText(filePath: string): Promise<string> {
  // PPTX is a zip; extract text from slide XML files
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const exec = promisify(execFile);

  // Use unzip to list and extract slide content
  const tmpDir = join(filePath + '_extracted');
  await mkdir(tmpDir, { recursive: true });

  try {
    await exec('unzip', ['-o', '-q', filePath, 'ppt/slides/*.xml', '-d', tmpDir]);
  } catch {
    // Might partially extract, that's fine
  }

  const { readdirSync, readFileSync } = await import('node:fs');
  const slidesDir = join(tmpDir, 'ppt', 'slides');
  let text = '';

  try {
    const files = readdirSync(slidesDir).filter((f) => f.endsWith('.xml')).sort();
    for (const file of files) {
      const xml = readFileSync(join(slidesDir, file), 'utf-8');
      // Extract text between <a:t> tags
      const matches = xml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
      const slideText = matches.map((m) => m.replace(/<\/?a:t>/g, '')).join(' ');
      if (slideText.trim()) {
        text += `[Slide ${file.replace(/\D/g, '')}] ${slideText.trim()}\n\n`;
      }
    }
  } catch {
    text = '(Could not extract text from PPTX slides)';
  }

  // Cleanup
  await exec('rm', ['-rf', tmpDir]).catch(() => {});
  return text;
}

async function extractDocxText(filePath: string): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

export function registerGrabCommand(program: Command): void {
  program
    .command('grab')
    .description('Grab files (PDF, DOCX) from a Canvas page and extract their content')
    .argument('<url>', 'Canvas page URL (e.g. https://canvas.qut.edu.au/courses/25453/modules/items/2168609)')
    .option('--list', 'Just list file links, don\'t download')
    .option('--raw', 'Show raw extracted text instead of summary')
    .action(async (url: string, options) => {
      try {
        const spinner = ora('Connecting to browser...').start();
        const { browser, page, domain } = await connectBrowser();

        // Ensure URL is absolute
        if (!url.startsWith('http')) {
          url = `https://${domain}${url.startsWith('/') ? '' : '/'}${url}`;
        }

        spinner.text = 'Loading page and finding files...';
        const { links, pageText } = await extractFileLinks(page, url);

        if (links.length === 0) {
          spinner.info('No downloadable files found on this page.');
          if (pageText.length > 100) {
            console.log(chalk.dim('\nPage content preview:'));
            console.log(pageText.substring(0, 2000));
          }
          browser.disconnect();
          return;
        }

        spinner.succeed(`Found ${links.length} file(s)`);

        console.log();
        for (const link of links) {
          const icon = link.type === 'pdf' ? '📄' : link.type === 'docx' ? '📝' : '📎';
          console.log(`  ${icon} ${chalk.bold(link.name)} ${chalk.dim(`[${link.type}]`)}`);
        }
        console.log();

        if (options.list) {
          browser.disconnect();
          return;
        }

        // Download and extract
        const downloadDir = join(getConfigDir(), 'downloads');
        await mkdir(downloadDir, { recursive: true });

        const results: { name: string; type: string; text: string; path: string }[] = [];

        for (const link of links) {
          if (link.type !== 'pdf' && link.type !== 'docx' && link.type !== 'pptx') {
            console.log(chalk.dim(`  Skipping ${link.name} (${link.type} — not supported for text extraction)`));
            continue;
          }

          const dlSpinner = ora(`Downloading ${link.name}...`).start();
          try {
            const ext = link.type === 'pdf' ? '.pdf' : link.type === 'docx' ? '.docx' : '.pptx';
            const fileName = link.name.endsWith(ext) ? link.name : `${link.name}${ext}`;
            const filePath = await downloadFile(page, link.url, downloadDir, fileName);
            dlSpinner.text = `Extracting text from ${link.name}...`;

            let text = '';
            if (link.type === 'pdf') {
              text = await extractPdfText(filePath);
            } else if (link.type === 'docx') {
              text = await extractDocxText(filePath);
            } else if (link.type === 'pptx') {
              text = await extractPptxText(filePath);
            }

            results.push({ name: link.name, type: link.type, text, path: filePath });
            dlSpinner.succeed(`${link.name} — ${text.length} chars extracted`);
          } catch (err) {
            dlSpinner.fail(`Failed to process ${link.name}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        browser.disconnect();

        // Output results
        if (results.length > 0) {
          console.log(chalk.bold.green(`\n${'═'.repeat(60)}`));
          console.log(chalk.bold.green(' EXTRACTED CONTENT'));
          console.log(chalk.bold.green(`${'═'.repeat(60)}\n`));

          for (const r of results) {
            console.log(chalk.bold.cyan(`── ${r.name} ──`));
            console.log(chalk.dim(`   Saved to: ${r.path}\n`));
            if (options.raw) {
              console.log(r.text);
            } else {
              // Show first ~3000 chars as preview
              const preview = r.text.substring(0, 3000);
              console.log(preview);
              if (r.text.length > 3000) {
                console.log(chalk.dim(`\n... (${r.text.length - 3000} more characters — use --raw for full text)`));
              }
            }
            console.log();
          }

          // Also save a combined text file for easy access
          const combinedPath = join(downloadDir, 'last-grab.txt');
          const combinedText = results.map((r) => `=== ${r.name} ===\n\n${r.text}`).join('\n\n');
          await writeFile(combinedPath, combinedText, 'utf-8');
          console.log(chalk.dim(`Full text saved to: ${combinedPath}`));
        }
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red('\n' + err.message));
        }
        process.exit(1);
      }
    });
}
