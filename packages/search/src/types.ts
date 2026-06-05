/**
 * @q-cms/search — type definitions for the Meilisearch wrapper.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Options passed to {@link createClient}. */
export interface SearchConfig {
  /** Meilisearch server URL (e.g. `http://127.0.0.1:7700`). */
  host: string;
  /** API key with at least `search` scope. */
  apiKey?: string;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Query-time options for a full-text search. */
export interface SearchOptions {
  /** Meilisearch filter expression(s). */
  filter?: string | string[];
  /** Sort clauses (e.g. `["price:desc", "title:asc"]`). */
  sort?: string[];
  /** Facet names to include in the result distribution. */
  facets?: string[];
  /** Maximum documents per page when using `hitsPerPage`+`page`. */
  hitsPerPage?: number;
  /** Page number when using `hitsPerPage`+`page`. */
  page?: number;
  /** Maximum documents per response when using `limit`+`offset`. */
  limit?: number;
  /** Zero-indexed offset when using `limit`+`offset`. */
  offset?: number;
  /** Fields to include in each hit. */
  attributesToRetrieve?: string[];
  /** Fields whose matching terms should be highlighted. */
  attributesToHighlight?: string[];
  /** Prefix inserted before a highlighted match. */
  highlightPreTag?: string;
  /** Suffix inserted after a highlighted match. */
  highlightPostTag?: string;
  /** Fields whose content should be cropped. */
  attributesToCrop?: string[];
  /** Maximum characters per cropped field. */
  cropLength?: number;
  /** Marker appended when content is cropped. */
  cropMarker?: string;
  /** Filter matching strategy (`"last"`, `"all"`, or `"frequency"`). */
  matchingStrategy?: string;
  /** Include match positions in the result. */
  showMatchesPosition?: boolean;
  /** Include the ranking score in the result. */
  showRankingScore?: boolean;
  /** Include detailed ranking-score breakdown. */
  showRankingScoreDetails?: boolean;
}

/** Result envelope returned by {@link MeilisearchClient.search}. */
export interface SearchResult<T> {
  /** Matching documents. */
  hits: T[];
  /** Estimated number of matching documents. */
  totalHits: number;
  /** Server-side processing time in milliseconds. */
  processingTimeMs: number;
  /** Original query string. */
  query: string;
  /** Facet → value → count map (when `facets` are requested). */
  facetDistribution?: Record<string, Record<string, number>>;
  /** Zero-indexed result offset. */
  offset: number;
  /** Requested (or default) limit. */
  limit: number;
  /** Page number (only when using `page`+`hitsPerPage`). */
  page?: number;
  /** Total pages (only when using `page`+`hitsPerPage`). */
  totalPages?: number;
}

// ---------------------------------------------------------------------------
// Index management
// ---------------------------------------------------------------------------

/** Settings that can be applied to an index via {@link MeilisearchClient.configureIndex}. */
export interface IndexSettings {
  /** Fields eligible for full-text search (order matters for ranking). */
  searchableAttributes?: string[];
  /** Fields usable in filter expressions. */
  filterableAttributes?: string[];
  /** Fields usable in sort clauses. */
  sortableAttributes?: string[];
  /** Custom ranking rules applied before the built-in ones. */
  rankingRules?: string[];
  /** Fields returned in search results. */
  displayedAttributes?: string[];
  /** Field used for de-duplication. */
  distinctAttribute?: string;
  /** Words to ignore during indexing and search. */
  stopWords?: string[];
  /** Synonym map. */
  synonyms?: Record<string, string[]>;
  /** Typo-tolerance configuration. */
  typoTolerance?: {
    enabled?: boolean;
    minWordSizeForTypos?: { oneTypo?: number; twoTypos?: number };
    disableOnAttributes?: string[];
    disableOnWords?: string[];
  };
  /** Pagination ceiling. */
  pagination?: { maxTotalHits?: number };
  /** Faceting configuration. */
  faceting?: { maxValuesPerFacet?: number };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Per-index statistics returned by {@link MeilisearchClient.getStats}. */
export interface IndexStats {
  /** Number of documents in this index. */
  numberOfDocuments: number;
  /** Whether the index is currently processing documents. */
  isIndexing: boolean;
  /** Per-field document count distribution. */
  fieldDistribution: Record<string, number>;
}

/** Global instance statistics returned by {@link MeilisearchClient.getStats}. */
export interface SearchStats {
  /** Database size in bytes. */
  databaseSize: number;
  /** ISO-8601 timestamp of the last update. */
  lastUpdate: string;
  /** Per-index statistics keyed by index UID. */
  indexes: Record<string, IndexStats>;
}
