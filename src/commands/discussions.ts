import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { listDiscussions, getDiscussionEntries } from '../api/discussions.js';
import { outputResult } from '../formatters/json.js';
import { printTable } from '../formatters/table.js';
import { formatDate } from '../formatters/date.js';
import { stripHtml } from '../utils/html.js';
import { handleError } from '../utils/error.js';

export function registerDiscussionsCommand(program: Command): void {
  const cmd = program
    .command('discussions')
    .description('View discussion topics in a course')
    .argument('<courseId>', 'Course ID', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (courseId: number, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching discussions...').start();
        const topics = await listDiscussions(client, courseId);
        spinner.stop();

        outputResult(
          topics,
          (data) => {
            if (data.length === 0) {
              console.log('No discussions found.');
              return;
            }
            printTable(
              ['ID', 'Title', 'Author', 'Replies', 'Unread', 'Posted'],
              data.map((t) => [
                String(t.id),
                t.title,
                t.author?.display_name || '-',
                String(t.discussion_subentry_count),
                t.unread_count > 0 ? chalk.yellow(String(t.unread_count)) : '0',
                formatDate(t.posted_at),
              ])
            );
            console.log(
              chalk.dim('\nUse `canvas discussions view <courseId> <topicId>` to read replies.')
            );
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('view')
    .description('View discussion topic and replies')
    .argument('<courseId>', 'Course ID', parseInt)
    .argument('<topicId>', 'Discussion topic ID', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (courseId: number, topicId: number, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching discussion...').start();

        const [topics, entries] = await Promise.all([
          listDiscussions(client, courseId),
          getDiscussionEntries(client, courseId, topicId),
        ]);

        const topic = topics.find((t) => t.id === topicId);
        spinner.stop();

        outputResult(
          { topic, entries },
          (data) => {
            if (data.topic) {
              console.log();
              console.log(chalk.bold.underline(data.topic.title));
              console.log(
                chalk.dim(
                  `by ${data.topic.author?.display_name || 'Unknown'} — ${formatDate(data.topic.posted_at)}`
                )
              );
              console.log();
              console.log(stripHtml(data.topic.message));
              console.log();
            }

            if (data.entries.length === 0) {
              console.log(chalk.dim('No replies.'));
              return;
            }

            console.log(chalk.bold.cyan(`Replies (${data.entries.length}):`));
            console.log();

            for (const entry of data.entries) {
              console.log(
                `  ${chalk.bold(entry.user_name)} — ${formatDate(entry.created_at)}`
              );
              console.log(`  ${stripHtml(entry.message)}`);
              if (entry.replies) {
                for (const reply of entry.replies) {
                  console.log(
                    `    ${chalk.bold(reply.user_name)} — ${formatDate(reply.created_at)}`
                  );
                  console.log(`    ${stripHtml(reply.message)}`);
                }
              }
              console.log();
            }
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });
}
