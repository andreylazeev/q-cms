/**
 * `q-cms import` / `q-cms export` — bulk content transfer.
 *
 * The full format is defined in `API.md` §3.5 (Bulk). For now we
 * accept either:
 *   - a JSON array of `{ op, ref, resource, data }` operations
 *   - a CSV file (one row per entry, with `collection` and `id` columns)
 *
 * Output: a single JSON document on stdout, suitable for piping
 * into `q-cms import` or storing as a backup.
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getCurrentProfile } from '../utils/config.ts';
import { clientFromProfile, HttpError } from '../utils/http.ts';
import { success, error, info, warn, header, Spinner } from '../utils/output.ts';

interface BulkOp {
  op: 'create' | 'update' | 'delete' | 'publish';
  ref?: string;
  resource: string;
  id?: string;
  data?: Record<string, unknown>;
}

interface ImportOptions {
  collection?: string;
  dryRun?: boolean;
}

export function registerImportExportCommand(program: Command): void {
  program
    .command('import <file>')
    .description('Import content from a JSON or CSV file')
    .option('-c, --collection <slug>', 'Target collection (CSV only)')
    .option('--dry-run', 'Validate without writing')
    .action(async (file: string, opts: ImportOptions) => {
      const path = resolve(file);
      if (!existsSync(path)) {
        error(`File not found: ${path}`);
        process.exitCode = 1;
        return;
      }
      const profile = getCurrentProfile();
      if (!profile) {
        error('Not logged in. Run `q-cms login` first.');
        process.exitCode = 1;
        return;
      }
      const client = clientFromProfile(profile);
      const isJson = path.endsWith('.json');
      const ops: BulkOp[] = isJson
        ? parseJson(readFileSync(path, 'utf-8'))
        : parseCsv(readFileSync(path, 'utf-8'), opts.collection);
      if (ops.length === 0) {
        warn('No operations to import.');
        return;
      }
      header(`Importing ${ops.length} operation${ops.length === 1 ? '' : 's'}`);
      if (opts.dryRun) {
        info('Dry run — would send:');
        console.log(JSON.stringify(ops.slice(0, 5), null, 2));
        if (ops.length > 5) info(`  ... and ${ops.length - 5} more`);
        return;
      }
      const spinner = new Spinner('Importing...').start();
      try {
        const result = (await client.post('/api/v1/bulk', { atomic: false, operations: ops })) as {
          results: Array<{ ref?: string; status: number; data?: unknown; errors?: unknown }>;
        };
        const ok = result.results.filter((r) => r.status >= 200 && r.status < 300).length;
        const failed = result.results.length - ok;
        spinner.succeed(`Imported ${ok} / ${result.results.length} (${failed} failed)`);
        if (failed > 0) {
          const firstFail = result.results.find((r) => r.status < 200 || r.status >= 300);
          error(`First failure: ${JSON.stringify(firstFail, null, 2)}`);
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

  program
    .command('export [file]')
    .description('Export all content to a JSON file (stdout if no file given)')
    .option('-c, --collection <slug>', 'Export only one collection')
    .option('--include-drafts', 'Include draft entries (default: published only)')
    .option('--limit <n>', 'Max entries per collection (default: 1000)')
    .action(async (file: string | undefined, opts: { collection?: string; includeDrafts?: boolean; limit?: string }) => {
      const profile = getCurrentProfile();
      if (!profile) {
        error('Not logged in. Run `q-cms login` first.');
        process.exitCode = 1;
        return;
      }
      const client = clientFromProfile(profile);
      const limit = Number(opts.limit ?? '1000');
      const spinner = new Spinner('Exporting...').start();
      try {
        // Fetch collection list first
        const cols = (await client.get('/api/v1/collections')) as { data: Array<{ id: string; slug: string; name: string }> };
        const targets = opts.collection ? cols.data.filter((c) => c.slug === opts.collection) : cols.data;
        if (targets.length === 0) {
          spinner.fail();
          error(`No collections matched${opts.collection ? `: ${opts.collection}` : ''}`);
          process.exitCode = 1;
          return;
        }
        const dump: { exportedAt: string; collections: Record<string, unknown[]> } = {
          exportedAt: new Date().toISOString(),
          collections: {},
        };
        for (const c of targets) {
          const status = opts.includeDrafts ? '*' : 'published';
          const entries = (await client.get(`/api/v1/collections/${c.slug}/entries`, {
            limit: String(limit),
            status,
          })) as { data: unknown[] };
          dump.collections[c.slug] = entries.data;
          info(`  ${c.slug}: ${entries.data.length} entries`);
        }
        const json = JSON.stringify(dump, null, 2);
        if (file) {
          writeFileSync(resolve(file), json, 'utf-8');
          spinner.succeed(`Exported to ${file}`);
        } else {
          spinner.succeed('Export ready');
          process.stdout.write(json + '\n');
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
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseJson(text: string): BulkOp[] {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) return parsed as BulkOp[];
  const obj = parsed as { operations?: BulkOp[] };
  if (obj && Array.isArray(obj.operations)) return obj.operations;
  throw new Error('JSON must be an array of operations or `{ operations: [...] }`.');
}

function parseCsv(text: string, collection: string | undefined): BulkOp[] {
  if (!collection) {
    throw new Error('CSV import requires --collection <slug>');
  }
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(',').map((h) => h.trim());
  return lines.slice(1).map((line, i) => {
    const cells = line.split(',').map((c) => c.trim());
    const data: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      data[headers[j]!] = cells[j] ?? '';
    }
    return {
      op: 'create',
      ref: `row-${i}`,
      resource: collection,
      data,
    };
  });
}
