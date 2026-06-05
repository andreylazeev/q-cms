/**
 * Observability middleware.
 *
 * Records request count + duration to the Prometheus registry.
 * Skips the metrics endpoint itself to avoid cardinality loops.
 *
 * @module middleware/observability
 */

import type { MiddlewareHandler } from 'hono';
import { recordHttpRequest } from '../metrics.ts';

export const observabilityMiddleware: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  await next();
  const duration = (performance.now() - start) / 1000;
  const route = c.req.routePath || c.req.path;
  // Skip metric scraping itself to keep the counter from drifting.
  if (route === '/api/v1/metrics') return;
  recordHttpRequest(c.req.method, route, c.res.status, duration);
};
