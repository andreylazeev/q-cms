/**
 * @q-cms/search — error hierarchy for Meilisearch operations.
 *
 * @packageDocumentation
 */

import { DomainError } from '@q-cms/core';

/** Wraps Meilisearch API or connection errors with domain semantics. */
export class SearchError extends DomainError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super(message, 'SEARCH_ERROR', 502, meta);
  }
}
