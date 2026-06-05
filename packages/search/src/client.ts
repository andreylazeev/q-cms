/**
 * @q-cms/search — typed Meilisearch client wrapper.
 *
 * Provides a narrow, domain-focused surface over the raw Meilisearch SDK.
 * All errors are wrapped in {@link SearchError} so callers only deal with
 * the domain error hierarchy.
 *
 * @packageDocumentation
 */

import { Meilisearch } from 'meilisearch';
import { SearchError } from './errors.ts';
import type {
  SearchConfig,
  SearchOptions,
  SearchResult,
  IndexSettings,
  SearchStats,
} from './types.ts';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a wrapped Meilisearch client.
 *
 * @example
 * ```ts
 * const search = createClient({ host: 'http://127.0.0.1:7700' });
 * await search.indexDocument('entries', { id: '1', title: 'Hello' });
 * ```
 */
export function createClient(config: SearchConfig): MeilisearchClient {
  return new MeilisearchClient(config);
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class MeilisearchClient {
  #client: Meilisearch;

  constructor(config: SearchConfig) {
    const meiliConfig: { host: string; apiKey?: string; timeout?: number } = { host: config.host };
    if (config.apiKey !== undefined) meiliConfig.apiKey = config.apiKey;
    if (config.timeout !== undefined) meiliConfig.timeout = config.timeout;
    this.#client = new Meilisearch(meiliConfig);
  }

  /**
   * Add or update a single document in the given index.
   * @param indexName — Meilisearch index UID.
   * @param doc — document to index (must include the primary-key field).
   */
  async indexDocument<T extends Record<string, unknown>>(
    indexName: string,
    doc: T,
  ): Promise<void> {
    try {
      const index = this.#client.index<T>(indexName);
      const task = await index.addDocuments([doc]);
      await waitForEnqueuedTask(index, task);
    } catch (error) {
      throw new SearchError(
        `Failed to index document into "${indexName}"`,
        toErrorMeta(error),
      );
    }
  }

  /**
   * Add or update multiple documents in the given index.
   * @param indexName — Meilisearch index UID.
   * @param docs — documents to index (each must include the primary-key field).
   */
  async indexDocuments<T extends Record<string, unknown>>(
    indexName: string,
    docs: T[],
  ): Promise<void> {
    if (docs.length === 0) return;

    try {
      const index = this.#client.index<T>(indexName);
      const task = await index.addDocuments(docs);
      await waitForEnqueuedTask(index, task);
    } catch (error) {
      throw new SearchError(
        `Failed to index ${docs.length} document(s) into "${indexName}"`,
        toErrorMeta(error),
      );
    }
  }

  /**
   * Delete a single document by its primary-key value.
   * @param indexName — Meilisearch index UID.
   * @param id — primary-key value of the document to remove.
   */
  async deleteDocument(
    indexName: string,
    id: string | number,
  ): Promise<void> {
    try {
      const index = this.#client.index(indexName);
      const task = await index.deleteDocument(id);
      await waitForEnqueuedTask(index, task);
    } catch (error) {
      throw new SearchError(
        `Failed to delete document "${String(id)}" from "${indexName}"`,
        toErrorMeta(error),
      );
    }
  }

  /**
   * Delete multiple documents by their primary-key values.
   * @param indexName — Meilisearch index UID.
   * @param ids — primary-key values of the documents to remove.
   */
  async deleteDocuments(
    indexName: string,
    ids: string[] | number[],
  ): Promise<void> {
    if (ids.length === 0) return;

    try {
      const index = this.#client.index(indexName);
      const task = await index.deleteDocuments(ids);
      await waitForEnqueuedTask(index, task);
    } catch (error) {
      throw new SearchError(
        `Failed to delete ${ids.length} document(s) from "${indexName}"`,
        toErrorMeta(error),
      );
    }
  }

  /**
   * Perform a full-text search.
   *
   * @param indexName — Meilisearch index UID.
   * @param query — search query string; pass `""` to list all documents.
   * @param options — optional filters, facets, sorting, and pagination.
   * @returns typed result envelope with hits, facets, and pagination metadata.
   *
   * @example
   * ```ts
   * const result = await search.search<Entry>('entries', 'hello', {
   *   filter: ['status = published'],
   *   sort: ['createdAt:desc'],
   *   limit: 20,
   * });
   * ```
   */
  async search<T extends Record<string, unknown>>(
    indexName: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult<T>> {
    try {
      const index = this.#client.index<T>(indexName);
      const meiliOptions = buildSearchParams(options);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await index.search(query, meiliOptions as any);

      const searchResult: SearchResult<T> = {
        hits: result.hits as T[],
        totalHits: result.totalHits ?? result.estimatedTotalHits ?? result.hits.length,
        processingTimeMs: result.processingTimeMs,
        query: result.query,
        offset: result.offset ?? 0,
        limit: result.limit ?? result.hits.length,
      };
      if (result.facetDistribution !== undefined) searchResult.facetDistribution = result.facetDistribution;
      if (result.page !== undefined) searchResult.page = result.page;
      if (result.totalPages !== undefined) searchResult.totalPages = result.totalPages;
      return searchResult;
    } catch (error) {
      throw new SearchError(
        `Search failed for index "${indexName}"`,
        toErrorMeta(error),
      );
    }
  }

  /**
   * Apply index settings.
   *
   * @param indexName — Meilisearch index UID.
   * @param settings — partial or full settings object.
   *
   * @example
   * ```ts
   * await search.configureIndex('entries', {
   *   searchableAttributes: ['title', 'body'],
   *   filterableAttributes: ['status', 'collectionId'],
   *   sortableAttributes: ['createdAt', 'updatedAt'],
   * });
   * ```
   */
  async configureIndex(
    indexName: string,
    settings: IndexSettings,
  ): Promise<void> {
    try {
      const index = this.#client.index(indexName);
      const task = await index.updateSettings(settings);
      await waitForEnqueuedTask(index, task);
    } catch (error) {
      throw new SearchError(
        `Failed to configure index "${indexName}"`,
        toErrorMeta(error),
      );
    }
  }

  /**
   * Retrieve instance-wide statistics from Meilisearch.
   * Includes database size, per-index document counts, and indexing status.
   */
  async getStats(): Promise<SearchStats> {
    try {
      const stats = await this.#client.getStats();
      return stats;
    } catch (error) {
      throw new SearchError(
        'Failed to retrieve search stats',
        toErrorMeta(error),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSearchParams(
  options: SearchOptions | undefined,
): Record<string, unknown> | undefined {
  if (options === undefined) return undefined;

  const params: Record<string, unknown> = {};

  if (options.filter !== undefined) params['filter'] = options.filter;
  if (options.sort !== undefined) params['sort'] = options.sort;
  if (options.facets !== undefined) params['facets'] = options.facets;
  if (options.hitsPerPage !== undefined) params['hitsPerPage'] = options.hitsPerPage;
  if (options.page !== undefined) params['page'] = options.page;
  if (options.limit !== undefined) params['limit'] = options.limit;
  if (options.offset !== undefined) params['offset'] = options.offset;
  if (options.attributesToRetrieve !== undefined) params['attributesToRetrieve'] = options.attributesToRetrieve;
  if (options.attributesToHighlight !== undefined) params['attributesToHighlight'] = options.attributesToHighlight;
  if (options.highlightPreTag !== undefined) params['highlightPreTag'] = options.highlightPreTag;
  if (options.highlightPostTag !== undefined) params['highlightPostTag'] = options.highlightPostTag;
  if (options.attributesToCrop !== undefined) params['attributesToCrop'] = options.attributesToCrop;
  if (options.cropLength !== undefined) params['cropLength'] = options.cropLength;
  if (options.cropMarker !== undefined) params['cropMarker'] = options.cropMarker;
  if (options.matchingStrategy !== undefined) params['matchingStrategy'] = options.matchingStrategy;
  if (options.showMatchesPosition !== undefined) params['showMatchesPosition'] = options.showMatchesPosition;
  if (options.showRankingScore !== undefined) params['showRankingScore'] = options.showRankingScore;
  if (options.showRankingScoreDetails !== undefined) params['showRankingScoreDetails'] = options.showRankingScoreDetails;

  return params;
}

interface TaskWaiter {
  taskUid?: number;
  waitTask?: () => Promise<unknown>;
}

interface IndexTaskWaiter {
  waitForTask?: (taskUid: number) => Promise<unknown>;
}

async function waitForEnqueuedTask(index: IndexTaskWaiter, task: TaskWaiter): Promise<void> {
  if (typeof task.waitTask === 'function') {
    await task.waitTask();
    return;
  }
  if (typeof task.taskUid !== 'number' || typeof index.waitForTask !== 'function') {
    throw new Error('Meilisearch task response did not include a waitable task id');
  }
  await index.waitForTask(task.taskUid);
}

function toErrorMeta(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      originalMessage: error.message,
      originalName: error.name,
      ...(isMeilisearchError(error) && {
        code: error.code,
        type: error.type,
        link: error.link,
      }),
    };
  }

  return { originalError: String(error) };
}

interface MeilisearchErrorLike {
  code?: string;
  type?: string;
  link?: string;
}

function isMeilisearchError(value: unknown): value is Error & MeilisearchErrorLike {
  return value instanceof Error && 'code' in value;
}
