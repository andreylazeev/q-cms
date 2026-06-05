/**
 * Database client singleton for the Q-CMS Worker.
 *
 * Lazily initialises a Drizzle client via `@q-cms/db` on first call
 * and reuses it for the lifetime of the process.
 *
 * @module lib/db
 */

import {
  createClient,
  disconnect,
  type DrizzleClient,
} from '@q-cms/db';

let db: DrizzleClient | undefined;

const DATABASE_URL = process.env['DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? 'postgres://localhost:5432/qcms';

/** Return a lazily-initialised Drizzle client. */
export function getDb(): DrizzleClient {
  if (db) return db;
  db = createClient({
    url: DATABASE_URL,
    poolMax: Number.parseInt(process.env['DATABASE_POOL_MAX'] ?? '4', 10),
  });
  return db;
}

/** Close the connection pool. Safe to call even when uninitialised. */
export async function disconnectDb(): Promise<void> {
  if (db) {
    await disconnect(db);
    db = undefined;
  }
}

/** Reset the cached client (tests only). */
export function resetDb(): void {
  db = undefined;
}
