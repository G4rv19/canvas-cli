import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { listAssignments, getAssignment } from '../api/assignments.js';
import { outputResult } from '../formatters/json.js';
import { printTable } from '../formatters/table.js';
import { formatDate, isOverdue } from '../formatters/date.js';
import { stripHtml } from '../utils/html.js';
import { handleError } from '../utils/error.js';
import type { Assignment } from '../types/canvas.js';

function getStatus(a: Assignment): string {
  const sub = a.submission;
  if (!sub) return 'N/A';
  if (sub.excused) return chalk.blue('Excused');
  if (sub.workflow_state === 'graded') return chalk.green('Graded');
  if (sub.workflow_state === 'submitted') return chalk.cyan('Submitted');
  if (sub.missing) return chalk.red('Missing');
  if (sub.late) return chalk.yellow('Late');
  if (a.due_at && isOverdue(a.due_at)) return chalk.red('Overdue');
  return chalk.dim('Not submitted');
}

function getScore(a: Assignment): string {
  const sub = a.submission;
  if (!sub || sub.score === null || sub.score === undefined) return '-';
  return `${sub.score}/${a.points_possible}`;
}

export function registerAssignmentsCommand(program: Command): void {
  const cmd = program
    .command('assignments')
    .description('List assignments for a course')
    .argument('<courseId>', 'Course ID', parseInt)
    .option('--bucket <type>', 'Filter: upcoming, overdue, past, undated, ungraded, unsubmitted')
    .option('--json', 'Output as JSON')
    .action(async (courseId: number, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching assignments...').start();
        const assignments = await listAssignments(client, courseId, options.bucket);
        spinner.stop();

        outputResult(
          assignments,
          (data) => {
            if (data.length === 0) {
              console.log('No assignments found.');
              return;
            }
            printTable(
              ['ID', 'Name', 'Due Date', 'Status', 'Score'],
              data.map((a) => {
                const due = a.due_at ? formatDate(a.due_at) : 'No due date';
                const coloredDue =
                  a.due_at && isOverdue(a.due_at) ? chalk.red(due) : due;
                return [String(a.id), a.name, coloredDue, getStatus(a), getScore(a)];
              })
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
    .description('View assignment details and instructions')
    .argument('<courseId>', 'Course ID', parseInt)
    .argument('<assignmentId>', 'Assignment ID', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (courseId: number, assignmentId: number, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching assignment...').start();
        const assignment = await getAssignment(client, courseId, assignmentId);
        spinner.stop();

        outputResult(
          assignment,
          (a) => {
            console.log();
            console.log(chalk.bold.underline(a.name));
            console.log();
            console.log(chalk.bold('Due:      ') + formatDate(a.due_at));
            console.log(chalk.bold('Points:   ') + a.points_possible);
            console.log(chalk.bold('Status:   ') + getStatus(a));
            console.log(chalk.bold('Score:    ') + getScore(a));
            console.log(chalk.bold('Types:    ') + a.submission_types.join(', '));
            console.log(chalk.bold('Link:     ') + a.html_url);
            console.log();
            if (a.description) {
              console.log(chalk.bold('Instructions:'));
              console.log(stripHtml(a.description));
            } else {
              console.log(chalk.dim('No instructions provided.'));
            }
            console.log();
          },
          options.json
        );
      } catch (err) {
        handleError(err);
      }
    });
}
