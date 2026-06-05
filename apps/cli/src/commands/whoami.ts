/**
 * `q-cms whoami` — print the currently logged-in user.
 */

import { Command } from 'commander';
import { getCurrentProfile, readConfig } from '../utils/config.ts';
import { clientFromProfile, HttpError } from '../utils/http.ts';
import { success, error, info, printTable, header, color } from '../utils/output.ts';

export function registerWhoamiCommand(program: Command): void {
  program
    .command('whoami')
    .description('Print the currently logged-in user and active profile')
    .option('--profile <name>', 'Use a specific profile (overrides current)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { profile?: string; json?: boolean }) => {
      const config = readConfig();
      const profileName = opts.profile ?? config.currentProfile;

      if (!profileName) {
        error('No active profile. Run `q-cms login` first.');
        process.exitCode = 1;
        return;
      }
      const profile = config.profiles[profileName];
      if (!profile) {
        error(`Profile '${profileName}' not found.`);
        process.exitCode = 1;
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify({ profile: profileName, ...profile }, null, 2));
        return;
      }

      header(`Profile: ${profileName}`);
      printTable(['FIELD', 'VALUE'], [
        ['Base URL', profile.baseUrl],
        ['Email', profile.email ?? color.gray('(unknown)')],
        ['User ID', profile.userId ?? color.gray('(unknown)')],
        ['Token type', profile.tokenType],
        ['Created at', profile.createdAt],
      ]);

      // Try a live API call to confirm the token still works
      info('Verifying token with the API...');
      try {
        const client = clientFromProfile(profile, { retries: 0 });
        const me = (await client.get<{ data: { id: string; email: string; isSuperAdmin: boolean } }>(
          '/api/v1/auth/me',
        )) as { data: { id: string; email: string; isSuperAdmin: boolean } };
        success(`Token valid — logged in as ${me.data.email}`);
        if (me.data.isSuperAdmin) {
          console.log(color.yellow('  (super admin)'));
        }
      } catch (err) {
        if (err instanceof HttpError && err.status === 401) {
          error('Token rejected by API (401). Re-run `q-cms login`.');
          process.exitCode = 1;
        } else {
          error(`API unreachable: ${(err as Error).message}`);
          process.exitCode = 1;
        }
      }
    });
}
