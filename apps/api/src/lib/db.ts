/**
 * Database client singleton for the Q-CMS API.
 *
 * Lazily initialises a Drizzle client via `@q-cms/db` on first call
 * and reuses it for the lifetime of the process. Call `disconnectDb()`
 * during graceful shutdown to release the connection pool.
 *
 * @module lib/db
 */

import {
  createClient,
  disconnect,
  type DrizzleClient,
} from '@q-cms/db';
import { getEnv } from '../env.ts';

let db: DrizzleClient | undefined;

/** Return a lazily-initialised Drizzle client. */
export function getDb(): DrizzleClient {
  if (db) return db;
  const env = getEnv();
  db = createClient({
    url: env.DATABASE_URL,
    poolMax: env.DATABASE_POOL_MAX,
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
