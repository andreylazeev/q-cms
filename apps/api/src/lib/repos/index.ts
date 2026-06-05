/**
 * Repository barrel — re-exports all domain repos for the API layer.
 *
 * Each module wraps the corresponding `@q-cms/db` repository, adapting
 * its API to match the interface the route handlers expect (null for
 * "not found" instead of `Result`, cursor-based pagination, etc.).
 *
 * @module lib/repos
 */

export * from './entries.ts';
export * from './collections.ts';
export * from './media.ts';
export * from './users.ts';
export * from './roles.ts';
export * from './webhooks.ts';
export * from './audit.ts';
export * from './singletons.ts';
export * from './sessions.ts';
export * from './health.ts';
