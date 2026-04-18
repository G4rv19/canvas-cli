import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { listAnnouncements } from '../api/announcements.js';
import { listCourses } from '../api/courses.js';
import { outputResult } from '../formatters/json.js';
import { printTable } from '../formatters/table.js';
import { formatDate } from '../formatters/date.js';
import { stripHtml } from '../utils/html.js';
import { handleError } from '../utils/error.js';

export function registerAnnouncementsCommand(program: Command): void {
  program
    .command('announcements')
    .description('View announcements')
    .argument('[courseId]', 'Course ID (omit for all courses)', parseInt)
    .option('--days <n>', 'Show announcements from last N days', '14')
    .option('--json', 'Output as JSON')
    .action(async (courseId: number | undefined, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching announcements...').start();

        let contextCodes: string[];
        const courseMap = new Map<string, string>();

        if (courseId) {
          contextCodes = [`course_${courseId}`];
        } else {
          const courses = await listCourses(client);
          contextCodes = courses.map((c) => `course_${c.id}`);
          courses.forEach((c) => courseMap.set(`course_${c.id}`, c.course_code));
        }

        const days = parseInt(options.days, 10) || 14;
        const startDate = new Date(Date.now() - days * 86400000).toISOString();

        const announcements = await listAnnouncements(client, contextCodes, startDate);
        spinner.stop();

        outputResult(
          announcements,
          (data) => {
            if (data.length === 0) {
              console.log('No announcements found.');
              return;
            }

            // Sort by most recent first
            data.sort(
              (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
            );

            printTable(
              ['Date', 'Course', 'Title', 'Author'],
              data.map((a) => [
                formatDate(a.posted_at),
                courseMap.get(a.context_code) || a.context_code,
                a.title,
                a.author?.display_name || 'Unknown',
              ])
            );

            // Show the latest announcement body
            if (data.length > 0) {
              console.log();
              console.log(chalk.bold.underline(data[0].title));
              console.log(chalk.dim(`by ${data[0].author?.display_name || 'Unknown'} — ${formatDate(data[0].posted_at)}`));
              console.log();
              console.log(stripHtml(data[0].message));
              console.log();
              if (data.length > 1) {
                console.log(chalk.dim(`Showing latest announcement. ${data.length - 1} more available.`));
              }
            }
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });
}
