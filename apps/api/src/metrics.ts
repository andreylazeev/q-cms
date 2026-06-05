/**
 * Prometheus metrics registry.
 *
 * Exposes the counters and histograms required by SPEC §16.1 plus a
 * {@link metricsHandler} factory for serving the `/metrics` endpoint.
 *
 * @module metrics
 */

import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();

/** Default Node.js process metrics (CPU, RSS, event loop lag, etc.). */
collectDefaultMetrics({ register: registry });

/** Total HTTP requests labelled by method, route, and status code. */
export const httpRequestsTotal = new Counter({
  name: 'qcms_http_requests_total',
  help: 'Total number of HTTP requests processed.',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

/**
 * Histogram of request latency in seconds. Buckets cover the realistic
 * range from cache hits (5ms) to slow writes (5s) per SPEC §16.1.
 */
export const httpRequestDurationSeconds = new Histogram({
  name: 'qcms_http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

/** Total DB operations. */
export const dbQueriesTotal = new Counter({
  name: 'qcms_db_queries_total',
  help: 'Total number of database operations executed.',
  labelNames: ['operation', 'table'] as const,
  registers: [registry],
});

/** Cache hits labelled by layer (l1 | l2 | l3). */
export const cacheHitsTotal = new Counter({
  name: 'qcms_cache_hits_total',
  help: 'Total number of cache hits.',
  labelNames: ['layer'] as const,
  registers: [registry],
});

/** Cache misses labelled by layer (l1 | l2 | l3). */
export const cacheMissesTotal = new Counter({
  name: 'qcms_cache_misses_total',
  help: 'Total number of cache misses.',
  labelNames: ['layer'] as const,
  registers: [registry],
});

/**
 * Serialize the current registry state in Prometheus exposition format.
 * Returned as a `Response` so Hono can mount it directly.
 */
export async function metricsHandler(): Promise<Response> {
  const body = await registry.metrics();
  return new Response(body, {
    status: 200,
    headers: { 'content-type': registry.contentType },
  });
}

/** Increment HTTP request counters. Safe to call concurrently. */
export function recordHttpRequest(
  method: string,
  route: string,
  status: number,
  durationSeconds: number,
): void {
  const labels = { method, route, status: String(status) };
  httpRequestsTotal.inc(labels);
  httpRequestDurationSeconds.observe(labels, durationSeconds);
}

/** Increment a DB query counter. */
export function recordDbQuery(operation: string, table: string): void {
  dbQueriesTotal.inc({ operation, table });
}

/** Increment a cache hit/miss counter. */
export function recordCacheHit(layer: 'l1' | 'l2' | 'l3'): void {
  cacheHitsTotal.inc({ layer });
}

export function recordCacheMiss(layer: 'l1' | 'l2' | 'l3'): void {
  cacheMissesTotal.inc({ layer });
}
