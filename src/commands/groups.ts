import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { listMyGroups, getGroupMembers, getGroupFiles } from '../api/groups.js';
import { outputResult } from '../formatters/json.js';
import { printTable } from '../formatters/table.js';
import { formatDate } from '../formatters/date.js';
import { handleError } from '../utils/error.js';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function registerGroupsCommand(program: Command): void {
  const cmd = program
    .command('groups')
    .description('List your Canvas groups')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching groups...').start();
        const groups = await listMyGroups(client);
        spinner.stop();

        outputResult(
          groups,
          (data) => {
            if (data.length === 0) {
              console.log('No groups found.');
              return;
            }
            printTable(
              ['ID', 'Name', 'Members', 'Course ID'],
              data.map((g) => [
                String(g.id),
                g.name,
                String(g.members_count),
                String(g.course_id),
              ])
            );
            console.log(
              chalk.dim('\nUse `canvas groups members <groupId>` or `canvas groups files <groupId>`.')
            );
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('members')
    .description('List members of a group')
    .argument('<groupId>', 'Group ID', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (groupId: number, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching members...').start();
        const members = await getGroupMembers(client, groupId);
        spinner.stop();

        outputResult(
          members,
          (data) => {
            if (data.length === 0) {
              console.log('No members found.');
              return;
            }
            printTable(
              ['Name', 'Login ID'],
              data.map((m) => [m.name, m.login_id || '-'])
            );
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('files')
    .description('List files in a group')
    .argument('<groupId>', 'Group ID', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (groupId: number, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching files...').start();
        const files = await getGroupFiles(client, groupId);
        spinner.stop();

        outputResult(
          files,
          (data) => {
            if (data.length === 0) {
              console.log('No files found.');
              return;
            }
            printTable(
              ['Name', 'Size', 'Updated'],
              data.map((f) => [f.display_name, formatSize(f.size), formatDate(f.updated_at)])
            );
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });
}
