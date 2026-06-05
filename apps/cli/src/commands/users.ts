/**
 * `q-cms users:*` — manage users via the API.
 *
 * Subcommands:
 *   - `q-cms users:list`
 *   - `q-cms users:create <email>`
 *   - `q-cms users:delete <id>`
 *   - `q-cms users:set-role <userId> <role>`
 */

import { Command } from 'commander';
import { getCurrentProfile } from '../utils/config.ts';
import { HttpClient, clientFromProfile, HttpError } from '../utils/http.ts';
import { success, error, info, header, printTable, Spinner } from '../utils/output.ts';

function getClient(): HttpClient {
  const profile = getCurrentProfile();
  if (!profile) {
    error('Not logged in. Run `q-cms login` first.');
    process.exitCode = 1;
    throw new Error('No active profile');
  }
  return clientFromProfile(profile);
}

interface ListOptions {
  json?: boolean;
  limit?: string;
  page?: string;
}

export function registerUsersCommand(program: Command): void {
  const users = program.command('users').description('Manage users');

  users
    .command('list')
    .description('List users')
    .option('--json', 'Output as JSON')
    .option('--limit <n>', 'Page size')
    .option('--page <n>', 'Page number')
    .action(async (opts: ListOptions) => {
      try {
        const client = getClient();
        const res = (await client.get('/api/v1/users', {
          limit: opts.limit,
          page: opts.page,
        })) as { data: Array<{ id: string; email: string; isActive: boolean; isSuperAdmin: boolean; lastLoginAt: string | null; createdAt: string }>; meta: { totalCount: number } };

        if (opts.json) {
          console.log(JSON.stringify(res, null, 2));
          return;
        }

        header(`Users (${res.meta.totalCount} total)`);
        printTable(
          ['ID', 'EMAIL', 'ACTIVE', 'SUPER', 'LAST LOGIN', 'CREATED'],
          res.data.map((u) => [
            u.id.slice(0, 8),
            u.email,
            u.isActive ? '✓' : '✗',
            u.isSuperAdmin ? '✓' : '',
            u.lastLoginAt ?? '—',
            u.createdAt.slice(0, 10),
          ]),
        );
      } catch (err) {
        if (err instanceof HttpError) {
          error(`API error ${err.status}: ${JSON.stringify(err.body)}`);
        } else {
          error((err as Error).message);
        }
        process.exitCode = 1;
      }
    });

  users
    .command('create <email>')
    .description('Create a new user')
    .option('-p, --password <password>', 'Initial password (auto-generated if omitted)')
    .option('-r, --role <role>', 'Role name (default: viewer)')
    .option('--super', 'Mark as super admin (grants all permissions)')
    .option('--json', 'Output as JSON')
    .action(async (email: string, opts: { password?: string; role?: string; super?: boolean; json?: boolean }) => {
      const spinner = new Spinner('Creating user...').start();
      try {
        const client = getClient();
        const password = opts.password ?? generatePassword();
        const res = (await client.post('/api/v1/users', {
          email,
          password,
          isSuperAdmin: Boolean(opts.super),
        })) as { data: { id: string; email: string } };

        if (opts.role) {
          await client.post(`/api/v1/users/${res.data.id}/roles`, { role: opts.role });
        }

        spinner.succeed(`Created user ${res.data.email}`);
        if (opts.json) {
          console.log(JSON.stringify({ id: res.data.id, email, password, role: opts.role }, null, 2));
        } else {
          info(`Password: ${password}`);
          info(`Save this password — it won't be shown again.`);
        }
      } catch (err) {
        spinner.fail();
        if (err instanceof HttpError) {
          error(`API error ${err.status}: ${JSON.stringify(err.body)}`);
        } else {
          error((err as Error).message);
        }
        process.exitCode = 1;
      }
    });

  users
    .command('delete <id>')
    .description('Delete a user')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (id: string, opts: { yes?: boolean }) => {
      if (!opts.yes) {
        info(`About to delete user ${id}. Pass --yes to confirm.`);
        process.exitCode = 1;
        return;
      }
      const spinner = new Spinner('Deleting user...').start();
      try {
        const client = getClient();
        await client.delete(`/api/v1/users/${id}`);
        spinner.succeed('User deleted');
      } catch (err) {
        spinner.fail();
        if (err instanceof HttpError && err.status === 404) {
          error('User not found');
        } else {
          error((err as Error).message);
        }
        process.exitCode = 1;
      }
    });

  users
    .command('set-role <userId> <role>')
    .description('Assign a role to a user')
    .action(async (userId: string, role: string) => {
      const spinner = new Spinner('Assigning role...').start();
      try {
        const client = getClient();
        await client.post(`/api/v1/users/${userId}/roles`, { role });
        spinner.succeed(`Assigned role '${role}' to ${userId}`);
      } catch (err) {
        spinner.fail();
        if (err instanceof HttpError) {
          error(`API error ${err.status}: ${JSON.stringify(err.body)}`);
        } else {
          error((err as Error).message);
        }
        process.exitCode = 1;
      }
    });
}

function generatePassword(length = 20): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join('');
}
