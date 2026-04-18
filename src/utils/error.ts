import chalk from 'chalk';
import { CanvasApiError } from '../api/client.js';

export function handleError(err: unknown): never {
  if (err instanceof CanvasApiError) {
    if (err.status === 401 || (err.status === 302)) {
      console.error(chalk.red('\nSession expired or invalid.'));
      console.error(chalk.yellow('Run `canvas login` to re-authenticate.\n'));
    } else if (err.status === 403) {
      console.error(chalk.red('Access denied. You may not have permission for this resource.'));
    } else if (err.status === 404) {
      console.error(chalk.red('Not found. Check the ID and try again.'));
    } else {
      console.error(chalk.red(`Canvas API error (${err.status}): ${err.body}`));
    }
  } else if (err instanceof Error) {
    if (err.message.includes('not configured')) {
      console.error(chalk.red(err.message));
    } else {
      console.error(chalk.red(err.message));
    }
  } else {
    console.error(chalk.red('An unexpected error occurred.'));
  }
  process.exit(1);
}
