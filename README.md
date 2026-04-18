# canvas-cli

A CLI tool for Canvas LMS — view courses, assignments, grades, announcements, modules, and more from your terminal.

## Requirements

- Node.js >= 18
- A Canvas LMS account

## Install

```bash
git clone https://github.com/G4rv19/canvas-cli.git
cd canvas-cli
npm install
npm run build
npm link
```

After `npm link`, the `canvas` command will be available globally.

## Setup

Configure your Canvas instance and log in:

```bash
canvas configure    # set your Canvas URL (e.g. canvas.qut.edu.au)
canvas login        # authenticate
canvas whoami       # verify you're logged in
```

## Usage

```bash
canvas <command> [options]
```

### Commands

| Command | Description |
| --- | --- |
| `configure` | Set Canvas instance URL and preferences |
| `login` | Log in to Canvas |
| `logout` | Log out |
| `whoami` | Show current user |
| `dashboard` | Show dashboard overview |
| `courses` | List your courses |
| `assignments` | List assignments |
| `submissions` | View submissions |
| `grades` | View grades |
| `announcements` | List course announcements |
| `modules` | Browse course modules |
| `todo` | Show upcoming to-do items |
| `calendar` | Show calendar events |
| `files` | Browse/download course files |
| `page` | View a course page |
| `groups` | List groups |
| `search` | Search across Canvas |
| `inbox` | View conversations |
| `discussions` | View discussion topics |
| `grab` | Bulk download course content |

Run `canvas <command> --help` for command-specific options.

## Development

```bash
npm run dev     # watch mode
npm run build   # compile TypeScript
npm start       # run compiled CLI
```

## License

MIT
