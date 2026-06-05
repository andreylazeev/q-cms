/**
 * Reindex worker.
 *
 * Consumes the `reindex` queue. For each job it:
 *   1. Fetches the entry from the database (stub in dev).
 *   2. Transforms it into a flat search document.
 *   3. Sends the document to Meilisearch (or logs if not configured).
 *
 * The job is retried up to 3 times with exponential backoff; on the
 * final failure the job is moved to the failed state with a clear
 * error message.
 *
 * @module workers/reindex
 */

import type { Job } from 'bullmq';
import { entryRepo, MEILI_MASTER_KEY, MEILI_URL, searchClient } from '../stubs/db.ts';
import { logger, startJobTimer, withLogger } from '../observability.ts';
import { QUEUES } from '../queues.ts';

/**
 * Payload accepted by the reindex worker.
 *
 * @property collection - Collection slug (used as the Meili index name).
 * @property entryId - UUID of the entry to reindex.
 * @property locale - Locale code (mixed into the document id so the
 *   same entry in different locales lives as separate docs).
 */
export interface ReindexJobData {
  collection: string;
  entryId: string;
  locale: string;
}

/** Default Meili primary key. */
const MEILI_PRIMARY_KEY = 'id';

/**
 * Flatten an entry's `data` object into a search document. Only the
 * scalar leaves of `data` are kept — nested objects become string
 * blobs (callers can pre-flatten if they need a richer index).
 */
function toSearchDocument(entry: {
  id: string;
  slug: string | null;
  locale: string;
  status: string;
  data: Record<string, unknown>;
  publishedAt: string | null;
}): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entry.data)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      flat[k] = v;
    } else {
      flat[k] = JSON.stringify(v);
    }
  }
  return {
    id: `${entry.id}::${entry.locale}`,
    entryId: entry.id,
    slug: entry.slug,
    locale: entry.locale,
    status: entry.status,
    publishedAt: entry.publishedAt,
    ...flat,
  };
}

/** Send a document to Meilisearch via the REST API. */
async function indexInMeili(
  indexName: string,
  doc: Record<string, unknown>,
): Promise<void> {
  if (!MEILI_URL) {
    logger.info({ indexName, docId: doc.id }, 'MEILI_URL not set; skipping meili index');
    return;
  }
  const res = await fetch(`${MEILI_URL.replace(/\/$/, '')}/indexes/${indexName}/documents?primaryKey=${MEILI_PRIMARY_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(MEILI_MASTER_KEY ? { Authorization: `Bearer ${MEILI_MASTER_KEY}` } : {}),
    },
    body: JSON.stringify([doc]),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meilisearch index POST failed: ${res.status} ${text}`);
  }
}

/**
 * Process a single reindex job. Idempotent — re-running with the
 * same payload overwrites the existing document.
 */
export async function processReindexJob(job: Job<ReindexJobData>): Promise<void> {
  const log = withLogger({ queue: QUEUES.reindex, jobId: job.id, ...job.data });
  const stop = startJobTimer(QUEUES.reindex);
  try {
    const { collection, entryId, locale } = job.data;
    if (!collection || !entryId || !locale) {
      throw new Error('Reindex job missing required fields: collection, entryId, locale');
    }
    const entry = await entryRepo.findById(entryId);
    if (!entry) {
      // Treat as a no-op rather than an error: the entry may have
      // been deleted between enqueue and processing. The producer
      // is expected to enqueue a delete job in that case.
      log.info({ entryId }, 'Entry not found; skipping reindex');
      stop('ok');
      return;
    }
    const doc = toSearchDocument({
      id: entry.id,
      slug: entry.slug,
      locale: entry.locale,
      status: entry.status,
      data: (entry.data ?? {}) as Record<string, unknown>,
      publishedAt: entry.publishedAt,
    });
    // Push to both the real Meili instance (if configured) AND the
    // stub for tests / local development.
    await indexInMeili(collection, doc);
    await searchClient.index(collection, doc);
    log.info({ entryId, locale }, 'Reindex complete');
    stop('ok');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, 'Reindex job failed');
    stop('error', err);
    throw err;
  }
}
