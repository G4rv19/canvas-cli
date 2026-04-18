import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { getSubmission } from '../api/submissions.js';
import { listAssignments } from '../api/assignments.js';
import { outputResult } from '../formatters/json.js';
import { printTable } from '../formatters/table.js';
import { formatDate } from '../formatters/date.js';
import { stripHtml } from '../utils/html.js';
import { handleError } from '../utils/error.js';

export function registerSubmissionsCommand(program: Command): void {
  const cmd = program
    .command('submissions')
    .description('View submission feedback and grades')
    .argument('<courseId>', 'Course ID', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (courseId: number, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching submissions...').start();

        const assignments = await listAssignments(client, courseId);
        const submitted = assignments.filter(
          (a) =>
            a.submission &&
            (a.submission.workflow_state === 'submitted' ||
              a.submission.workflow_state === 'graded')
        );

        spinner.stop();

        outputResult(
          submitted,
          (data) => {
            if (data.length === 0) {
              console.log('No submissions found.');
              return;
            }
            printTable(
              ['ID', 'Assignment', 'Status', 'Score', 'Submitted', 'Graded'],
              data.map((a) => {
                const s = a.submission!;
                const score =
                  s.score !== null && s.score !== undefined
                    ? `${s.score}/${a.points_possible}`
                    : '-';
                const status =
                  s.workflow_state === 'graded'
                    ? chalk.green('Graded')
                    : chalk.cyan('Submitted');
                return [
                  String(a.id),
                  a.name,
                  status,
                  score,
                  formatDate(s.submitted_at),
                  s.workflow_state === 'graded' ? 'Yes' : '-',
                ];
              })
            );
            console.log(
              chalk.dim(
                '\nUse `canvas submissions view <courseId> <assignmentId>` for feedback details.'
              )
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
    .description('View detailed feedback for a submission')
    .argument('<courseId>', 'Course ID', parseInt)
    .argument('<assignmentId>', 'Assignment ID', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (courseId: number, assignmentId: number, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching submission details...').start();

        const [assignment, submission] = await Promise.all([
          client.fetch<{ name: string; points_possible: number }>(
            `/courses/${courseId}/assignments/${assignmentId}`
          ),
          getSubmission(client, courseId, assignmentId),
        ]);

        spinner.stop();

        outputResult(
          { assignment, submission },
          (data) => {
            const s = data.submission;
            console.log();
            console.log(chalk.bold.underline(data.assignment.name));
            console.log();
            console.log(
              chalk.bold('Status:    ') +
                (s.workflow_state === 'graded' ? chalk.green('Graded') : s.workflow_state)
            );
            console.log(
              chalk.bold('Score:     ') +
                (s.score !== null ? `${s.score}/${data.assignment.points_possible}` : 'N/A')
            );
            console.log(chalk.bold('Grade:     ') + (s.grade ?? 'N/A'));
            console.log(chalk.bold('Submitted: ') + formatDate(s.submitted_at));
            console.log(chalk.bold('Graded at: ') + formatDate(s.graded_at));
            if (s.late) console.log(chalk.yellow('Late submission'));
            if (s.missing) console.log(chalk.red('Missing'));

            // Comments
            if (s.submission_comments && s.submission_comments.length > 0) {
              console.log();
              console.log(chalk.bold.cyan('Comments:'));
              for (const c of s.submission_comments) {
                console.log();
                console.log(
                  `  ${chalk.bold(c.author_name)} — ${formatDate(c.created_at)}`
                );
                console.log(`  ${stripHtml(c.comment)}`);
              }
            }

            // Rubric
            if (s.rubric_assessment) {
              console.log();
              console.log(chalk.bold.cyan('Rubric Assessment:'));
              for (const [key, rating] of Object.entries(s.rubric_assessment)) {
                if (rating.comments) {
                  console.log();
                  console.log(
                    `  ${chalk.bold(key)}: ${rating.points !== undefined ? rating.points + ' pts' : ''}`
                  );
                  console.log(`  ${rating.comments}`);
                }
              }
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
