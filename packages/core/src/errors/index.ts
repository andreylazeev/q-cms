/**
 * Domain error hierarchy.
 *
 * Every error in Q-CMS extends {@link DomainError}, which carries:
 * - `code` — stable machine identifier (e.g. `NOT_FOUND`).
 * - `httpStatus` — suggested HTTP status when surfaced from the API.
 * - `meta` — optional structured context for logging.
 *
 * @module errors
 */

/** Base class for every domain-level error in Q-CMS. */
export class DomainError extends Error {
  /** Stable machine identifier; safe to use in switch statements. */
  public readonly code: string;
  /** Recommended HTTP status code if the error bubbles to the API. */
  public readonly httpStatus: number;
  /** Optional structured context for logging / audit. */
  public readonly meta: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    httpStatus: number,
    meta: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.meta = meta;
    // Maintain prototype chain when targeting older runtimes.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Return a JSON-safe serialization including the prototype chain. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      meta: this.meta,
    };
  }
}

/** Input failed validation (Zod, manual, business rules). */
export class ValidationError extends DomainError {
  constructor(
    message: string,
    meta: Record<string, unknown> = {},
  ) {
    super(message, 'VALIDATION_ERROR', 400, meta);
  }
}

/** Requested resource was not found. */
export class NotFoundError extends DomainError {
  constructor(
    message: string,
    meta: Record<string, unknown> = {},
  ) {
    super(message, 'NOT_FOUND', 404, meta);
  }
}

/** Request conflicts with current resource state (e.g. unique constraint). */
export class ConflictError extends DomainError {
  constructor(
    message: string,
    meta: Record<string, unknown> = {},
  ) {
    super(message, 'CONFLICT', 409, meta);
  }
}

/** Authentication required or credentials invalid. */
export class UnauthorizedError extends DomainError {
  constructor(
    message: string,
    meta: Record<string, unknown> = {},
  ) {
    super(message, 'UNAUTHORIZED', 401, meta);
  }
}

/** Authenticated but not allowed to perform the action. */
export class ForbiddenError extends DomainError {
  constructor(
    message: string,
    meta: Record<string, unknown> = {},
  ) {
    super(message, 'FORBIDDEN', 403, meta);
  }
}

/** Caller exceeded an allowed rate. */
export class RateLimitError extends DomainError {
  constructor(
    message: string,
    meta: Record<string, unknown> = {},
  ) {
    super(message, 'RATE_LIMIT', 429, meta);
  }
}

/** A branded primitive constructor received malformed input. */
export class InvalidBrandError extends DomainError {
  constructor(
    brand: string,
    detail: string,
    meta: Record<string, unknown> = {},
  ) {
    super(`Invalid ${brand}: ${detail}`, 'INVALID_BRAND', 400, { brand, ...meta });
  }
}

/** Catch-all for unexpected internal failures. */
export class InternalError extends DomainError {
  constructor(
    message: string,
    meta: Record<string, unknown> = {},
  ) {
    super(message, 'INTERNAL_ERROR', 500, meta);
  }
}
