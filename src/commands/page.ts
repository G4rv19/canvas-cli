import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { listPages, getPage } from '../api/pages.js';
import { outputResult } from '../formatters/json.js';
import { printTable } from '../formatters/table.js';
import { stripHtml } from '../utils/html.js';
import { handleError } from '../utils/error.js';

export function registerPageCommand(program: Command): void {
  const cmd = program
    .command('pages')
    .description('List or view pages in a course')
    .argument('<courseId>', 'Course ID', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (courseId: number, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching pages...').start();
        const pages = await listPages(client, courseId);
        spinner.stop();

        outputResult(
          pages,
          (data) => {
            if (data.length === 0) {
              console.log('No pages found.');
              return;
            }
            printTable(
              ['Title', 'URL Slug'],
              data.map((p) => [p.title, p.url])
            );
            console.log(chalk.dim('\nUse `canvas pages view <courseId> <slug>` to read a page.'));
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('view')
    .description('View a page\'s content')
    .argument('<courseId>', 'Course ID', parseInt)
    .argument('<slug>', 'Page URL slug')
    .option('--json', 'Output as JSON')
    .action(async (courseId: number, slug: string, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching page...').start();
        const page = await getPage(client, courseId, slug);
        spinner.stop();

        outputResult(
          page,
          (p) => {
            console.log();
            console.log(chalk.bold.underline(p.title));
            console.log();
            console.log(stripHtml(p.body));
            console.log();
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });
}
