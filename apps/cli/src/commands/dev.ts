/**
 * `q-cms dev` — start the local dev stack (API + admin + workers).
 *
 * Boots Postgres, Redis, Meilisearch, MinIO via docker compose, then
 * launches the API and admin in watch mode. Falls back to a friendly
 * message when docker is unavailable.
 */

import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { requireProjectRoot } from '../utils/config.ts';
import { info, error, warn, header, Spinner } from '../utils/output.ts';

export function registerDevCommand(program: Command): void {
  program
    .command('dev')
    .description('Start the local dev stack')
    .option('--no-docker', 'Skip docker compose (assume services are already running)')
    .option('--api-only', 'Start only the API')
    .action(async (opts: { docker?: boolean; apiOnly?: boolean }) => {
      const root = requireProjectRoot();
      const compose = join(root, 'docker-compose.yml');
      header('Starting Q-CMS dev stack');

      if (opts.docker !== false && existsSync(compose)) {
        const spinner = new Spinner('Booting docker compose...').start();
        const child = spawn('docker', ['compose', 'up', '-d'], { cwd: root, stdio: 'inherit' });
        child.on('exit', (code) => {
          if (code === 0) {
            spinner.succeed('Docker stack up');
            startServices(root, opts.apiOnly ?? false);
          } else {
            spinner.fail();
            error(`docker compose exited with code ${code}`);
            process.exitCode = code ?? 1;
          }
        });
        return;
      }

      if (opts.docker !== false) {
        warn(`No docker-compose.yml at ${compose} — assuming services are already running.`);
      }
      startServices(root, opts.apiOnly ?? false);
    });
}

function startServices(root: string, apiOnly: boolean): void {
  info('Starting API...');
  const api = spawn('pnpm', ['--filter', '@q-cms/api', 'dev'], { cwd: root, stdio: 'inherit' });
  if (apiOnly) {
    api.on('exit', (code) => process.exit(code ?? 0));
    return;
  }
  info('Starting admin UI...');
  const admin = spawn('pnpm', ['--filter', '@q-cms/admin', 'dev'], { cwd: root, stdio: 'inherit' });
  info('Starting worker...');
  const worker = spawn('pnpm', ['--filter', '@q-cms/worker', 'dev'], { cwd: root, stdio: 'inherit' });
  api.on('exit', () => {
    admin.kill('SIGTERM');
    worker.kill('SIGTERM');
    process.exit(0);
  });
}
