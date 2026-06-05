#!/usr/bin/env node
/**
 * @q-cms/cli — main entry point.
 *
 * Subcommands are registered from `commands/*.ts`. Use
 * `q-cms --help` to see the full list.
 */

import { Command } from 'commander';
import { registerLoginCommand } from './commands/login.ts';
import { registerWhoamiCommand } from './commands/whoami.ts';
import { registerUsersCommand } from './commands/users.ts';
import { registerDbCommand } from './commands/db.ts';
import { registerInitCommand } from './commands/init.ts';
import { registerImportExportCommand } from './commands/import-export.ts';
import { registerCodegenCommand } from './commands/codegen.ts';
import { registerDevCommand } from './commands/dev.ts';
import { color, symbols } from './utils/output.ts';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('q-cms')
  .description(`${color.bold('Q-CMS')} — headless CMS CLI`)
  .version(VERSION, '-V, --version', 'Print version')
  .helpOption('-h, --help', 'Print this help')
  .addHelpText(
    'after',
    `
Examples:
  ${color.cyan('q-cms init my-blog')}              Scaffold a new project
  ${color.cyan('q-cms db:migrate && q-cms db:seed')} Set up the local database
  ${color.cyan('q-cms login')}                      Authenticate with an instance
  ${color.cyan('q-cms whoami')}                     Show current user
  ${color.cyan('q-cms users:list')}                 List users
  ${color.cyan('q-cms export > backup.json')}       Export all content

Docs: https://q-cms.dev/docs/cli
`,
  );


// Override Commander's default exit so that showing help (no subcommand)
// exits with code 0 instead of 1. Helps `bun run --watch` stay alive.
program.exitOverride();

registerInitCommand(program);
registerLoginCommand(program);
registerWhoamiCommand(program);
registerUsersCommand(program);
registerDbCommand(program);
registerImportExportCommand(program);
registerCodegenCommand(program);
registerDevCommand(program);

program.parseAsync(process.argv).then(() => {
  // No subcommand → help was shown, exit cleanly
  process.exit(0);
}).catch((err: { code?: string; exitCode?: number }) => {
  // Help/version display — always clean exit regardless of Commander's exitCode
  if (err.code === 'commander.help' || err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
    process.exit(0);
  }
  // Commander already printed the error message — exit with its code
  if (err.code?.startsWith('commander.')) {
    process.exit(err.exitCode ?? 1);
  }
  // Unexpected error — show full details
  console.error(`${color.red(symbols.cross)} Unexpected error:`);
  console.error(err);
  process.exit(1);
});

