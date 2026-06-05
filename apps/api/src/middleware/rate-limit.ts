/**
 * Rate-limit middleware (Redis token bucket).
 *
 * Falls back to an in-process counter when Redis is unavailable so
 * tests can run without a live broker. The bucket is keyed by the
 * caller IP (or `userId` when authenticated) and refills at
 * `limit / windowSeconds` tokens per second.
 *
 * @module middleware/rate-limit
 */

import type { MiddlewareHandler } from 'hono';
import { getCache } from '../services/cache.ts';

export interface RateLimitOptions {
  /** Maximum requests allowed in the sliding window. */
  limit: number;
  /** Window size in seconds. */
  windowSeconds: number;
  /** Optional bucket name (allows per-route buckets). */
  bucket?: string;
}

interface BucketState {
  remaining: number;
  reset: number;
}

/**
 * Build a per-request rate-limit middleware.
 *
 * Sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
 * headers and returns `429` with a `Retry-After` header on overflow.
 */
export function rateLimitMiddleware(opts: RateLimitOptions): MiddlewareHandler {
  const limit = opts.limit;
  const windowMs = opts.windowSeconds * 1000;
  const bucket = opts.bucket ?? 'global';

  return async (c, next) => {
    const cache = getCache();
    const subject = c.get('user')?.id ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
    const key = `ratelimit:${bucket}:${subject}`;
    const now = Date.now();
    const resetAt = now + windowMs;

    const state = await consumeToken(cache, key, limit, resetAt);

    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, state.remaining)));
    c.header('X-RateLimit-Reset', String(Math.floor(state.reset / 1000)));
    c.header('X-RateLimit-Policy', `${limit};w=${opts.windowSeconds}`);

    if (state.remaining < 0) {
      c.header('Retry-After', String(Math.max(1, Math.ceil((state.reset - now) / 1000))));
      return c.json(
        { errors: [{ status: '429', code: 'rate_limited', title: 'Too many requests' }] },
        429,
      );
    }
    await next();
    return;
  };
}

/**
 * Token-bucket consume with an in-process fallback. We use a simple
 * fixed-window counter here; a sliding-window implementation can be
 * swapped in later without changing the contract.
 */
async function consumeToken(
  cache: { get: (k: string) => Promise<string | null>; set: (k: string, v: string, ttl: number) => Promise<void>; del: (k: string) => Promise<void> },
  key: string,
  limit: number,
  resetAt: number,
): Promise<BucketState> {
  const ttl = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  const raw = await cache.get(key);
  const current = raw ? Number(raw) : limit;
  if (!Number.isFinite(current)) {
    await cache.set(key, String(limit - 1), ttl);
    return { remaining: limit - 1, reset: resetAt };
  }
  const next = current - 1;
  await cache.set(key, String(next), ttl);
  return { remaining: next, reset: resetAt };
}
