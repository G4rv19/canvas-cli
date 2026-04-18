import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { listTodoItems, listUpcomingEvents } from '../api/todo.js';
import { outputResult } from '../formatters/json.js';
import { printTable } from '../formatters/table.js';
import { formatDate, formatRelativeDate, isOverdue } from '../formatters/date.js';
import { handleError } from '../utils/error.js';

interface MergedItem {
  type: string;
  title: string;
  course: string;
  dueAt: string | null;
  url: string;
}

export function registerTodoCommand(program: Command): void {
  program
    .command('todo')
    .description('Show your todo and upcoming items')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching todo items...').start();

        const [todos, upcoming] = await Promise.all([
          listTodoItems(client),
          listUpcomingEvents(client),
        ]);
        spinner.stop();

        const merged: MergedItem[] = [];

        for (const t of todos) {
          merged.push({
            type: 'Todo',
            title: t.assignment?.name || 'Unknown',
            course: `course_${t.course_id}`,
            dueAt: t.assignment?.due_at || null,
            url: t.html_url,
          });
        }

        for (const e of upcoming) {
          merged.push({
            type: e.type === 'assignment' ? 'Assignment' : 'Event',
            title: e.title,
            course: e.context_code,
            dueAt: e.start_at || (e.assignment?.due_at ?? null),
            url: e.html_url,
          });
        }

        // Deduplicate by title + date
        const seen = new Set<string>();
        const unique = merged.filter((item) => {
          const key = `${item.title}|${item.dueAt}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Sort by due date
        unique.sort((a, b) => {
          if (!a.dueAt && !b.dueAt) return 0;
          if (!a.dueAt) return 1;
          if (!b.dueAt) return -1;
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        });

        if (options.json) {
          outputResult(unique, () => {}, true);
          return;
        }

        if (unique.length === 0) {
          console.log(chalk.green('Nothing due! You\'re all caught up.'));
          return;
        }

        printTable(
          ['Type', 'Title', 'Due', 'Relative', 'Course'],
          unique.map((item) => {
            const due = formatDate(item.dueAt);
            const rel = formatRelativeDate(item.dueAt);
            const coloredDue = item.dueAt && isOverdue(item.dueAt) ? chalk.red(due) : due;
            const coloredRel = item.dueAt && isOverdue(item.dueAt) ? chalk.red(rel) : chalk.yellow(rel);
            return [item.type, item.title, coloredDue, coloredRel, item.course];
          })
        );
      } catch (err) {
        handleError(err);
      }
    });
}
