/**
 * @q-cms/search — Meilisearch integration wrapper.
 *
 * Public surface:
 * - `createClient` / `MeilisearchClient` — typed Meilisearch wrapper.
 * - `SearchError` — domain error for search operations.
 * - Type exports — `SearchConfig`, `SearchOptions`, `SearchResult`,
 *   `IndexSettings`, `IndexStats`, `SearchStats`.
 *
 * @packageDocumentation
 */

export { createClient, MeilisearchClient } from './client.ts';
export { SearchError } from './errors.ts';
export type {
  SearchConfig,
  SearchOptions,
  SearchResult,
  IndexSettings,
  IndexStats,
  SearchStats,
} from './types.ts';
