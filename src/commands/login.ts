import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import puppeteer from 'puppeteer-core';
import { saveConfig, getConfigPath, saveBrowserEndpoint, loadBrowserEndpoint, clearBrowserEndpoint } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { getProfile } from '../api/users.js';
import { existsSync } from 'node:fs';

const DEFAULT_DOMAIN = 'canvas.qut.edu.au';

function findBrowser(): { path: string; name: string } {
  const browsers = [
    { path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', name: 'Chrome' },
    { path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', name: 'Edge' },
    { path: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', name: 'Brave' },
    { path: '/Applications/Chromium.app/Contents/MacOS/Chromium', name: 'Chromium' },
  ];
  for (const b of browsers) {
    if (existsSync(b.path)) return b;
  }
  throw new Error('No supported browser found. Install Chrome, Edge, or Brave.');
}

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Log in via browser — keeps session alive in the background')
    .option('-d, --domain <domain>', 'Canvas domain', DEFAULT_DOMAIN)
    .action(async (options) => {
      const domain = options.domain;

      try {
        // Check if there's already a background browser running
        const existing = await loadBrowserEndpoint();
        if (existing) {
          try {
            const b = await puppeteer.connect({ browserWSEndpoint: existing.wsEndpoint });
            const pages = await b.pages();
            const page = pages[0];
            if (page) {
              const cookies = await page.cookies(`https://${domain}`);
              const csrf = cookies.find((c) => c.name === '_csrf_token');
              if (csrf) {
                const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
                const config = { domain, auth: { type: 'cookie' as const, cookie: cookieString, csrfToken: decodeURIComponent(csrf.value) } };
                const client = new CanvasClient(config);
                const profile = await getProfile(client);
                await saveConfig(config);
                b.disconnect();
                console.log(chalk.green(`\nAlready logged in as ${chalk.bold(profile.name)}. Session is active.\n`));
                return;
              }
            }
            b.disconnect();
          } catch {
            await clearBrowserEndpoint();
          }
        }

        const browser = findBrowser();
        console.log(chalk.dim(`\nOpening ${browser.name} — log in to Canvas normally.`));
        console.log(chalk.dim('After login, the browser will stay open in the background to keep your session alive.\n'));

        const b = await puppeteer.launch({
          headless: false,
          executablePath: browser.path,
          defaultViewport: null,
          args: ['--no-first-run', '--start-maximized'],
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
        });

        const page = (await b.pages())[0] || (await b.newPage());
        await page.goto(`https://${domain}`, { waitUntil: 'networkidle2' });

        const spinner = ora('Waiting for you to log in...').start();

        await page.waitForFunction(
          (d: string) =>
            window.location.hostname === d &&
            (window.location.pathname === '/' ||
              window.location.pathname.startsWith('/dashboard') ||
              window.location.pathname.startsWith('/courses')),
          { timeout: 300000 },
          domain
        );

        await new Promise((r) => setTimeout(r, 2000));
        spinner.text = 'Extracting cookies...';

        const cookies = await page.cookies();
        const csrfCookie = cookies.find((c) => c.name === '_csrf_token');
        if (!csrfCookie) {
          await b.close();
          throw new Error('Could not find _csrf_token cookie. Try again.');
        }

        const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
        const csrfToken = decodeURIComponent(csrfCookie.value);

        spinner.text = 'Validating session...';
        const config = { domain, auth: { type: 'cookie' as const, cookie: cookieString, csrfToken } };
        const client = new CanvasClient(config);
        const profile = await getProfile(client);

        spinner.succeed(`Authenticated as ${chalk.bold(profile.name)}`);

        // Save config and browser endpoint
        await saveConfig(config);
        await saveBrowserEndpoint(b.wsEndpoint(), domain);

        // Minimize the browser window and keep it running
        await page.evaluate(() => window.resizeTo(1, 1));

        // Disconnect without closing — browser stays alive in background
        b.disconnect();

        console.log(chalk.green(`Config saved to ${getConfigPath()}`));
        console.log(chalk.dim('Browser is running in the background — your session will stay alive.'));
        console.log(chalk.dim('Run `canvas logout` to close it.\n'));
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red('\n' + err.message));
        }
        process.exit(1);
      }
    });
}
