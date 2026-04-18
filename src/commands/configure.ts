import { Command } from 'commander';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import chalk from 'chalk';
import ora from 'ora';
import { saveConfig, getConfigPath } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { getProfile } from '../api/users.js';

export function registerConfigureCommand(program: Command): void {
  program
    .command('configure')
    .description('Set up with an API token (if your uni allows it)')
    .action(async () => {
      console.log(chalk.bold('\nCanvas CLI Setup (API Token)\n'));
      console.log('You need two things:');
      console.log('  1. Your Canvas domain (e.g., canvas.qut.edu.au)');
      console.log('  2. An API access token\n');
      console.log(
        chalk.dim(
          'To generate a token: Canvas → Profile → Settings → Approved Integrations → + New Access Token'
        )
      );
      console.log(
        chalk.dim(
          'If your uni has disabled token generation, use `canvas login` instead.\n'
        )
      );

      const rl = readline.createInterface({ input: stdin, output: stdout });

      try {
        const domain = (await rl.question('Canvas domain: ')).trim();
        if (!domain) {
          console.error(chalk.red('Domain is required.'));
          process.exit(1);
        }

        const token = (await rl.question('API token: ')).trim();
        if (!token) {
          console.error(chalk.red('Token is required.'));
          process.exit(1);
        }

        rl.close();

        const config = { domain, auth: { type: 'token' as const, token } };
        const spinner = ora('Validating credentials...').start();
        try {
          const client = new CanvasClient(config);
          const profile = await getProfile(client);
          spinner.succeed(`Authenticated as ${chalk.bold(profile.name)}`);
        } catch {
          spinner.fail('Authentication failed. Check your domain and token.');
          process.exit(1);
        }

        await saveConfig(config);
        console.log(chalk.green(`\nConfig saved to ${getConfigPath()}`));
        console.log(chalk.dim('Run `canvas courses` to see your courses.\n'));
      } finally {
        rl.close();
      }
    });
}
