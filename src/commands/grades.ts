import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config/index.js';
import { CanvasClient } from '../api/client.js';
import { outputResult } from '../formatters/json.js';
import { printTable } from '../formatters/table.js';
import { formatDate } from '../formatters/date.js';
import { handleError } from '../utils/error.js';
import type { Assignment } from '../types/canvas.js';

interface CourseWithScores {
  id: number;
  name: string;
  course_code: string;
  enrollments?: {
    type: string;
    computed_current_score: number | null;
    computed_current_grade: string | null;
    computed_final_score: number | null;
    computed_final_grade: string | null;
  }[];
}

interface GradeRow {
  course: string;
  scored: number;
  total: number;
  percentage: string;
  assignments: { name: string; score: string; due: string }[];
}

export function registerGradesCommand(program: Command): void {
  program
    .command('grades')
    .description('View your grades')
    .argument('[courseId]', 'Course ID (omit for all courses)', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (courseId: number | undefined, options) => {
      try {
        const config = await ensureConfig();
        const client = new CanvasClient(config);
        const spinner = ora('Fetching grades...').start();

        if (courseId) {
          // For a specific course, show assignment-level grades
          const assignments = await client.fetchAll<Assignment>(
            `/courses/${courseId}/assignments`,
            { 'include[]': ['submission'], order_by: 'due_at' }
          );
          spinner.stop();

          const graded = assignments.filter(
            (a) => a.submission && a.submission.score !== null && a.submission.score !== undefined
          );

          outputResult(
            { all: assignments, graded },
            (data) => {
              if (data.graded.length === 0) {
                console.log('No graded assignments yet for this course.');
                if (data.all.length > 0) {
                  console.log(chalk.dim(`${data.all.length} total assignments found.`));
                }
                return;
              }

              let totalScored = 0;
              let totalPossible = 0;

              printTable(
                ['Assignment', 'Score', 'Points', 'Grade', 'Due'],
                data.graded.map((a) => {
                  const sub = a.submission!;
                  const score = sub.score ?? 0;
                  totalScored += score;
                  totalPossible += a.points_possible;
                  const pct =
                    a.points_possible > 0
                      ? `${((score / a.points_possible) * 100).toFixed(1)}%`
                      : '-';
                  return [
                    a.name,
                    `${score}`,
                    `${a.points_possible}`,
                    pct,
                    formatDate(a.due_at),
                  ];
                })
              );

              const overallPct =
                totalPossible > 0
                  ? ((totalScored / totalPossible) * 100).toFixed(1)
                  : '0';
              console.log();
              console.log(
                chalk.bold(`  Overall: ${totalScored}/${totalPossible} (${overallPct}%)`)
              );
              console.log(
                chalk.dim(`  ${data.graded.length} graded, ${data.all.length - data.graded.length} pending`)
              );
              console.log();
            },
            options.json
          );
        } else {
          // Overview: try courses with total_scores, fall back to per-course assignments
          const courses = await client.fetchAll<CourseWithScores>('/courses', {
            enrollment_state: 'active',
            'include[]': ['total_scores', 'term'],
            state: 'available',
          });

          // Filter to actual student courses
          const studentCourses = courses.filter(
            (c) =>
              c.enrollments?.some((e) => e.type === 'student') &&
              // Skip non-academic courses
              c.course_code &&
              !c.course_code.startsWith('SSS_') &&
              !c.course_code.startsWith('STIMulate') &&
              !c.course_code.startsWith('FOS_')
          );

          // For each course, get assignment-level grades
          const rows: GradeRow[] = [];
          for (const course of studentCourses) {
            spinner.text = `Fetching grades for ${course.course_code}...`;
            try {
              const assignments = await client.fetchAll<Assignment>(
                `/courses/${course.id}/assignments`,
                { 'include[]': ['submission'] }
              );
              const graded = assignments.filter(
                (a) => a.submission?.score !== null && a.submission?.score !== undefined
              );
              let scored = 0;
              let total = 0;
              const assignmentDetails = graded.map((a) => {
                const s = a.submission!.score ?? 0;
                scored += s;
                total += a.points_possible;
                return {
                  name: a.name,
                  score: `${s}/${a.points_possible}`,
                  due: formatDate(a.due_at),
                };
              });
              const pct = total > 0 ? `${((scored / total) * 100).toFixed(1)}%` : 'N/A';
              rows.push({
                course: course.course_code,
                scored,
                total,
                percentage: pct,
                assignments: assignmentDetails,
              });
            } catch {
              // Skip courses that error
            }
          }
          spinner.stop();

          outputResult(
            rows,
            (data) => {
              if (data.length === 0) {
                console.log('No grade data found.');
                return;
              }
              printTable(
                ['Course', 'Scored', 'Total', 'Percentage', 'Graded Items'],
                data.map((r) => [
                  r.course,
                  Number.isInteger(r.scored) ? String(r.scored) : r.scored.toFixed(1),
                  String(r.total),
                  r.percentage,
                  String(r.assignments.length),
                ])
              );
              console.log(
                chalk.dim('\nUse `canvas grades <courseId>` for detailed assignment grades.')
              );
            },
            options.json
          );
        }
      } catch (err) {
        handleError(err);
      }
    });
}
