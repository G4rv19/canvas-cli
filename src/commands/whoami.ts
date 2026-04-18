import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { getProfile } from '../api/users.js';
import { outputResult } from '../formatters/json.js';
import { handleError } from '../utils/error.js';

export function registerWhoamiCommand(program: Command): void {
  program
    .command('whoami')
    .description('Show your Canvas profile')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching profile...').start();
        const profile = await getProfile(client);
        spinner.stop();

        outputResult(
          profile,
          (p) => {
            console.log();
            console.log(chalk.bold('  Name:    ') + p.name);
            console.log(chalk.bold('  Email:   ') + (p.email || 'N/A'));
            console.log(chalk.bold('  Login:   ') + p.login_id);
            if (p.bio) console.log(chalk.bold('  Bio:     ') + p.bio);
            console.log(chalk.bold('  Domain:  ') + config.domain);
            console.log();
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });
}
