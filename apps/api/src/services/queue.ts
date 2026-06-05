/**
 * Queue service — BullMQ factory.
 *
 * Provides typed wrappers around the BullMQ queue types we use:
 *   - reindex        (search index sync)
 *   - webhook-delivery (outbound HTTP)
 *   - email          (magic link / notifications)
 *   - image-process  (sharp pipeline)
 *   - audit-cleanup  (housekeeping)
 *
 * In test/development environments without a Redis broker the
 * factory falls back to a no-op queue so routes can call `enqueue`
 * without hanging on a connection retry.
 *
 * @module services/queue
 */

import { Queue, type JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { getEnv } from '../env.ts';

export const QUEUE_NAMES = {
  reindex: 'reindex',
  webhookDelivery: 'webhook-delivery',
  email: 'email',
  imageProcess: 'image-process',
  auditCleanup: 'audit-cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface ReindexJob {
  collection: string;
  entryId?: string;
  action: 'upsert' | 'delete' | 'reindex-all';
}

export interface WebhookDeliveryJob {
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  attempt: number;
}

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
  text: string;
  templateName?: string;
  variables?: Record<string, unknown>;
}

export interface ImageProcessJob {
  mediaId: string;
  storageKey: string;
  variants: readonly string[];
}

export interface AuditCleanupJob {
  olderThanDays: number;
  batchSize: number;
}

export type QueueJobs = {
  reindex: ReindexJob;
  'webhook-delivery': WebhookDeliveryJob;
  email: EmailJob;
  'image-process': ImageProcessJob;
  'audit-cleanup': AuditCleanupJob;
};

interface QueueLike {
  add: (name: string, data: unknown, options: JobsOptions) => Promise<{ id: string | undefined }>;
  close: () => Promise<void>;
}

const queues = new Map<string, QueueLike>();
let usingNoop = false;

function shouldUseNoop(): boolean {
  if (process.env['NODE_ENV'] === 'test') return true;
  if (process.env['DISABLE_QUEUE'] === '1') return true;
  return false;
}

function getConnection(): IORedis {
  const env = getEnv();
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
}

function noopQueue(): QueueLike {
  return {
    async add() {
      return { id: undefined };
    },
    async close() {
      return;
    },
  };
}

/**
 * Get (or lazily create) a BullMQ queue.
 */
export function getQueue<N extends QueueName>(name: N): QueueLike {
  const existing = queues.get(name);
  if (existing) return existing;
  if (shouldUseNoop()) {
    usingNoop = true;
    const q = noopQueue();
    queues.set(name, q);
    return q;
  }
  const queue = new Queue<QueueJobs[N]>(name, { connection: getConnection() });
  const wrapped: QueueLike = {
    add: (n, d, o) =>
      (queue as unknown as {
        add: (n: string, d: unknown, o: JobsOptions) => Promise<{ id: string | undefined }>;
      }).add(n, d, o),
    close: () => queue.close(),
  };
  queues.set(name, wrapped);
  return wrapped;
}

const defaultJobsOptions: JobsOptions = {
  removeOnComplete: 1000,
  removeOnFail: 5000,
  attempts: 3,
  backoff: { type: 'exponential', delay: 1_000 },
};

/**
 * Enqueue a job on the named queue.
 */
export async function enqueue<N extends QueueName>(
  name: N,
  data: QueueJobs[N],
  options: JobsOptions = {},
): Promise<string> {
  const queue = getQueue(name);
  const job = await queue.add(name, data, { ...defaultJobsOptions, ...options });
  return job.id ?? '';
}

/**
 * Gracefully close all queues. Call on shutdown.
 */
export async function closeQueues(): Promise<void> {
  const pending = [...queues.values()].map((q) => q.close());
  queues.clear();
  await Promise.all(pending);
}

/** Test helper: force the queue service into no-op mode. */
export function forceNoopQueue(): void {
  usingNoop = true;
  for (const [, q] of queues) {
    void q.close().catch(() => undefined);
  }
  queues.clear();
}

/** Inspect whether the queue is currently using the no-op stub. */
export function isUsingNoopQueue(): boolean {
  return usingNoop;
}
