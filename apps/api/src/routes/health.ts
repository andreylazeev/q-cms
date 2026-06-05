/**
 * Health-check routes.
 *
 * - `GET /api/v1/health` — liveness; always 200 while the process runs.
 * - `GET /api/v1/ready`  — readiness; pings Postgres / Redis / Meili.
 * - `GET /api/v1/metrics` — Prometheus exposition.
 *
 * @module routes/health
 */

import { Hono } from 'hono';
import { getEnv } from '../env.ts';
import { metricsHandler } from '../metrics.ts';
import { healthChecks } from '../lib/stubs/index.ts';

const startedAt = Date.now();

export const healthRouter = new Hono();

/**
 * Liveness probe. Returns 200 with uptime if the process is running.
 */
healthRouter.get('/health', (c) =>
  c.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    service: getEnv().OTEL_SERVICE_NAME,
  }),
);

/**
 * Readiness probe. Pings downstream services and returns 503 if any
 * of them is unhealthy.
 */
healthRouter.get('/ready', async (c) => {
  const [pg, redis, meili] = await Promise.all([
    healthChecks.postgres().catch((err) => ({ ok: false as const, error: String(err) })),
    healthChecks.redis().catch((err) => ({ ok: false as const, error: String(err) })),
    healthChecks.meilisearch().catch((err) => ({ ok: false as const, error: String(err) })),
  ]);
  const checks = {
    postgres: pg.ok ? `ok (${pg.latencyMs}ms)` : `error: ${pg.error}`,
    redis: redis.ok ? `ok (${redis.latencyMs}ms)` : `error: ${redis.error}`,
    meilisearch: meili.ok ? `ok (${meili.latencyMs}ms)` : `error: ${meili.error}`,
  };
  const allOk = pg.ok && redis.ok && meili.ok;
  return c.json({ status: allOk ? 'ok' : 'degraded', checks }, allOk ? 200 : 503);
});

/** Prometheus exposition. Public — no auth. */
healthRouter.get('/metrics', () => metricsHandler());
