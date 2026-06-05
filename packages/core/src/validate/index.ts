/**
 * Validation helpers that adapt Zod to Q-CMS conventions.
 *
 * Two flavors:
 * - {@link parseOrThrow} — throws {@link ValidationError} on failure.
 * - {@link safeParse} — returns a `Result` so the caller can branch.
 *
 * @module validate
 */

import type { ZodIssue, ZodSchema, ZodTypeAny } from 'zod';
import type { Result } from '../result.ts';
import { Err, Ok } from '../result.ts';
import { ValidationError } from '../errors/index.ts';
import type { PageInput } from '../types/index.ts';

// ---------------------------------------------------------------------------
// Throwing parse
// ---------------------------------------------------------------------------

/**
 * Parse `input` against `schema`; throw {@link ValidationError} on failure.
 *
 * @param schema - Zod schema describing the expected shape.
 * @param input - Untrusted value to validate.
 * @param ctx - Optional label used in the error message for traceability.
 */
export function parseOrThrow<T extends ZodTypeAny>(
  schema: ZodSchema<T>,
  input: unknown,
  ctx?: string,
): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ValidationError(
    ctx ? `Validation failed for ${ctx}` : 'Validation failed',
    { errors: result.error.issues as ZodIssue[] },
  );
}

// ---------------------------------------------------------------------------
// Result-flavored parse
// ---------------------------------------------------------------------------

/** Parse without throwing; convert failures into `Err(ValidationError)`. */
export function safeParse<T extends ZodTypeAny>(
  schema: ZodSchema<T>,
  input: unknown,
  ctx?: string,
): Result<T, ValidationError> {
  const result = schema.safeParse(input);
  if (result.success) return Ok(result.data);
  return Err(
    new ValidationError(
      ctx ? `Validation failed for ${ctx}` : 'Validation failed',
      { errors: result.error.issues as ZodIssue[] },
    ),
  );
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse a generic query-string pagination payload into a {@link PageInput}.
 *
 * Accepts either a plain object (e.g. parsed by Hono middleware) or a
 * `URLSearchParams` instance. Unknown keys are ignored.
 */
export function paginationParams(
  input: unknown,
): Result<PageInput, ValidationError> {
  if (input === null || input === undefined) {
    return Ok({ limit: DEFAULT_LIMIT, cursor: null, withTotal: false });
  }

  const get = (key: string): string | undefined => {
    if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
    if (typeof input === 'object') {
      const v = (input as Record<string, unknown>)[key];
      if (v === undefined || v === null) return undefined;
      if (typeof v === 'string') return v;
      return String(v);
    }
    return undefined;
  };

  const rawLimit = get('limit');
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== undefined) {
    const n = Number(rawLimit);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      return Err(
        new ValidationError('Invalid pagination limit', {
          field: 'limit',
          value: rawLimit,
        }),
      );
    }
    limit = Math.min(n, MAX_LIMIT);
  }

  const cursor = get('cursor') ?? null;
  const withTotal = get('withTotal') === 'true' || get('withTotal') === '1';

  return Ok({ limit, cursor, withTotal });
}
