import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { stripHtml } from '../utils/html.js';
import { handleError } from '../utils/error.js';
import type { CanvasPage } from '../api/pages.js';

export function registerSearchCommand(program: Command): void {
  program
    .command('search')
    .description('Search page content in a course')
    .argument('<courseId>', 'Course ID', parseInt)
    .argument('<query>', 'Search query')
    .option('--json', 'Output as JSON')
    .action(async (courseId: number, query: string, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora(`Searching for "${query}"...`).start();

        // Search pages (may be disabled on some Canvas instances)
        let pages: CanvasPage[] = [];
        try {
          pages = await client.fetchAll<CanvasPage>(`/courses/${courseId}/pages`, {
            search_term: query,
          });
        } catch {
          // Pages API disabled, skip
        }

        // Also search assignments
        const assignments = await client.fetchAll<{ id: number; name: string; description: string | null; html_url: string }>(
          `/courses/${courseId}/assignments`,
          { search_term: query }
        );

        // Also search announcements
        const announcements = await client.fetchAll<{ id: number; title: string; message: string; posted_at: string }>(
          '/announcements',
          { 'context_codes[]': [`course_${courseId}`], search_term: query }
        );

        spinner.stop();

        if (options.json) {
          console.log(JSON.stringify({ pages, assignments, announcements }, null, 2));
          return;
        }

        const totalResults = pages.length + assignments.length + announcements.length;

        if (totalResults === 0) {
          console.log(`No results for "${query}".`);
          return;
        }

        console.log(chalk.bold(`\nFound ${totalResults} results for "${query}":\n`));

        if (pages.length > 0) {
          console.log(chalk.bold.cyan('Pages:'));
          for (const p of pages) {
            console.log(`  ${chalk.bold(p.title)}`);
            console.log(`  ${chalk.dim('slug: ' + p.url)}`);
            // Show snippet with query highlighted
            if (p.body) {
              const text = stripHtml(p.body);
              const idx = text.toLowerCase().indexOf(query.toLowerCase());
              if (idx >= 0) {
                const start = Math.max(0, idx - 60);
                const end = Math.min(text.length, idx + query.length + 60);
                let snippet = text.substring(start, end).replace(/\n/g, ' ');
                if (start > 0) snippet = '...' + snippet;
                if (end < text.length) snippet = snippet + '...';
                console.log(`  ${chalk.dim(snippet)}`);
              }
            }
            console.log();
          }
        }

        if (assignments.length > 0) {
          console.log(chalk.bold.cyan('Assignments:'));
          for (const a of assignments) {
            console.log(`  ${chalk.bold(a.name)} ${chalk.dim('(ID: ' + a.id + ')')}`);
          }
          console.log();
        }

        if (announcements.length > 0) {
          console.log(chalk.bold.cyan('Announcements:'));
          for (const a of announcements) {
            console.log(`  ${chalk.bold(a.title)} ${chalk.dim('(' + a.posted_at + ')')}`);
          }
          console.log();
        }
      } catch (err) {
        handleError(err);
      }
    });
}
