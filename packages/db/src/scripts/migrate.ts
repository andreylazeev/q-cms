#!/usr/bin/env bun
/**
 * Database migration runner.
 *
 * Applies Drizzle migrations from `drizzle/` to the database referenced by
 * `DATABASE_URL`. Idempotent — re-running is a no-op when the journal is
 * up to date.
 *
 * Usage:
 * ```sh
 * bun run src/scripts/migrate.ts
 * # or
 * pnpm migrate
 * ```
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('→ Connecting to database…');
  const sql = postgres(DATABASE_URL as string, { max: 1, prepare: false });
  const db = drizzle(sql);

  console.log('→ Running migrations from ./drizzle …');
  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('✓ Migrations applied');
  await sql.end({ timeout: 5 });
}

main().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
