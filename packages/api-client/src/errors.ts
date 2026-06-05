import type { ApiError } from './types.js';

/** Structured HTTP error surfaced by {@link ApiClient}. */
export class ApiClientError extends Error {
  /** HTTP status code (4xx, 5xx). */
  public readonly status: number;
  /** Parsed or raw response body. */
  public readonly body: unknown;
  /** Full URL that was requested. */
  public readonly url: string;

  constructor({ status, body, url }: ApiError) {
    super(`API request failed: ${status} ${url}`);
    this.name = 'ApiClientError';
    this.status = status;
    this.body = body;
    this.url = url;
  }

  /** `true` when the server returned HTTP 401. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** `true` when the server returned HTTP 403. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** `true` when the server returned HTTP 404. */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** `true` when the server returned HTTP 429. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** `true` for 5xx status codes (server error). */
  get isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }
}
