# `@q-cms/api`

Hono HTTP API for Q-CMS. Exposes the REST surface documented in
[`API.md`](../../API.md) plus the Prometheus metrics, health probes
and OpenAPI 3.1 spec mandated by [`SPEC.md`](../../SPEC.md).

## Quick start

```bash
# Install workspace dependencies
pnpm install

# Run in dev (auto-reload via Bun)
pnpm --filter @q-cms/api dev

# Type-check
pnpm --filter @q-cms/api typecheck

# Unit + integration tests
pnpm --filter @q-cms/api test
```

The server binds to `PORT` (default `3000`) and serves everything
under `/api/v1`. Visit:

- `GET /api/v1/health`     — liveness
- `GET /api/v1/ready`      — readiness (pings Postgres/Redis/Meili)
- `GET /api/v1/metrics`    — Prometheus exposition
- `GET /api/v1/openapi.json` — OpenAPI 3.1 spec
- `GET /api/v1/docs`       — Swagger UI (gated by `DOCS_ENABLED`)

## Environment

All configuration is loaded by `@q-cms/config` (see `.env.example`
at the repo root). The API layer extends the base schema with:

| Var | Default | Purpose |
|---|---|---|
| `CACHE_DEFAULT_TTL` | `300` | Redis TTL for list views (seconds) |
| `SEARCH_TIMEOUT_MS` | `5000` | Meilisearch search timeout |
| `REQUEST_BODY_LIMIT` | `10485760` | Max upload size (bytes) |

Plus the standard base env (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, …).

## Architecture

```
src/
├── server.ts          # createApp() + start()
├── router.ts          # mounts all groups under /api/v1
├── openapi.ts         # 3.1 spec + Swagger UI
├── env.ts             # Zod-validated env (extends @q-cms/config)
├── logger.ts          # Pino logger (JSON or pretty)
├── metrics.ts         # prom-client registry + counters/histograms
├── middleware/        # request-id, cors, error, auth, rbac, rate-limit, ...
├── routes/            # auth, users, collections, entries, media, ...
├── services/          # cache, queue, search, email
└── lib/
    ├── zod-helpers.ts # pagination/filter/sort/locale schemas
    ├── jsonapi.ts     # JSON:API serialize/parse helpers
    └── stubs/         # temporary local shims for @q-cms/auth and @q-cms/db
```

The middleware order is fixed in `router.ts` and is, in priority
order:

1. `requestIdMiddleware` — attaches `X-Request-ID`
2. `errorMiddleware`     — maps `DomainError` / `ZodError` to JSON envelopes
3. `loggingMiddleware`   — per-request access log
4. `corsMiddleware`      — origin allowlist + preflight
5. `observabilityMiddleware` — Prometheus counters
6. `authMiddleware`      — populates `c.get('user')` / `roles`
7. `rbacMiddleware`      — checks per-route `c.get('require')` permission

The protected groups (users, entries, media, webhooks, roles,
singletons, audit, collections) all run behind the `rbac` middleware.

## Stubs

`@q-cms/auth` and `@q-cms/db` are being built in parallel by other
agents. The API imports from `apps/api/src/lib/stubs/` instead of
the workspace packages so it compiles independently. **When the real
packages land, replace the imports and delete `lib/stubs/`.** The
stub layer mirrors the public surface the API relies on:

- **auth stub** — `hashPassword`, `verifyPassword`, `signJwt`,
  `verifyJwt`, `mintApiToken`, `hashApiToken`, `require`, plus
  TOTP magic-link helpers.
- **db stub**   — in-memory implementations of `userRepo`,
  `entryRepo`, `mediaRepo`, `webhookRepo`, `auditRepo`, `roleRepo`,
  `collectionRepo`, `singletonRepo`, `sessionRepo`, plus a
  `healthChecks` triple that always reports `ok`.

## Tests

- `pnpm test`               — all tests (Vitest, single-thread)
- `pnpm test:unit`          — unit tests only
- `pnpm test:integration`   — integration subset
- `pnpm test:coverage`      — V8 coverage report

Test suites:

- `test/middleware/error.test.ts`   — DomainError + ZodError mapping
- `test/middleware/cors.test.ts`    — origin allowlist
- `test/middleware/rate-limit.test.ts` — 429 on overflow
- `test/routes/health.test.ts`      — health/ready/metrics
- `test/routes/entries.test.ts`     — full CRUD + publish + bulk
- `test/routes/auth.test.ts`        — login, refresh, me
- `test/openapi.test.ts`            — spec is valid JSON, has all paths

## Production deployment

The server is Bun-first but the runtime-neutral Hono app can be
served from Node 22 LTS via `@hono/node-server` (already a
dependency). A typical Docker invocation:

```bash
docker run -d --name qcms-api \
  -e DATABASE_URL=postgres://... \
  -e REDIS_URL=redis://... \
  -e MEILI_URL=http://meili:7700 \
  -e MEILI_MASTER_KEY=... \
  -e S3_ENDPOINT=... -e S3_BUCKET=... \
  -e S3_ACCESS_KEY=... -e S3_SECRET_KEY=... \
  -e JWT_SECRET=... \
  -p 3000:3000 qcms/api:1.0
```
