import { Command } from 'commander';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { listCourses } from '../api/courses.js';
import { outputResult } from '../formatters/json.js';
import { printTable } from '../formatters/table.js';
import { handleError } from '../utils/error.js';

export function registerCoursesCommand(program: Command): void {
  program
    .command('courses')
    .description('List your enrolled courses')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching courses...').start();
        const courses = await listCourses(client);
        spinner.stop();

        outputResult(
          courses,
          (data) => {
            if (data.length === 0) {
              console.log('No active courses found.');
              return;
            }
            printTable(
              ['ID', 'Name', 'Code', 'Term'],
              data.map((c) => [
                String(c.id),
                c.name,
                c.course_code,
                c.term?.name || 'N/A',
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
