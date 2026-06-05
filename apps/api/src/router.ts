/**
 * Top-level Hono router.
 *
 * Mounts every route group under `/api/v1` and wires up the global
 * middleware chain:
 *
 *   request-id → error → logging → cors → observability → auth (per group) → rbac
 *
 * Per-route authentication is applied by mounting each group with
 * `authMiddleware` (or with `rbacMiddleware` for protected groups).
 *
 * @module router
 */

import { Hono } from 'hono';
import { getEnv } from './env.ts';
import { logger } from './logger.ts';

import { requestIdMiddleware } from './middleware/request-id.ts';
import { corsMiddleware } from './middleware/cors.ts';
import { loggingMiddleware } from './middleware/logging.ts';
import { observabilityMiddleware } from './middleware/observability.ts';
import { errorMiddleware } from './middleware/error.ts';
import { authMiddleware } from './middleware/auth.ts';
import { rbacMiddleware } from './middleware/rbac.ts';

import { healthRouter } from './routes/health.ts';
import { authRouter } from './routes/auth.ts';
import { usersRouter } from './routes/users.ts';
import { collectionsRouter } from './routes/collections.ts';
import { entriesRouter, bulkRouter } from './routes/entries.ts';
import { singletonsRouter } from './routes/singletons.ts';
import { mediaRouter } from './routes/media.ts';
import { webhooksRouter } from './routes/webhooks.ts';
import { auditRouter } from './routes/audit.ts';
import { searchRouter } from './routes/search.ts';
import { rolesRouter } from './routes/roles.ts';
import { publicRouter } from './routes/public.ts';
import { templatesRouter } from './routes/templates.ts';
import { publicTemplatesRouter } from './routes/public-templates.ts';
import { openApiSpecHandler, docsHandler } from './openapi.ts';

export type ApiApp = Hono;

/**
 * Build the full API application. Order of middleware matters:
 *
 *  1. request-id — set before any logger can pick it up.
 *  2. error      — catches everything downstream.
 *  3. logging    — wraps each request.
 *  4. cors       — handles preflight before auth.
 *  5. observability — records request counters.
 *  6. auth       — populates `user` / `roles` for protected groups.
 *  7. rbac       — checks per-route permissions.
 */
export function buildRouter(): Hono {
  const env = getEnv();
  const app = new Hono();
  app.onError(errorMiddleware);
  app.use('*', requestIdMiddleware);
  app.use('*', loggingMiddleware);
  app.use('*', corsMiddleware({ allowedOrigins: env.CORS_ORIGINS, credentials: true }));
  app.use('*', observabilityMiddleware);
  app.use('*', authMiddleware);

  // Public health surface.
  app.route('/', healthRouter);
  // Auth surface — login / refresh / magic-link etc. are public; /me needs auth.
  app.route('/api/v1/auth', authRouter);
  // Search is public.
  app.route('/api/v1', searchRouter);
  // Public read-only content surface — no auth, returns only
  // published entries. Powers consumer sites built on Q-CMS.
  app.route('/api/v1/public', publicRouter);
  // Public read-only template surface (no auth). Used by the
  // template engine on the static site.
  app.route('/api/v1/public/templates', publicTemplatesRouter);
  // OpenAPI documents are public; docs UI is gated by DOCS_ENABLED.
  app.get('/api/v1/openapi.json', openApiSpecHandler);
  app.get('/api/v1/docs', docsHandler);
  // Bulk operations — protected.
  app.use('/api/v1/bulk', rbacMiddleware);
  app.route('/api/v1', bulkRouter);

  // Protected groups — auth + rbac.
  const protectedApp = new Hono();
  protectedApp.use('*', rbacMiddleware);
  protectedApp.route('/users', usersRouter);
  protectedApp.route('/collections', collectionsRouter);
  protectedApp.route('/collections/:slug/entries', entriesRouter);
  protectedApp.route('/singletons', singletonsRouter);
  protectedApp.route('/media', mediaRouter);
  protectedApp.route('/webhooks', webhooksRouter);
  protectedApp.route('/audit-log', auditRouter);
  protectedApp.route('/roles', rolesRouter);
  protectedApp.route('/templates', templatesRouter);
  app.route('/api/v1', protectedApp);

  app.notFound((c) =>
    c.json(
      { errors: [{ status: '404', code: 'not_found', title: 'Not Found' }] },
      404,
    ),
  );

  if (env.NODE_ENV !== 'production') {
    logger.debug({ routes: app.routes.length }, 'router built');
  }
  return app;
}
