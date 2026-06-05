/**
 * General-purpose utility functions used across Q-CMS packages.
 */

// ---------------------------------------------------------------------------
// String
// ---------------------------------------------------------------------------

/**
 * Convert a string to a URL-friendly slug.
 * Lowercases, replaces non-alphanumeric / non-hyphen characters with hyphens,
 * collapses consecutive hyphens, and trims leading / trailing hyphens.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Truncate `value` to `maxLength` characters, appending "…" when truncated.
 * Returns the original string when `value.length <= maxLength`.
 */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength) + "\u2026";
}

// ---------------------------------------------------------------------------
// Object
// ---------------------------------------------------------------------------

/**
 * Pick the specified `keys` from `obj`, returning a new object.
 * Keys that do not exist on `obj` are silently omitted.
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Return a shallow copy of `obj` without the specified `keys`.
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Omit<T, K> {
  const keySet = new Set<string>(keys as readonly string[]);
  const result = {} as Omit<T, K>;
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (!keySet.has(key as string)) {
      (result as Record<string, unknown>)[key as string] = obj[key];
    }
  }
  return result;
}

/**
 * Deep merge `source` into `target`. Arrays are replaced (not merged).
 * Mutates `target` and returns it.
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
      deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      (target as Record<string, unknown>)[key] = sourceVal;
    }
  }
  return target;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && Object.prototype.toString.call(value) === "[object Object]";
}

// ---------------------------------------------------------------------------
// Bytes
// ---------------------------------------------------------------------------

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

/**
 * Format a byte count into a human-readable string (e.g. "1.5 MB").
 * Uses binary (1024) units. Returns "0 B" for `bytes <= 0`.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const tier = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  const scaled = bytes / 1024 ** tier;
  const precision = scaled < 10 ? 1 : 0;
  return `${scaled.toFixed(precision)} ${BYTE_UNITS[tier]!}`;
}

// ---------------------------------------------------------------------------
// Equality
// ---------------------------------------------------------------------------

/**
 * Deep equality check for primitives, arrays, and plain objects.
 * Returns `false` for different prototypes or uncomparable types.
 */
export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return false;

  const isArrA = Array.isArray(a);
  const isArrB = Array.isArray(b);
  if (isArrA !== isArrB) return false;

  if (isArrA && isArrB) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) {
      if (!isDeepEqual(arrA[i], arrB[i])) return false;
    }
    return true;
  }

  // Plain objects
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !isDeepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }
  return true;
}
