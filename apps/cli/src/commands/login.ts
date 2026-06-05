/**
 * `q-cms login` — authenticate with a Q-CMS instance and save a profile.
 *
 * Reads URL, email, and password from flags (or prompts), calls
 * `POST /api/v1/auth/login`, and stores the returned token in the
 * local config under the given profile name (default: `default`).
 */

import { Command } from 'commander';
import { saveProfile, isValidProfileName, getCurrentProfile } from '../utils/config.ts';
import { HttpClient, HttpError } from '../utils/http.ts';
import { success, error, info, header } from '../utils/output.ts';

interface LoginOptions {
  url?: string;
  email?: string;
  password?: string;
  profile?: string;
  token?: string;
}

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate with a Q-CMS instance and save credentials locally')
    .option('-u, --url <url>', 'Base URL of the Q-CMS instance')
    .option('-e, --email <email>', 'Email address')
    .option('-p, --password <password>', 'Password (omit to be prompted)')
    .option('--profile <name>', 'Profile name (default: "default")', 'default')
    .option('--token <token>', 'Use an existing API token instead of email/password')
    .action(async (opts: LoginOptions) => {
      const profile = opts.profile ?? 'default';
      if (!isValidProfileName(profile)) {
        error(`Invalid profile name: '${profile}' (allowed: a-z, 0-9, _, -)`);
        process.exitCode = 1;
        return;
      }

      let baseUrl = opts.url;
      let token = opts.token;
      let email: string | undefined;

      if (!token) {
        if (!opts.email) {
          error('Either --email (with --password) or --token is required');
          process.exitCode = 1;
          return;
        }
        if (!baseUrl) {
          error('--url is required when using email/password');
          process.exitCode = 1;
          return;
        }
        email = opts.email;
      } else {
        if (!baseUrl) {
          error('--url is required');
          process.exitCode = 1;
          return;
        }
      }

      if (!baseUrl) return; // type guard

      header(`Logging in to ${baseUrl} (profile: ${profile})`);

      const client = new HttpClient({ baseUrl, retries: 0, timeout: 15_000 });

      if (token) {
        // Validate token by fetching current user
        try {
          const me = (await client.get<{ data: { id: string; email: string } }>('/api/v1/auth/me')) as {
            data: { id: string; email: string };
          };
          saveProfile(profile, {
            baseUrl,
            token,
            tokenType: 'api_token',
            email: me.data.email,
            userId: me.data.id,
          });
          success(`Saved API token for ${me.data.email} in profile '${profile}'`);
        } catch (err) {
          error(`Token validation failed: ${(err as Error).message}`);
          process.exitCode = 1;
        }
        return;
      }

      if (!opts.password) {
        // Bun supports prompt synchronously via console
        const stdin = process.stdin;
        const stdout = process.stdout;
        stdout.write('Password: ');
        const password = await new Promise<string>((resolve) => {
          if (!stdin.isTTY) {
            stdin.once('data', (d) => resolve(d.toString().trim()));
            return;
          }
          stdin.setRawMode(false);
          stdin.resume();
          stdin.once('data', (d) => {
            stdin.pause();
            resolve(d.toString().trim());
          });
        });
        opts.password = password;
      }

      try {
        const res = (await client.post('/api/v1/auth/login', {
          email,
          password: opts.password,
        })) as { accessToken: string; refreshToken?: string; user: { id: string; email: string } };

        const finalToken = res.refreshToken ?? res.accessToken;
        saveProfile(profile, {
          baseUrl,
          token: finalToken,
          tokenType: res.refreshToken ? 'jwt' : 'api_token',
          email: res.user.email,
          userId: res.user.id,
        });
        success(`Logged in as ${res.user.email} (profile: ${profile})`);
        info(`Run \`q-cms whoami\` to verify, or \`q-cms --help\` to see commands.`);
      } catch (err) {
        if (err instanceof HttpError && err.status === 401) {
          error('Invalid email or password');
        } else {
          error(`Login failed: ${(err as Error).message}`);
        }
        process.exitCode = 1;
      }
    });
}
