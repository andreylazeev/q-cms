/**
 * @q-cms/db — schema, client, and repositories for Q-CMS.
 *
 * Public surface:
 * - `client`     — Postgres connection factory (postgres-js).
 * - `repositories` — Domain repositories returning `Result<T, DomainError>`.
 * - `schema`     — Drizzle table definitions (also exported via `@q-cms/db/schema`).
 *
 * @packageDocumentation
 */

export * from './client.ts';
export * from './repositories/index.ts';
export * as schema from './schema/index.ts';
