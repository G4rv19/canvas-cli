import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { listCalendarEvents } from '../api/calendar.js';
import { listCourses } from '../api/courses.js';
import { outputResult } from '../formatters/json.js';
import { printTable } from '../formatters/table.js';
import { formatDate } from '../formatters/date.js';
import { handleError } from '../utils/error.js';

export function registerCalendarCommand(program: Command): void {
  program
    .command('calendar')
    .description('View calendar events')
    .option('--days <n>', 'Number of days to show (default: 14)', '14')
    .option('--start <date>', 'Start date (YYYY-MM-DD)')
    .option('--end <date>', 'End date (YYYY-MM-DD)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching calendar events...').start();

        const days = parseInt(options.days, 10) || 14;
        const startDate =
          options.start || new Date().toISOString().split('T')[0];
        const endDate =
          options.end ||
          new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

        const courses = await listCourses(client);
        const contextCodes = courses.map((c) => `course_${c.id}`);
        const courseMap = new Map(courses.map((c) => [`course_${c.id}`, c.course_code]));

        const events = await listCalendarEvents(client, startDate, endDate, contextCodes);
        spinner.stop();

        outputResult(
          events,
          (data) => {
            if (data.length === 0) {
              console.log('No calendar events found.');
              return;
            }
            printTable(
              ['Date', 'Title', 'Type', 'Course', 'Link'],
              data.map((e) => [
                formatDate(e.start_at),
                e.title,
                e.all_day ? 'All Day' : e.type || 'Event',
                courseMap.get(e.context_code) || e.context_code,
                e.html_url,
              ])
            );
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });
}
