/**
 * Worker bootstrap.
 *
 * Spins up one BullMQ Worker per queue, wires the shared Redis
 * connection, and registers a graceful shutdown handler for
 * `SIGTERM` / `SIGINT`.
 *
 * The function returns once the workers are connected. The returned
 * `Shutdown` closure should be invoked from the signal handler to
 * drain in-flight jobs and close the Redis connection cleanly.
 *
 * @module index
 */

import { Worker, type Job } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { logger } from './observability.ts';
import { QUEUES, type QueueName } from './queues.ts';
import { processReindexJob, type ReindexJobData } from './workers/reindex.ts';
import { processWebhookJob, type WebhookJobData } from './workers/webhook.ts';
import { processEmailJob, type EmailJobData } from './workers/email.ts';
import { processImageJob, type ImageProcessJobData } from './workers/image-process.ts';
import { processAuditCleanupJob, type AuditCleanupJobData } from './workers/audit-cleanup.ts';
import { processScheduledPublishJob, type ScheduledPublishJobData } from './workers/scheduled-publish.ts';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const REDIS_DB = Number.parseInt(process.env['REDIS_DB_QUEUE'] ?? '1', 10);
const WORKER_CONCURRENCY = Number.parseInt(process.env['WORKER_CONCURRENCY'] ?? '4', 10);

export interface WorkerHandle {
  workers: readonly Worker[];
  redis: Redis;
  /** Graceful shutdown. */
  shutdown(): Promise<void>;
}

interface JobHandlerMap {
  reindex: ReindexJobData;
  webhook: WebhookJobData;
  email: EmailJobData;
  image: ImageProcessJobData;
  auditCleanup: AuditCleanupJobData;
  scheduledPublish: ScheduledPublishJobData;
}

type HandlerFor<Q extends QueueName> = Q extends 'reindex'
  ? Job<JobHandlerMap['reindex']>
  : Q extends 'webhook-delivery'
    ? Job<JobHandlerMap['webhook']>
    : Q extends 'email'
      ? Job<JobHandlerMap['email']>
      : Q extends 'image'
        ? Job<JobHandlerMap['image']>
        : Q extends 'auditCleanup'
          ? Job<JobHandlerMap['auditCleanup']>
          : Q extends 'scheduledPublish'
            ? Job<JobHandlerMap['scheduledPublish']>
            : never;

const handlers: {
  [Q in QueueName]: { name: Q; concurrency: number; process: (job: HandlerFor<Q>) => Promise<unknown> };
} = {
  reindex: { name: QUEUES.reindex, concurrency: WORKER_CONCURRENCY, process: processReindexJob as (job: HandlerFor<typeof QUEUES.reindex>) => Promise<unknown> },
  [QUEUES.webhook]: { name: QUEUES.webhook, concurrency: WORKER_CONCURRENCY, process: processWebhookJob as (job: HandlerFor<typeof QUEUES.webhook>) => Promise<unknown> },
  email: { name: QUEUES.email, concurrency: Math.max(1, Math.floor(WORKER_CONCURRENCY / 2)), process: processEmailJob as (job: HandlerFor<typeof QUEUES.email>) => Promise<unknown> },
  [QUEUES.image]: { name: QUEUES.image, concurrency: 2, process: processImageJob as (job: HandlerFor<typeof QUEUES.image>) => Promise<unknown> },
  [QUEUES.auditCleanup]: { name: QUEUES.auditCleanup, concurrency: 1, process: processAuditCleanupJob as (job: HandlerFor<typeof QUEUES.auditCleanup>) => Promise<unknown> },
  [QUEUES.scheduledPublish]: { name: QUEUES.scheduledPublish, concurrency: 1, process: processScheduledPublishJob as (job: HandlerFor<typeof QUEUES.scheduledPublish>) => Promise<unknown> },
};

/**
 * Start every worker. Idempotent — calling twice on the same process
 * creates two worker pools (callers should generally not do that).
 */
export function startWorkers(): WorkerHandle {
  const redis = new IORedis(REDIS_URL, { db: REDIS_DB, maxRetriesPerRequest: null });
  const workers: Worker[] = [];
  for (const def of Object.values(handlers)) {
    const worker = new Worker<unknown, unknown>(def.name, async (job) => def.process(job as never), {
      connection: redis,
      concurrency: def.concurrency,
    });
    worker.on('failed', (job, err) => {
      logger.error({ queue: def.name, jobId: job?.id, err: err.message }, 'Job failed');
    });
    worker.on('completed', (job) => {
      logger.debug({ queue: def.name, jobId: job.id }, 'Job completed');
    });
    worker.on('error', (err) => {
      logger.error({ queue: def.name, err: err.message }, 'Worker error');
    });
    workers.push(worker);
    logger.info({ queue: def.name, concurrency: def.concurrency }, 'Worker started');
  }
  return {
    workers,
    redis,
    async shutdown(): Promise<void> {
      logger.info('Graceful shutdown initiated');
      await Promise.all(workers.map(async (w) => w.close()));
      await redis.quit();
      logger.info('Workers stopped');
    },
  };
}

/**
 * Install signal handlers and start workers. Returns the handle so
 * tests can drive shutdown manually.
 */
export function bootstrap(): WorkerHandle {
  const handle = startWorkers();
  let shuttingDown = false;
  const onSignal = (sig: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal: sig }, 'Received signal, shutting down');
    handle.shutdown().then(
      () => process.exit(0),
      (err) => {
        logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Shutdown error');
        process.exit(1);
      },
    );
  };
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
  return handle;
}

// Run when invoked directly (Bun: `bun run src/index.ts`).
if ((import.meta as { main?: boolean }).main) {
  bootstrap();
}
