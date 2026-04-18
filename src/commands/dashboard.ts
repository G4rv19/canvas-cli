import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { listCourses } from '../api/courses.js';
import { listTodoItems, listUpcomingEvents } from '../api/todo.js';
import { listAnnouncements } from '../api/announcements.js';
import { printTable } from '../formatters/table.js';
import { formatDate, formatRelativeDate, isOverdue } from '../formatters/date.js';
import { handleError } from '../utils/error.js';
import type { Assignment, Course } from '../types/canvas.js';

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .alias('dash')
    .description('Overview of everything — assignments, announcements, grades')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Loading dashboard...').start();

        // Fetch everything in parallel
        const [courses, todos, upcoming] = await Promise.all([
          listCourses(client),
          listTodoItems(client),
          listUpcomingEvents(client),
        ]);

        const courseMap = new Map<number, Course>(courses.map((c) => [c.id, c]));
        const courseCodeMap = new Map<string, string>(
          courses.map((c) => [`course_${c.id}`, c.course_code])
        );

        // Get announcements from last 7 days
        const contextCodes = courses.map((c) => `course_${c.id}`);
        const startDate = new Date(Date.now() - 7 * 86400000).toISOString();
        const announcements = await listAnnouncements(client, contextCodes, startDate);

        // Get upcoming assignments across all courses
        spinner.text = 'Fetching assignments...';
        const allAssignments: (Assignment & { _courseName: string })[] = [];
        for (const course of courses) {
          try {
            const assignments = await client.fetchAll<Assignment>(
              `/courses/${course.id}/assignments`,
              { 'include[]': ['submission'], order_by: 'due_at', bucket: 'upcoming' }
            );
            for (const a of assignments) {
              (a as any)._courseName = course.course_code;
              allAssignments.push(a as Assignment & { _courseName: string });
            }
          } catch {
            // skip courses with errors
          }
        }

        // Sort by due date
        allAssignments.sort((a, b) => {
          if (!a.due_at && !b.due_at) return 0;
          if (!a.due_at) return 1;
          if (!b.due_at) return -1;
          return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
        });

        spinner.stop();

        if (options.json) {
          console.log(JSON.stringify({ courses, allAssignments, announcements, todos, upcoming }, null, 2));
          return;
        }

        // --- COURSES ---
        console.log();
        console.log(chalk.bold.cyan('  Courses'));
        console.log();
        for (const c of courses) {
          console.log(`  ${chalk.dim(String(c.id))}  ${c.course_code} — ${c.name}`);
        }

        // --- UPCOMING ASSIGNMENTS ---
        console.log();
        console.log(chalk.bold.cyan('  Upcoming Assignments'));
        console.log();
        if (allAssignments.length === 0) {
          console.log(chalk.green('  Nothing upcoming!'));
        } else {
          printTable(
            ['Course', 'Assignment', 'Due', 'Relative', 'Status'],
            allAssignments.slice(0, 15).map((a) => {
              const due = formatDate(a.due_at);
              const rel = formatRelativeDate(a.due_at);
              const overdue = a.due_at && isOverdue(a.due_at);
              const sub = a.submission;
              let status = chalk.dim('Not submitted');
              if (sub?.excused) status = chalk.blue('Excused');
              else if (sub?.workflow_state === 'graded') status = chalk.green('Graded');
              else if (sub?.workflow_state === 'submitted') status = chalk.cyan('Submitted');
              else if (sub?.missing) status = chalk.red('Missing');
              else if (overdue) status = chalk.red('Overdue');
              return [
                a._courseName,
                a.name,
                overdue ? chalk.red(due) : due,
                overdue ? chalk.red(rel) : chalk.yellow(rel),
                status,
              ];
            })
          );
        }

        // --- TODO ---
        if (todos.length > 0) {
          console.log();
          console.log(chalk.bold.cyan('  Todo'));
          console.log();
          for (const t of todos) {
            const name = t.assignment?.name || 'Unknown';
            const due = formatRelativeDate(t.assignment?.due_at);
            const course = courseCodeMap.get(`course_${t.course_id}`) || String(t.course_id);
            console.log(`  ${chalk.yellow('●')} ${name} — ${course} — ${due}`);
          }
        }

        // --- RECENT ANNOUNCEMENTS ---
        console.log();
        console.log(chalk.bold.cyan('  Recent Announcements (7 days)'));
        console.log();
        if (announcements.length === 0) {
          console.log('  No recent announcements.');
        } else {
          const sorted = announcements.sort(
            (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
          );
          for (const a of sorted.slice(0, 8)) {
            const course = courseCodeMap.get(a.context_code) || a.context_code;
            const date = formatDate(a.posted_at);
            console.log(`  ${chalk.dim(date)}  ${chalk.bold(course)}  ${a.title}`);
          }
          if (sorted.length > 8) {
            console.log(chalk.dim(`  ... and ${sorted.length - 8} more`));
          }
        }

        console.log();
      } catch (err) {
        handleError(err);
      }
    });
}
