/**
 * Audit-log cleanup worker.
 *
 * Runs once a day (cron: `0 3 * * *`) and deletes every row in
 * `audit_log` whose `occurred_at` is older than
 * `AUDIT_RETENTION_DAYS` (default 365).
 *
 * Idempotent — re-running on the same day is a no-op once the
 * cutoff has been reached.
 *
 * @module workers/audit-cleanup
 */

import type { Job } from 'bullmq';
import { deleteAuditOlderThan } from '../stubs/db.ts';
import { startJobTimer, withLogger } from '../observability.ts';
import { QUEUES } from '../queues.ts';

/**
 * Payload accepted by the audit-cleanup worker.
 *
 * @property retentionDays - Override the retention window (defaults
 *   to the `AUDIT_RETENTION_DAYS` env var or 365).
 */
export interface AuditCleanupJobData {
  retentionDays?: number;
}

/** Default retention window, in days. */
const DEFAULT_RETENTION_DAYS = Number.parseInt(process.env.AUDIT_RETENTION_DAYS ?? '365', 10);

/** Process a single audit-cleanup job. */
export async function processAuditCleanupJob(
  job: Job<AuditCleanupJobData>,
): Promise<{ deleted: number; cutoff: string }> {
  const log = withLogger({ queue: QUEUES.auditCleanup, jobId: job.id });
  const stop = startJobTimer(QUEUES.auditCleanup);
  try {
    const days = job.data?.retentionDays ?? DEFAULT_RETENTION_DAYS;
    if (!Number.isInteger(days) || days <= 0) {
      throw new Error(`Invalid retentionDays: ${days}`);
    }
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deleted = await deleteAuditOlderThan(cutoff);
    log.info({ deleted, cutoff: cutoff.toISOString(), days }, 'Audit log cleanup complete');
    stop('ok');
    return { deleted, cutoff: cutoff.toISOString() };
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : String(err) }, 'Audit cleanup failed');
    stop('error', err);
    throw err;
  }
}
