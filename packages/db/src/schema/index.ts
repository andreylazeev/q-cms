/**
 * Schema barrel — re-exports every table, type, and enum defined in the
 * sibling schema files. Drizzle Kit loads this single entry point via
 * `drizzle.config.ts`.
 *
 * @packageDocumentation
 */

// Auth & RBAC
export * from './auth.ts';
export * from './rbac.ts';

// Audit
export * from './audit.ts';

// Content
export * from './content.ts';

// Media
export * from './media.ts';

// Webhooks
export * from './webhooks.ts';

// Email
export * from './email.ts';
