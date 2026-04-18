import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { createDecipheriv, pbkdf2Sync } from 'node:crypto';

interface BrowserInfo {
  name: string;
  cookiePath: string;
  keychainService: string;
  keychainAccount: string;
}

const BROWSERS: BrowserInfo[] = [
  {
    name: 'Dia',
    cookiePath: 'Dia/User Data/Default/Cookies',
    keychainService: 'Dia Safe Storage',
    keychainAccount: 'Dia',
  },
  {
    name: 'Chrome',
    cookiePath: 'Google/Chrome/Default/Cookies',
    keychainService: 'Chrome Safe Storage',
    keychainAccount: 'Chrome',
  },
  {
    name: 'Arc',
    cookiePath: 'Arc/User Data/Default/Cookies',
    keychainService: 'Arc Safe Storage',
    keychainAccount: 'Arc',
  },
  {
    name: 'Edge',
    cookiePath: 'Microsoft Edge/Default/Cookies',
    keychainService: 'Microsoft Edge Safe Storage',
    keychainAccount: 'Microsoft Edge',
  },
  {
    name: 'Brave',
    cookiePath: 'BraveSoftware/Brave-Browser/Default/Cookies',
    keychainService: 'Brave Safe Storage',
    keychainAccount: 'Brave',
  },
  {
    name: 'Chromium',
    cookiePath: 'Chromium/Default/Cookies',
    keychainService: 'Chromium Safe Storage',
    keychainAccount: 'Chromium',
  },
];

function getAppSupportDir(): string {
  return join(homedir(), 'Library', 'Application Support');
}

export function detectBrowsers(): BrowserInfo[] {
  const appSupport = getAppSupportDir();
  return BROWSERS.filter((b) => existsSync(join(appSupport, b.cookiePath)));
}

function getEncryptionKey(browser: BrowserInfo): Buffer {
  const password = execSync(
    `security find-generic-password -w -s "${browser.keychainService}" -a "${browser.keychainAccount}"`,
    { encoding: 'utf-8' }
  ).trim();

  return pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
}

function decryptValue(encrypted: Buffer, key: Buffer): string {
  // Chrome on macOS prefixes encrypted values with "v10" (3 bytes)
  const prefix = encrypted.slice(0, 3).toString('ascii');
  if (prefix !== 'v10') {
    // Not encrypted or unknown format, return as-is
    return encrypted.toString('utf-8');
  }

  const ciphertext = encrypted.slice(3);
  const iv = Buffer.alloc(16, 0x20); // 16 spaces
  const decipher = createDecipheriv('aes-128-cbc', key, iv);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  // Cookie values may contain non-ASCII bytes — encode them so they're safe for HTTP headers
  const raw = decrypted.toString('latin1');
  return raw;
}

interface RawCookie {
  name: string;
  encryptedHex: string;
  path: string;
}

function queryCookies(dbPath: string, domain: string): RawCookie[] {
  // Copy db + WAL files to temp dir to avoid lock issues
  const tmpDir = mkdtempSync(join(tmpdir(), 'canvas-cli-'));
  const tmpDb = join(tmpDir, 'Cookies');
  copyFileSync(dbPath, tmpDb);

  // Also copy WAL and SHM files if they exist
  for (const suffix of ['-wal', '-shm']) {
    const src = dbPath + suffix;
    if (existsSync(src)) {
      copyFileSync(src, tmpDb + suffix);
    }
  }

  try {
    // Query cookies for the domain using sqlite3 (built into macOS)
    const query = `SELECT name, hex(encrypted_value), path FROM cookies WHERE host_key = '.${domain}' OR host_key = '${domain}' ORDER BY name;`;
    const result = execSync(`sqlite3 -separator '|||' "${tmpDb}" "${query}"`, {
      encoding: 'utf-8',
    }).trim();

    if (!result) return [];

    return result.split('\n').map((line) => {
      const [name, encryptedHex, path] = line.split('|||');
      return { name, encryptedHex, path };
    });
  } finally {
    // Clean up temp files
    try {
      unlinkSync(tmpDb);
      for (const suffix of ['-wal', '-shm']) {
        const f = tmpDb + suffix;
        if (existsSync(f)) unlinkSync(f);
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

export function extractCookiesFromBrowser(
  browser: BrowserInfo,
  domain: string
): { cookie: string; csrfToken: string } {
  const appSupport = getAppSupportDir();
  const dbPath = join(appSupport, browser.cookiePath);

  const key = getEncryptionKey(browser);
  const rawCookies = queryCookies(dbPath, domain);

  if (rawCookies.length === 0) {
    throw new Error(
      `No cookies found for ${domain} in ${browser.name}. Make sure you're logged into Canvas in ${browser.name}.`
    );
  }

  const cookiePairs: string[] = [];
  let csrfToken = '';

  for (const raw of rawCookies) {
    const encryptedBuf = Buffer.from(raw.encryptedHex, 'hex');
    let value: string;

    if (encryptedBuf.length === 0) {
      continue;
    }

    try {
      value = decryptValue(encryptedBuf, key);
    } catch {
      continue; // Skip cookies we can't decrypt
    }

    cookiePairs.push(`${raw.name}=${value}`);

    if (raw.name === '_csrf_token') {
      csrfToken = value;
    }
  }

  if (!csrfToken) {
    throw new Error(
      `No _csrf_token found for ${domain} in ${browser.name}. Your session may have expired — log into Canvas in your browser and try again.`
    );
  }

  return { cookie: cookiePairs.join('; '), csrfToken };
}
