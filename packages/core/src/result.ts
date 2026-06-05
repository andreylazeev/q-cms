/**
 * Result / Either type for explicit, exception-free error handling.
 *
 * Inspired by Rust's `Result<T, E>` and fp-ts `Either`. Every fallible
 * operation in `@q-cms` returns a `Result` so callers must consciously
 * handle both branches.
 *
 * @module result
 */

/** A successful outcome carrying `value`. */
export type Ok<T> = { readonly ok: true; readonly value: T };

/** A failed outcome carrying `error`. */
export type Err<E> = { readonly ok: false; readonly error: E };

/** Discriminated union of success and failure. */
export type Result<T, E = Error> = Ok<T> | Err<E>;

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/** Wrap a value in the success branch. */
export function Ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Wrap an error in the failure branch. */
export function Err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/** Transform the success value; leave the error untouched. */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? Ok(fn(result.value)) : result;
}

/** Transform the error value; leave the success untouched. */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : Err(fn(result.error));
}

/** Chain a fallible operation on the success value (flatMap / bind). */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

/** Combine two independent results; first error is used if both fail. */
export function zip<T, U, E>(
  a: Result<T, E>,
  b: Result<U, E>,
): Result<readonly [T, U], E> {
  if (a.ok) {
    if (b.ok) {
      return Ok([a.value, b.value] as const);
    }
    return Err(b.error);
  }
  return Err(a.error);
}

// ---------------------------------------------------------------------------
// Unwrapping
// ---------------------------------------------------------------------------

/** Unwrap the success value or throw the error. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw result.error instanceof Error
    ? result.error
    : new Error(`unwrap on Err: ${String(result.error)}`);
}

/** Unwrap the success value, falling back to `defaultValue` on error. */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

// ---------------------------------------------------------------------------
// Pattern matching
// ---------------------------------------------------------------------------

/** Exhaustively handle both branches of a `Result`. */
export function match<T, E, R>(
  result: Result<T, E>,
  handlers: { ok: (value: T) => R; err: (error: E) => R },
): R {
  return result.ok ? handlers.ok(result.value) : handlers.err(result.error);
}

// ---------------------------------------------------------------------------
// Async / Promise interop
// ---------------------------------------------------------------------------

/** Await a `Promise<T>` and convert rejections into a `Result`. */
export async function fromPromise<T>(
  promise: Promise<T>,
): Promise<Result<T, Error>> {
  try {
    return Ok(await promise);
  } catch (cause) {
    return Err(cause instanceof Error ? cause : new Error(String(cause)));
  }
}

/**
 * Wrap a synchronous throwing function in a `Result`.
 * Useful for adapting third-party APIs that throw.
 */
export function fromThrowable<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    return Ok(fn());
  } catch (cause) {
    return Err(cause as E);
  }
}

/**
 * Run a fallible async thunk; convert rejections into a `Result`.
 * Distinct from `fromPromise` in that it accepts a thunk, so the
 * computation is only triggered if the caller invokes it.
 */
export async function fromAsyncThrowable<T, E = Error>(
  fn: () => Promise<T>,
): Promise<Result<T, E>> {
  try {
    return Ok(await fn());
  } catch (cause) {
    return Err(cause as E);
  }
}
