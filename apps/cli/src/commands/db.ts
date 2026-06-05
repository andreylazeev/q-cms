/**
 * `q-cms db:*` — manage database schema and data.
 *
 * Subcommands:
 *   - `q-cms db:migrate`  — apply pending Drizzle migrations
 *   - `q-cms db:seed`     — insert default roles/permissions/admin user
 *   - `q-cms db:reset`    — drop everything and re-create (DESTRUCTIVE)
 *   - `q-cms db:status`   — show migration status
 */

import { Command } from 'commander';
import { execSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { requireProjectRoot } from '../utils/config.ts';
import { success, error, info, warn, header, Spinner } from '../utils/output.ts';

interface MigrateOptions {
  dryRun?: boolean;
}

export function registerDbCommand(program: Command): void {
  const db = program.command('db').description('Manage the local database');

  db
    .command('migrate')
    .description('Apply pending Drizzle migrations')
    .option('--dry-run', 'Show pending migrations without applying')
    .action((opts: MigrateOptions) => {
      const root = requireProjectRoot();
      const migrationsDir = join(root, 'packages/db/drizzle');

      if (!existsSync(migrationsDir)) {
        error(`No migrations directory at ${migrationsDir}`);
        error('Run `pnpm --filter @q-cms/db generate` first to create migrations.');
        process.exitCode = 1;
        return;
      }

      const pending = readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      if (pending.length === 0) {
        info('No migrations to apply');
        return;
      }

      header(`Migrations (${pending.length} found)`);
      for (const m of pending) {
        const stat = statSync(join(migrationsDir, m));
        info(`  ${m}  (${(stat.size / 1024).toFixed(1)} KB)`);
      }

      if (opts.dryRun) {
        info('Dry run — not applying');
        return;
      }

      const spinner = new Spinner('Applying migrations...').start();
      try {
        execSync('pnpm --filter @q-cms/db migrate', { stdio: 'pipe', cwd: root });
        spinner.succeed(`Applied ${pending.length} migration(s)`);
      } catch (err) {
        spinner.fail();
        error(`Migration failed: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  db
    .command('seed')
    .description('Insert default roles, permissions, and an admin user')
    .option('--email <email>', 'Admin email (default: admin@q-cms.local)')
    .option('--password <password>', 'Admin password (default: from env or "changeme")')
    .action(async (opts: { email?: string; password?: string }) => {
      const spinner = new Spinner('Seeding database...').start();
      try {
        const root = requireProjectRoot();
        const env: NodeJS.ProcessEnv = { ...process.env };
        if (opts.email) env.SEED_ADMIN_EMAIL = opts.email;
        if (opts.password) env.SEED_ADMIN_PASSWORD = opts.password;
        execSync('pnpm --filter @q-cms/db seed', { stdio: 'pipe', cwd: root, env });
        spinner.succeed('Database seeded');
        if (opts.email) {
          info(`Admin user: ${opts.email}`);
        } else {
          info('Default admin: admin@q-cms.local / changeme');
          warn('Change the default password immediately!');
        }
      } catch (err) {
        spinner.fail();
        error((err as Error).message);
        process.exitCode = 1;
      }
    });

  db
    .command('reset')
    .description('DESTRUCTIVE: drop all data and re-create the schema')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (opts: { yes?: boolean }) => {
      if (!opts.yes) {
        error('This will DELETE ALL DATA. Pass --yes to confirm.');
        process.exitCode = 1;
        return;
      }
      const root = requireProjectRoot();
      const spinner = new Spinner('Resetting database...').start();
      try {
        const url = process.env.DATABASE_URL;
        if (!url) {
          throw new Error('DATABASE_URL not set');
        }
        // Drop and recreate via psql
        const urlObj = new URL(url);
        const dbName = urlObj.pathname.slice(1);
        const adminUrl = `${urlObj.protocol}//${urlObj.username}:${urlObj.password}@${urlObj.host}/postgres`;
        execSync(
          `psql "${adminUrl}" -c "DROP DATABASE IF EXISTS ${dbName} WITH (FORCE);" -c "CREATE DATABASE ${dbName};"`,
          { stdio: 'pipe', cwd: root },
        );
        spinner.succeed(`Database '${dbName}' reset`);
        info('Run `q-cms db:migrate && q-cms db:seed` to re-create the schema.');
      } catch (err) {
        spinner.fail();
        error((err as Error).message);
        process.exitCode = 1;
      }
    });

  db
    .command('status')
    .description('Show current migration status')
    .action(() => {
      const root = requireProjectRoot();
      const migrationsDir = join(root, 'packages/db/drizzle');
      const journalPath = join(migrationsDir, 'meta/_journal.json');

      header('Database status');
      if (!existsSync(journalPath)) {
        warn('No journal found. Run `q-cms db:generate` then `q-cms db:migrate`.');
        return;
      }

      try {
        const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as {
          version: string;
          entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }>;
        };

        info(`Drizzle journal version: ${journal.version}`);
        info(`Total migrations on disk: ${journal.entries.length}`);
        console.log('');
        for (const entry of journal.entries.slice(-10)) {
          console.log(`  ${String(entry.idx).padStart(3)}  ${entry.tag}  ${new Date(entry.when).toISOString()}`);
        }
        if (journal.entries.length > 10) {
          info(`  ... and ${journal.entries.length - 10} earlier`);
        }
      } catch (err) {
        error(`Failed to read journal: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  db
    .command('studio')
    .description('Open Drizzle Studio in the browser')
    .action(() => {
      const root = requireProjectRoot();
      info('Opening Drizzle Studio on http://localhost:4983 ...');
      const child = spawn('pnpm', ['--filter', '@q-cms/db', 'studio'], {
        stdio: 'inherit',
        cwd: root,
      });
      child.on('exit', (code) => process.exit(code ?? 0));
    });
}

// Help-friendly constants
void resolve;
