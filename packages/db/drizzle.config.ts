/**
 * Drizzle Kit configuration — used by `pnpm db:generate` to emit SQL
 * migrations from the schema in `src/schema/index.ts`.
 */

import { defineConfig } from 'drizzle-kit';

const url = process.env['DATABASE_URL'] ?? '';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
