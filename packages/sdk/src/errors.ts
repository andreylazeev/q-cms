/**
 * SDK error hierarchy.
 *
 * Every public method in the SDK throws one of these on failure.
 * They are independent from `@q-cms/core`'s `DomainError` because
 * the SDK is a network boundary; the API may return arbitrary
 * status codes that need to be mapped to a small, stable set of
 * classes consumers can `instanceof` against.
 *
 * @module errors
 */

import type { SdkApiError } from './types.ts';

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

/** Base class for every error thrown by the SDK. */
export class QcmsError extends Error {
  /** Stable machine code (e.g. `validation_failed`, `unauthorized`). */
  public readonly code: string;
  /** HTTP status code returned by the server, or 0 if the request never reached it. */
  public readonly httpStatus: number;
  /** Optional structured context for logging. */
  public readonly meta: Record<string, unknown>;
  /** Raw API error object, when available. */
  public readonly apiError: SdkApiError | null;

  constructor(
    message: string,
    code: string,
    httpStatus: number,
    apiError: SdkApiError | null = null,
    meta: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.apiError = apiError;
    this.meta = meta;
    // Restore prototype chain for `instanceof` after transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** JSON-safe representation. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      meta: this.meta,
      apiError: this.apiError,
    };
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** 401 — token missing, expired, or otherwise invalid. */
export class QcmsAuthError extends QcmsError {
  constructor(message: string, apiError: SdkApiError | null = null, meta: Record<string, unknown> = {}) {
    super(message, 'unauthorized', 401, apiError, meta);
  }
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

/** 403 — authenticated but not allowed to perform the action. */
export class QcmsForbiddenError extends QcmsError {
  constructor(message: string, apiError: SdkApiError | null = null, meta: Record<string, unknown> = {}) {
    super(message, 'forbidden', 403, apiError, meta);
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** 400/422 — request payload failed validation. */
export class QcmsValidationError extends QcmsError {
  /** Per-field error messages, e.g. `{ slug: ['must be unique'] }`. */
  public readonly fields: Record<string, string[]>;

  constructor(
    message: string,
    fields: Record<string, string[]> = {},
    apiError: SdkApiError | null = null,
    meta: Record<string, unknown> = {},
  ) {
    super(message, 'validation_failed', 422, apiError, { ...meta, ['fields']: fields });
    this.fields = fields;
  }
}

// ---------------------------------------------------------------------------
// Not found
// ---------------------------------------------------------------------------

/** 404 — resource does not exist (or caller cannot see it). */
export class QcmsNotFoundError extends QcmsError {
  constructor(message: string, apiError: SdkApiError | null = null, meta: Record<string, unknown> = {}) {
    super(message, 'not_found', 404, apiError, meta);
  }
}

// ---------------------------------------------------------------------------
// Conflict
// ---------------------------------------------------------------------------

/** 409 — uniqueness violation or stale `If-Match` / version. */
export class QcmsConflictError extends QcmsError {
  constructor(message: string, apiError: SdkApiError | null = null, meta: Record<string, unknown> = {}) {
    super(message, 'conflict', 409, apiError, meta);
  }
}

// ---------------------------------------------------------------------------
// Rate limit
// ---------------------------------------------------------------------------

/** 429 — caller exceeded an allowed rate. */
export class QcmsRateLimitError extends QcmsError {
  /** Seconds to wait before retrying, parsed from `Retry-After` if present. */
  public readonly retryAfter: number | null;

  constructor(
    message: string,
    retryAfter: number | null = null,
    apiError: SdkApiError | null = null,
    meta: Record<string, unknown> = {},
  ) {
    super(message, 'rate_limited', 429, apiError, { ...meta, ['retryAfter']: retryAfter });
    this.retryAfter = retryAfter;
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

/** 5xx — generic server-side failure. May be retried by the SDK. */
export class QcmsServerError extends QcmsError {
  constructor(message: string, httpStatus: number, apiError: SdkApiError | null = null, meta: Record<string, unknown> = {}) {
    super(message, 'server_error', httpStatus, apiError, meta);
  }
}

// ---------------------------------------------------------------------------
// Network / transport
// ---------------------------------------------------------------------------

/** Network failure, DNS error, or abort. */
export class QcmsNetworkError extends QcmsError {
  constructor(message: string, cause?: unknown) {
    super(message, 'network_error', 0, null, cause ? { cause: String(cause) } : {});
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a parsed API error to the most specific QcmsError subclass. */
export function mapApiError(
  httpStatus: number,
  apiError: SdkApiError | null,
  fallbackMessage: string,
): QcmsError {
  const message = apiError?.detail ?? apiError?.title ?? fallbackMessage;
  const meta: Record<string, unknown> = apiError?.meta ?? {};
  switch (httpStatus) {
    case 401:
      return new QcmsAuthError(message, apiError, meta);
    case 403:
      return new QcmsForbiddenError(message, apiError, meta);
    case 404:
      return new QcmsNotFoundError(message, apiError, meta);
    case 409:
      return new QcmsConflictError(message, apiError, meta);
    case 422:
    case 400: {
      const rawFields = (meta['fields'] ?? {}) as Record<string, string[]>;
      return new QcmsValidationError(message, rawFields, apiError, meta);
    }
    case 429: {
      const ra = (meta['retryAfter'] ?? null) as number | null;
      return new QcmsRateLimitError(message, ra, apiError, meta);
    }
    default:
      if (httpStatus >= 500) {
        return new QcmsServerError(message, httpStatus, apiError, meta);
      }
      return new QcmsError(message, apiError?.code ?? 'unknown', httpStatus, apiError, meta);
  }
}
