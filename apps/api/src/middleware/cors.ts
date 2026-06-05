/**
 * CORS middleware.
 *
 * Reads allowed origins from the `CORS_ORIGINS` env variable. When
 * the requesting origin is allowed we set the standard CORS
 * response headers and echo the origin (so cookies/credentials work).
 *
 * @module middleware/cors
 */

import type { MiddlewareHandler } from 'hono';

export interface CorsOptions {
  /** Fully qualified origins allowed to call the API. */
  allowedOrigins: readonly string[];
  /** Allow `Authorization` / `Cookie` headers on cross-origin requests. */
  credentials: boolean;
  /** HTTP methods allowed. */
  methods?: readonly string[];
  /** Request headers allowed. */
  allowedHeaders?: readonly string[];
  /** Response headers exposed to the browser. */
  exposedHeaders?: readonly string[];
  /** Preflight cache duration in seconds. */
  maxAge?: number;
}

const DEFAULT_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] as const;
const DEFAULT_ALLOWED = ['Content-Type', 'Authorization', 'X-Request-ID'] as const;
const DEFAULT_EXPOSED = ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'] as const;

/**
 * Build a CORS middleware bound to the given options.
 */
export function corsMiddleware(opts: CorsOptions): MiddlewareHandler {
  const allowed = new Set(opts.allowedOrigins);
  const methods = opts.methods ?? DEFAULT_METHODS;
  const allowedHeaders = opts.allowedHeaders ?? DEFAULT_ALLOWED;
  const exposedHeaders = opts.exposedHeaders ?? DEFAULT_EXPOSED;
  const maxAge = opts.maxAge ?? 600;

  return async (c, next) => {
    const origin = c.req.header('origin');
    if (origin && allowed.has(origin)) {
      c.header('access-control-allow-origin', origin);
      c.header('vary', 'Origin');
      if (opts.credentials) c.header('access-control-allow-credentials', 'true');
      c.header('access-control-allow-methods', methods.join(', '));
      c.header('access-control-allow-headers', allowedHeaders.join(', '));
      c.header('access-control-expose-headers', exposedHeaders.join(', '));
      c.header('access-control-max-age', String(maxAge));
    }
    if (c.req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: c.res.headers });
    }
    await next();
    return;
  };
}
