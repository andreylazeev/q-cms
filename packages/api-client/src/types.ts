/**
 * API client types — config, responses, errors.
 */
import type { Locale } from '@q-cms/core';

/** Configuration passed to {@link ApiClient}. */
export interface ApiClientConfig {
  /** Base URL of the CMS API (e.g. `https://cms.example.com/api/v1`). */
  baseUrl: string;
  /** Optional bearer token for authenticated requests. */
  token?: string;
}

/** Standard paginated response envelope from the API. */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/** Shape of error responses returned by the API. */
export interface ApiError {
  status: number;
  body: unknown;
  url: string;
}

/** Options available on most API calls. */
export interface RequestOptions {
  /** {@link AbortSignal} for cancelling the underlying fetch. */
  signal?: AbortSignal;
  /** Locale to pass as a query parameter (`?locale=…`). */
  locale?: Locale;
}
