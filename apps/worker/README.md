# @q-cms/worker

BullMQ background workers for Q-CMS. Consumes six queues and
processes them with one worker pool per queue.

## Queues

| Name | Cron / trigger | Responsibility |
| --- | --- | --- |
| `reindex` | on demand | Push a single entry into the search index. |
| `webhook-delivery` | on demand | POST a signed payload to a webhook URL. |
| `email` | on demand | Send a transactional email via SMTP. |
| `image-process` | on demand | Generate 8 image variants (Sharp) and upload to S3. |
| `audit-cleanup` | daily 03:00 UTC | Delete `audit_log` rows older than `AUDIT_RETENTION_DAYS`. |
| `scheduled-publish` | every minute | Publish entries whose `scheduled_publish_at <= now()`. |

## Running

```bash
bun run dev          # watch mode
bun run build        # bundle to dist/
bun run start        # run the bundled worker
bun run typecheck    # tsc --noEmit
bun run test         # unit tests
```

## Environment

The worker reads the same env schema as the API (`@q-cms/config`)
plus a few worker-specific values:

| Var | Default | Notes |
| --- | --- | --- |
| `REDIS_URL` | `redis://localhost:6379` | Shared with the API. |
| `REDIS_DB_QUEUE` | `1` | BullMQ database. |
| `WORKER_CONCURRENCY` | `4` | Per-queue concurrency. |
| `WEBHOOK_TIMEOUT_MS` | `10000` | Per-attempt HTTP timeout. |
| `WEBHOOK_MAX_ATTEMPTS` | `3` | Retries on 5xx / network. |
| `AUDIT_RETENTION_DAYS` | `365` | Cutoff for the cleanup job. |
| `MEILI_URL` | — | Empty disables real Meili indexing (logs only). |
| `S3_*` | — | Endpoint, region, bucket, credentials. |

## Graceful shutdown

`bootstrap()` installs `SIGTERM` and `SIGINT` handlers. On signal
the workers stop accepting new jobs, drain the in-flight set, and
close the Redis connection before exiting.

## Idempotency

Every job is safe to re-run:

- Reindex overwrites the document at `(collection, entryId, locale)`.
- Webhook delivery records a `webhook_deliveries` row per attempt.
- Email updates the `email_queue` row by `id`.
- Image processing is keyed by `(mediaId, variantName, format)`.
- Audit cleanup only deletes rows strictly older than the cutoff.
- Scheduled-publish skips entries that are already `published`.

## Local stubs

The `@q-cms/db`, `@q-cms/search`, and `@q-cms/media` packages are
not yet built. While they're in flight, the workers import local
in-memory stand-ins from `src/stubs/db.ts` so unit tests can run
without Postgres / Meili / S3. Once the real packages are
published, switch the imports back and remove the stub module.
