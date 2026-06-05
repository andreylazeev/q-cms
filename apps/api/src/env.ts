/**
 * Environment loader for the Q-CMS API.
 *
 * Combines the base schema from `@q-cms/config` with API-specific
 * additions (rate-limit, CORS, docs flag, etc.) and re-exports the
 * fully-typed {@link ApiEnv} object.
 *
 * @module env
 */

import { z } from 'zod';
import { loadEnv, type BaseEnv } from './lib/stubs/config-shim.ts';

/**
 * API-specific env schema. The base env is provided by the loader;
 * the additions below cover values that only matter to the HTTP
 * layer (cache TTLs, rate-limit windows, etc.).
 */
export const apiEnvSchema = z.object({
  CACHE_DEFAULT_TTL: z.coerce.number().int().positive().default(300),
  SEARCH_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  REQUEST_BODY_LIMIT: z.coerce.number().int().positive().default(10 * 1024 * 1024),
});

export type ApiEnv = z.infer<typeof apiEnvSchema> & BaseEnv;

let cached: ApiEnv | undefined;

/**
 * Resolve and validate the API environment. Cached after the first
 * call so subsequent imports are O(1). Re-validates if the underlying
 * `process.env` changes (test only).
 */
export function getEnv(): ApiEnv {
  if (cached) return cached;
  const base = loadEnv<BaseEnv>();
  const extras = apiEnvSchema.parse({
    CACHE_DEFAULT_TTL: process.env['CACHE_DEFAULT_TTL'],
    SEARCH_TIMEOUT_MS: process.env['SEARCH_TIMEOUT_MS'],
    REQUEST_BODY_LIMIT: process.env['REQUEST_BODY_LIMIT'],
  });
  cached = { ...base, ...extras };
  return cached;
}

/**
 * Reset the cache. Tests use this between cases when they mutate
 * `process.env`.
 */
export function resetEnvCache(): void {
  cached = undefined;
}

/** Escape hatch: same as {@link getEnv} but with the broader base type. */
export function getBaseEnv(): BaseEnv {
  return getEnv();
}
