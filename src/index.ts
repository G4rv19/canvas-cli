#!/usr/bin/env node

import { Command } from 'commander';
import { registerConfigureCommand } from './commands/configure.js';
import { registerLoginCommand } from './commands/login.js';
import { registerLogoutCommand } from './commands/logout.js';
import { registerWhoamiCommand } from './commands/whoami.js';
import { registerDashboardCommand } from './commands/dashboard.js';
import { registerCoursesCommand } from './commands/courses.js';
import { registerAssignmentsCommand } from './commands/assignments.js';
import { registerSubmissionsCommand } from './commands/submissions.js';
import { registerAnnouncementsCommand } from './commands/announcements.js';
import { registerModulesCommand } from './commands/modules.js';
import { registerTodoCommand } from './commands/todo.js';
import { registerGradesCommand } from './commands/grades.js';
import { registerCalendarCommand } from './commands/calendar.js';
import { registerFilesCommand } from './commands/files.js';
import { registerPageCommand } from './commands/page.js';
import { registerGroupsCommand } from './commands/groups.js';
import { registerSearchCommand } from './commands/search.js';
import { registerInboxCommand } from './commands/inbox.js';
import { registerDiscussionsCommand } from './commands/discussions.js';
import { registerGrabCommand } from './commands/grab.js';

const program = new Command();

program
  .name('canvas')
  .description('CLI tool for Canvas LMS — view courses, assignments, grades, and more')
  .version('1.0.0');

registerConfigureCommand(program);
registerLoginCommand(program);
registerLogoutCommand(program);
registerDashboardCommand(program);
registerWhoamiCommand(program);
registerCoursesCommand(program);
registerAssignmentsCommand(program);
registerSubmissionsCommand(program);
registerAnnouncementsCommand(program);
registerModulesCommand(program);
registerTodoCommand(program);
registerGradesCommand(program);
registerCalendarCommand(program);
registerFilesCommand(program);
registerPageCommand(program);
registerGroupsCommand(program);
registerSearchCommand(program);
registerInboxCommand(program);
registerDiscussionsCommand(program);
registerGrabCommand(program);

program.parse();
