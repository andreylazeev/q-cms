/**
 * Centralised error handler.
 *
 * - `DomainError` → JSON envelope with its `httpStatus` and `code`.
 * - `ZodError`    → 422 with field-level detail.
 * - everything else → 500 with a generic message and request_id.
 *
 * All unexpected errors are logged with stack + request context.
 *
 * @module middleware/error
 */

import { ZodError, type ZodIssue } from 'zod';
import type { ErrorHandler } from 'hono';
import { DomainError, ValidationError } from '../lib/stubs/core-shim.ts';
import { logger } from '../logger.ts';
import type { JsonApiErrorResponse } from '../lib/jsonapi.ts';

export const errorMiddleware: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') ?? 'unknown';
  const log = logger.child({ request_id: requestId });

  if (err instanceof ZodError) {
    const body: JsonApiErrorResponse = {
      errors: [
        {
          id: requestId,
          status: '422',
          code: 'validation_failed',
          title: 'Validation failed',
          detail: 'One or more fields failed validation',
          meta: { fields: mapZodIssues(err.issues) },
        },
      ],
    };
    return c.json(body, 422);
  }

  if (err instanceof ValidationError) {
    const body: JsonApiErrorResponse = {
      errors: [
        {
          id: requestId,
          status: '400',
          code: 'validation_error',
          title: 'Validation error',
          detail: err.message,
          ...(err.meta ? { meta: err.meta as Record<string, unknown> } : {}),
        },
      ],
    };
    return c.json(body, 400);
  }

  if (err instanceof DomainError) {
    const body: JsonApiErrorResponse = {
      errors: [
        {
          id: requestId,
          status: String(err.httpStatus),
          code: err.code.toLowerCase(),
          title: err.constructor.name.replace(/Error$/, ''),
          detail: err.message,
          ...(Object.keys(err.meta).length > 0 ? { meta: err.meta } : {}),
        },
      ],
    };
    return c.json(body, err.httpStatus as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503);
  }

  // Unknown error — log with stack and return generic 500.
  log.error({ err, stack: err instanceof Error ? err.stack : undefined }, 'Unhandled error');
  const body: JsonApiErrorResponse = {
    errors: [
      {
        id: requestId,
        status: '500',
        code: 'internal_error',
        title: 'Internal Server Error',
        detail: 'An unexpected error occurred',
      },
    ],
  };
  return c.json(body, 500);
};

function mapZodIssues(issues: readonly ZodIssue[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_';
    if (!out[path]) out[path] = [];
    out[path].push(issue.message);
  }
  return out;
}
