/**
 * Scheduled-publish worker.
 *
 * Runs every minute (cron: `* * * * *`) and publishes every entry
 * whose `scheduled_publish_at <= now()` and whose `status` is
 * still `draft`. After publishing, the worker enqueues a reindex
 * job so the search index stays in sync.
 *
 * Idempotent — entries already in `published` state are skipped.
 *
 * @module workers/scheduled-publish
 */

import type { Job } from 'bullmq';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { entryRepo } from '../stubs/db.ts';
import { startJobTimer, withLogger } from '../observability.ts';
import { QUEUES, type QueueName } from '../queues.ts';

/** Payload is empty; the worker scans the DB. */
export interface ScheduledPublishJobData {
  /** Optional override of the current time (for tests). */
  now?: string;
}

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const REDIS_DB = Number.parseInt(process.env.REDIS_DB_QUEUE ?? '1', 10);

let cachedQueue: Queue | undefined;

/**
 * Lazily-construct a BullMQ Queue handle for reindex jobs. The
 * worker bootstrap creates the corresponding consumer; we only
 * need to enqueue here.
 */
function makeReindexQueue(): Queue {
  if (cachedQueue) return cachedQueue;
  const connection = new IORedis(REDIS_URL, { db: REDIS_DB, maxRetriesPerRequest: null });
  cachedQueue = new Queue(QUEUES.reindex, { connection });
  return cachedQueue;
}

/** Reset the cached queue handle. Tests use this between cases. */
export function resetReindexQueue(): void {
  if (cachedQueue) {
    void cachedQueue.close();
    cachedQueue = undefined;
  }
}

export interface ScheduledPublishResult {
  published: number;
  reindexEnqueued: number;
  scannedAt: string;
}

/** Process a single scheduled-publish tick. */
export async function processScheduledPublishJob(
  job: Job<ScheduledPublishJobData>,
): Promise<ScheduledPublishResult> {
  const log = withLogger({ queue: QUEUES.scheduledPublish, jobId: job.id });
  const stop = startJobTimer(QUEUES.scheduledPublish);
  try {
    const now = job.data?.now ? new Date(job.data.now) : new Date();
    const due = await entryRepo.listScheduledDue(now);
    let published = 0;
    let reindexEnqueued = 0;
    const publishedAt = now.toISOString();
    for (const entry of due) {
      await entryRepo.markPublished(entry.id, publishedAt);
      published += 1;
      log.info({ entryId: entry.id, collectionId: entry.collectionId }, 'Entry published');
      // Enqueue a reindex so the search index reflects the change.
      // We do not block on the enqueue; BullMQ handles persistence.
      try {
        const q = makeReindexQueue();
        await q.add(
          `reindex-${entry.id}`,
          { collection: String(entry.collectionId), entryId: entry.id, locale: entry.locale },
          { removeOnComplete: 100, removeOnFail: 100, attempts: 3, backoff: { type: 'exponential', delay: 1_000 } },
        );
        reindexEnqueued += 1;
      } catch (err) {
        // The publish itself succeeded; log the enqueue failure
        // and continue. A future manual reindex will catch up.
        log.warn(
          { err: err instanceof Error ? err.message : String(err), entryId: entry.id },
          'Failed to enqueue reindex after scheduled publish',
        );
      }
    }
    const result: ScheduledPublishResult = {
      published,
      reindexEnqueued,
      scannedAt: publishedAt,
    };
    log.info(result, 'Scheduled publish pass complete');
    stop('ok');
    return result;
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : String(err) }, 'Scheduled publish failed');
    stop('error', err);
    throw err;
  }
}
