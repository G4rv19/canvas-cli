import Table from 'cli-table3';
import chalk from 'chalk';

export function printTable(headers: string[], rows: string[][]): void {
  const table = new Table({
    head: headers.map((h) => chalk.bold.cyan(h)),
    style: { head: [], border: ['gray'] },
    wordWrap: true,
  });
  for (const row of rows) {
    table.push(row);
  }
  console.log(table.toString());
}
