/**
 * @q-cms/sdk — type-safe client for the Q-CMS REST API.
 *
 * ```ts
 * import { createClient } from '@q-cms/sdk';
 * const cms = createClient({ baseUrl: 'https://cms.example.com', token: '...' });
 * const { data } = await cms.entries('Article').where({ status: 'published' }).get();
 * ```
 *
 * React bindings live in `@q-cms/sdk/react`.
 *
 * @packageDocumentation
 */

export * from './types.ts';
export * from './errors.ts';
export {
  createClient,
  type QcmsClient,
  type ResolvedQcmsConfig,
  type MediaNamespace,
  type UsersNamespace,
  type AuthNamespace,
  type WebhooksNamespace,
  type CollectionsNamespace,
  type RolesNamespace,
  type AuditNamespace,
} from './client.ts';
export { QueryBuilder, type QueryExecutor } from './query-builder.ts';
