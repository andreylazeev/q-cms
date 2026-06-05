/**
 * Shared repository utilities.
 *
 * Error-handling policy:
 *
 * - **`find*` methods** return `Result<T, NotFoundError>` so callers
 *   explicitly branch on "missing" without try/catch noise.
 * - **Mutation methods** (`create`, `update`, `delete`) throw on
 *   unexpected database errors (constraint violations, connection
 *   loss). They map known unique-constraint violations to
 *   `ConflictError` via {@link mapUniqueViolation}.
 *
 * Rationale: writes are usually "happy-path" with a single expected failure
 * shape (the unique constraint), whereas reads frequently model "not
 * found" as a normal control-flow outcome.
 */

import { ConflictError, InternalError, NotFoundError } from '@q-cms/core/errors';
import { Err, Ok, type Result } from '@q-cms/core/result';

/**
 * Postgres unique-constraint violation SQLSTATE. We treat it as a domain
 * `ConflictError` so callers can recover gracefully.
 */
const PG_UNIQUE_VIOLATION = '23505';

/** Inspect an unknown error and return a typed `DomainError` if possible. */
export function toDomainError(err: unknown): Error {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: unknown }).code);
    if (code === PG_UNIQUE_VIOLATION) {
      return new ConflictError('Unique constraint violation', {
        cause: errorMessage(err),
      });
    }
  }
  if (err instanceof Error) {
    return new InternalError(err.message, { cause: errorMessage(err) });
  }
  return new InternalError(String(err));
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Wrap a throwing read into a `Result`. */
export async function tryFind<T>(
  fn: () => Promise<T | null | undefined>,
  resource: string,
): Promise<Result<T, NotFoundError>> {
  try {
    const value = await fn();
    if (value === null || value === undefined) {
      return Err(new NotFoundError(`${resource} not found`));
    }
    return Ok(value);
  } catch (cause) {
    const err = toDomainError(cause);
    if (err instanceof NotFoundError) return Err(err);
    throw err;
  }
}
