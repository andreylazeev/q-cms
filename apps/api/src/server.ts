/**
 * HTTP server entry point.
 *
 * - `createApp(env)` returns a `Hono` instance ready to serve.
 * - `start()` boots the server on `env.PORT` and wires graceful
 *   shutdown for SIGTERM / SIGINT.
 *
 * @module server
 */

import { serve } from '@hono/node-server';
import { buildRouter } from './router.ts';
import { getEnv, type ApiEnv } from './env.ts';
import { logger } from './logger.ts';
import { closeCache } from './services/cache.ts';
import { closeEmail } from './services/email.ts';
import { closeSearch } from './services/search.ts';
import { closeQueues } from './services/queue.ts';
import { seedIfEmpty } from './lib/stubs/db.ts';

/** Public factory used by tests and embedding hosts. */
export function createApp(env: ApiEnv = getEnv()) {
  // env is accepted for API symmetry; the env is also pulled lazily
  // by the route modules. We pass it down for future use (e.g. to
  // choose rate-limit policies).
  void env;
  return buildRouter();
}

/** Boot the HTTP server. */
export async function start(): Promise<void> {
  const env = getEnv();
  // Seed the in-memory stub with realistic demo data so the admin
  // renders populated screens out of the box. Idempotent — no-op after
  // the first call.
  await seedIfEmpty();
  const app = createApp(env);
  const server = serve(
    { fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' },
    (info) => {
      logger.info({ port: info.port, address: info.address }, 'http server listening');
    },
  );
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    server.close();
    await Promise.allSettled([closeCache(), closeEmail(), closeSearch(), closeQueues()]);
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

// Run when executed directly (`bun src/server.ts`).
const isMain = (() => {
  if (typeof process === 'undefined') return false;
  const argv1 = process.argv[1];
  if (!argv1) return false;
  return import.meta.url === `file://${argv1}` || argv1.endsWith('server.ts') || argv1.endsWith('server.js');
})();

if (isMain) {
  start().catch((err) => {
    logger.error({ err }, 'failed to start server');
    process.exit(1);
  });
}
