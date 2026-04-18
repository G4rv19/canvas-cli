import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { listModules, listModuleItems } from '../api/modules.js';
import { outputResult } from '../formatters/json.js';
import { printTable } from '../formatters/table.js';
import { handleError } from '../utils/error.js';

export function registerModulesCommand(program: Command): void {
  const cmd = program
    .command('modules')
    .description('List modules in a course')
    .argument('<courseId>', 'Course ID', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (courseId: number, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching modules...').start();
        const modules = await listModules(client, courseId);
        spinner.stop();

        outputResult(
          modules,
          (data) => {
            if (data.length === 0) {
              console.log('No modules found.');
              return;
            }
            printTable(
              ['ID', 'Name', 'State', 'Items'],
              data.map((m) => [
                String(m.id),
                m.name,
                m.state === 'completed'
                  ? chalk.green(m.state)
                  : m.state === 'locked'
                    ? chalk.red(m.state)
                    : m.state,
                String(m.items_count),
              ])
            );
            console.log(chalk.dim('\nUse `canvas modules items <courseId> <moduleId>` to see items.'));
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('items')
    .description('List items in a module')
    .argument('<courseId>', 'Course ID', parseInt)
    .argument('<moduleId>', 'Module ID', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (courseId: number, moduleId: number, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching module items...').start();
        const items = await listModuleItems(client, courseId, moduleId);
        spinner.stop();

        outputResult(
          items,
          (data) => {
            if (data.length === 0) {
              console.log('No items found.');
              return;
            }
            printTable(
              ['#', 'Title', 'Type', 'Status', 'Link'],
              data.map((item) => {
                const indent = '  '.repeat(item.indent);
                const status = item.completion_requirement
                  ? item.completion_requirement.completed
                    ? chalk.green('Done')
                    : chalk.yellow('Pending')
                  : '-';
                return [
                  String(item.position),
                  indent + item.title,
                  item.type,
                  status,
                  item.html_url || '-',
                ];
              })
            );
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });
}
