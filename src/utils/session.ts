import puppeteer from 'puppeteer-core';
import { loadBrowserEndpoint, clearBrowserEndpoint, saveConfig, loadConfig } from '../config/index.js';

/**
 * Try to refresh cookies from the background browser.
 * Returns true if cookies were refreshed, false if browser is gone.
 */
export async function refreshCookiesFromBrowser(): Promise<boolean> {
  const info = await loadBrowserEndpoint();
  if (!info) return false;

  try {
    const browser = await puppeteer.connect({ browserWSEndpoint: info.wsEndpoint });
    const pages = await browser.pages();
    const page = pages[0];
    if (!page) {
      browser.disconnect();
      return false;
    }

    // Grab current cookies for the Canvas domain
    const cookies = await page.cookies(`https://${info.domain}`);
    browser.disconnect();

    const csrfCookie = cookies.find((c) => c.name === '_csrf_token');
    if (!csrfCookie) return false;

    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const csrfToken = decodeURIComponent(csrfCookie.value);

    await saveConfig({
      domain: info.domain,
      auth: { type: 'cookie', cookie: cookieString, csrfToken },
    });

    return true;
  } catch {
    // Browser is gone, clean up
    await clearBrowserEndpoint();
    return false;
  }
}
