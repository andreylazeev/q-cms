/**
 * Database client — thin factory over `postgres-js` + Drizzle.
 *
 * The exposed type is intentionally narrow: callers receive a
 * {@link DrizzleClient} that can run typed queries against the schema in
 * `@q-cms/db/schema`. They never see the raw `postgres` connection.
 *
 * Usage:
 *
 * ```ts
 * const client = createClient({ url: process.env.DATABASE_URL! });
 * const rows = await client.select().from(users).limit(10);
 * await disconnect(client);
 * ```
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

import * as schema from './schema/index.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration accepted by {@link createClient}. */
export interface ClientConfig {
  /** Postgres connection string (`postgres://user:pass@host:port/db`). */
  url: string;
  /** Maximum connections in the pool. Defaults to 10. */
  poolMax?: number;
  /** Idle connection timeout (seconds). Defaults to 30s. */
  idleTimeoutSeconds?: number;
  /** Connect timeout (seconds). Defaults to 10. */
  connectTimeoutSeconds?: number;
  /** Disable prepared statements (useful for pgbouncer / certain proxies). */
  prepare?: boolean;
}

/**
 * The minimal slice of Drizzle's API we expose. Intentionally narrow so the
 * rest of the codebase only uses the operations we depend on (select,
 * insert, update, delete, transaction, execute).
 */
export interface DrizzleClient {
  select: ReturnType<typeof drizzle<typeof schema>>['select'];
  insert: ReturnType<typeof drizzle<typeof schema>>['insert'];
  update: ReturnType<typeof drizzle<typeof schema>>['update'];
  delete: ReturnType<typeof drizzle<typeof schema>>['delete'];
  transaction: ReturnType<typeof drizzle<typeof schema>>['transaction'];
  execute<T = unknown>(query: ReturnType<typeof sql>): Promise<T>;
  /** Escape hatch — callers may need the underlying driver for tests. */
  $client: ReturnType<typeof postgres>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a Drizzle client bound to a `postgres-js` connection pool.
 *
 * @param config - See {@link ClientConfig}.
 * @returns A {@link DrizzleClient} that can be used for typed queries.
 */
export function createClient(config: ClientConfig): DrizzleClient {
  if (!config.url) {
    throw new Error('createClient: `url` is required');
  }

  const sqlClient = postgres(config.url, {
    max: config.poolMax ?? 10,
    idle_timeout: config.idleTimeoutSeconds ?? 30,
    connect_timeout: config.connectTimeoutSeconds ?? 10,
    prepare: config.prepare ?? true,
    // Disable noisy notifications in production.
    onnotice: () => {},
  });

  const db = drizzle(sqlClient, { schema, logger: false });

  return {
    select: db.select.bind(db),
    insert: db.insert.bind(db),
    update: db.update.bind(db),
    delete: db.delete.bind(db),
    transaction: db.transaction.bind(db),
    execute: async <T = unknown>(query: ReturnType<typeof sql>): Promise<T> => {
      const result = await db.execute(query);
      return result as T;
    },
    $client: sqlClient,
  };
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

/**
 * Close the connection pool and release all sockets.
 *
 * Safe to call multiple times — the underlying driver no-ops after the
 * first call.
 */
export async function disconnect(client: DrizzleClient): Promise<void> {
  await client.$client.end({ timeout: 5 });
}
