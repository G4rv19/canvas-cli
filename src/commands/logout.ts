import { Command } from 'commander';
import chalk from 'chalk';
import puppeteer from 'puppeteer-core';
import { loadBrowserEndpoint, clearBrowserEndpoint } from '../config/index.js';

export function registerLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('Close the background browser and end your session')
    .action(async () => {
      const info = await loadBrowserEndpoint();
      if (!info) {
        console.log(chalk.dim('No background browser running.'));
        return;
      }

      try {
        const browser = await puppeteer.connect({ browserWSEndpoint: info.wsEndpoint });
        await browser.close();
      } catch {
        // Already gone
      }

      await clearBrowserEndpoint();
      console.log(chalk.green('Logged out. Background browser closed.'));
    });
}
