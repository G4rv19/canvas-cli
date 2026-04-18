import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { listConversations, getConversation } from '../api/conversations.js';
import { outputResult } from '../formatters/json.js';
import { printTable } from '../formatters/table.js';
import { formatDate } from '../formatters/date.js';
import { stripHtml } from '../utils/html.js';
import { handleError } from '../utils/error.js';

export function registerInboxCommand(program: Command): void {
  const cmd = program
    .command('inbox')
    .description('View your Canvas inbox / conversations')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching inbox...').start();
        const conversations = await listConversations(client);
        spinner.stop();

        outputResult(
          conversations,
          (data) => {
            if (data.length === 0) {
              console.log('Inbox is empty.');
              return;
            }
            printTable(
              ['ID', 'Subject', 'Participants', 'Last Message', 'Date'],
              data.map((c) => [
                String(c.id),
                c.subject || '(no subject)',
                c.participants.map((p) => p.name).join(', '),
                (c.last_message || '').substring(0, 50) + (c.last_message?.length > 50 ? '...' : ''),
                formatDate(c.last_message_at),
              ])
            );
            console.log(chalk.dim('\nUse `canvas inbox view <id>` to read a conversation.'));
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });

  cmd
    .command('view')
    .description('Read a conversation')
    .argument('<id>', 'Conversation ID', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (id: number, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching conversation...').start();
        const convo = await getConversation(client, id);
        spinner.stop();

        const participantMap = new Map(convo.participants.map((p) => [p.id, p.name]));

        outputResult(
          convo,
          (data) => {
            console.log();
            console.log(chalk.bold.underline(data.subject || '(no subject)'));
            console.log(
              chalk.dim(
                'Participants: ' + data.participants.map((p) => p.name).join(', ')
              )
            );
            console.log();

            for (const msg of data.messages.reverse()) {
              const author = participantMap.get(msg.author_id) || 'Unknown';
              console.log(
                chalk.bold(author) + chalk.dim(' — ' + formatDate(msg.created_at))
              );
              console.log(stripHtml(msg.body));
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
