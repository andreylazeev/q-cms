/**
 * Per-request access log.
 *
 * Emits a single structured log line per request including method,
 * path, status, duration, and request_id. Levels follow the
 * `pino` convention (warn for 4xx, error for 5xx, info otherwise).
 *
 * @module middleware/logging
 */

import type { MiddlewareHandler } from 'hono';
import { logger, withContext } from '../logger.ts';

export const loggingMiddleware: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  await next();
  const durationMs = Number((performance.now() - start).toFixed(2));
  const status = c.res.status;
  const log = withContext({
    request_id: c.get('requestId') ?? 'unknown',
    method: c.req.method,
    path: c.req.path,
    status,
    duration_ms: durationMs,
    ...(c.get('user') ? { user_id: c.get('user')?.id } : {}),
  });
  if (status >= 500) log.error('request_failed');
  else if (status >= 400) log.warn('request_rejected');
  else log.info('request_completed');
  // Touch the global logger so the import is kept.
  void logger;
};
