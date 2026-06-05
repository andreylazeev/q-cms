/**
 * Queue name registry for BullMQ.
 *
 * The names defined here are the single source of truth used by the
 * worker bootstrap, the API producers, and the integration tests.
 * Re-exporting this object as a `const` allows callers to do
 * exhaustive `switch (queueName)` checks against the union.
 *
 * @module queues
 */

/**
 * Canonical names of every BullMQ queue the worker process consumes.
 * Keep this object read-only (`as const`) — runtime mutation would
 * break producer/consumer alignment across the cluster.
 */
export const QUEUES = {
  /** Reindex a single entry into the search index. */
  reindex: 'reindex',
  /** Deliver an outbound webhook POST. */
  webhook: 'webhook-delivery',
  /** Send a transactional email via SMTP. */
  email: 'email',
  /** Process an uploaded image (resize, format, blur). */
  image: 'image-process',
  /** Daily cleanup of the audit log. */
  auditCleanup: 'audit-cleanup',
  /** Minute-by-minute publish pass for scheduled entries. */
  scheduledPublish: 'scheduled-publish',
} as const;

/** Union of all queue names. */
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Default Redis database number used for BullMQ queues. */
export const QUEUE_DB = 1 as const;
