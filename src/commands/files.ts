import { Command } from 'commander';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { listFiles } from '../api/files.js';
import { outputResult } from '../formatters/json.js';
import { printTable } from '../formatters/table.js';
import { formatDate } from '../formatters/date.js';
import { handleError } from '../utils/error.js';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function registerFilesCommand(program: Command): void {
  program
    .command('files')
    .description('List files in a course')
    .argument('<courseId>', 'Course ID', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (courseId: number, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching files...').start();
        const files = await listFiles(client, courseId);
        spinner.stop();

        outputResult(
          files,
          (data) => {
            if (data.length === 0) {
              console.log('No files found.');
              return;
            }
            printTable(
              ['ID', 'Name', 'Type', 'Size', 'Updated'],
              data.map((f) => [
                String(f.id),
                f.display_name,
                f.content_type,
                formatSize(f.size),
                formatDate(f.updated_at),
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
