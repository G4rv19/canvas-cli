import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { CanvasConfig } from '../types/config.js';

const CONFIG_DIR = join(homedir(), '.canvas-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const BROWSER_FILE = join(CONFIG_DIR, 'browser.json');

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export async function loadConfig(): Promise<CanvasConfig | null> {
  const envDomain = process.env.CANVAS_DOMAIN;
  const envToken = process.env.CANVAS_TOKEN;
  if (envDomain && envToken) {
    return { domain: envDomain, auth: { type: 'token', token: envToken } };
  }

  try {
    const raw = await readFile(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.token && !parsed.auth) {
      return { domain: parsed.domain, auth: { type: 'token', token: parsed.token } };
    }
    return parsed as CanvasConfig;
  } catch {
    return null;
  }
}

export async function saveConfig(config: CanvasConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export async function saveBrowserEndpoint(wsEndpoint: string, domain: string): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(BROWSER_FILE, JSON.stringify({ wsEndpoint, domain }) + '\n', 'utf-8');
}

export async function loadBrowserEndpoint(): Promise<{ wsEndpoint: string; domain: string } | null> {
  try {
    const raw = await readFile(BROWSER_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearBrowserEndpoint(): Promise<void> {
  try {
    await unlink(BROWSER_FILE);
  } catch {
    // ignore
  }
}

export async function ensureConfig(): Promise<CanvasConfig> {
  // Try refreshing cookies from background browser first
  const browserInfo = await loadBrowserEndpoint();
  if (browserInfo) {
    try {
      const { refreshCookiesFromBrowser } = await import('../utils/session.js');
      await refreshCookiesFromBrowser();
    } catch {
      // Browser gone, fall through to saved config
    }
  }

  const config = await loadConfig();
  if (!config) {
    throw new Error(
      'Canvas CLI is not configured. Run `canvas login` to set up.'
    );
  }
  return config;
}
