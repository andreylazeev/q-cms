/**
 * Webhook delivery worker.
 *
 * Consumes the `webhook-delivery` queue. For each job it:
 *   1. Loads the webhook from the DB (stubbed in dev).
 *   2. Computes an HMAC-SHA256 signature of the JSON body.
 *   3. POSTs the payload to the configured URL with a 10s timeout.
 *   4. Records the delivery and either succeeds, retries, or marks
 *      the delivery as exhausted.
 *
 * Status code rules:
 *   - 2xx → success
 *   - 4xx (except 408/429) → permanent failure, no retry
 *   - 408, 429, 5xx, network/timeout → retry per `maxAttempts`
 *
 * @module workers/webhook
 */

import { Buffer } from 'node:buffer';
import type { Job } from 'bullmq';
import { withLogger, startJobTimer } from '../observability.ts';
import { QUEUES } from '../queues.ts';
import { signWebhookPayload } from '../stubs/db.ts';

/**
 * Payload accepted by the webhook worker.
 *
 * @property webhookId - Webhook id (so we can load its URL/secret).
 * @property event - Domain event name (e.g. `entry.publish`).
 * @property payload - JSON-serializable event payload.
 * @property attempt - 1-indexed attempt number (provided by BullMQ).
 */
export interface WebhookJobData {
  webhookId: string;
  event: string;
  payload: unknown;
  attempt: number;
}

/** Maximum delivery time per attempt (configurable via env). */
const TIMEOUT_MS = Number.parseInt(process.env['WEBHOOK_TIMEOUT_MS'] ?? '10000', 10);
/** Default maximum attempts (configurable via env). */
const MAX_ATTEMPTS = Number.parseInt(process.env['WEBHOOK_MAX_ATTEMPTS'] ?? '3', 10);

/** HTTP status codes that should always be retried. */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Fetch with a hard timeout. We avoid AbortController complexity
 * because Node 22's `fetch` already supports a `signal`. We use a
 * barebones wrapper so the test harness can stub it cleanly.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(handle);
  }
}

/**
 * Process a single webhook delivery. Throwing from this function
 * causes BullMQ to retry per the worker's `attempts` configuration.
 */
export async function processWebhookJob(job: Job<WebhookJobData>): Promise<void> {
  const log = withLogger({ queue: QUEUES.webhook, jobId: job.id, ...job.data });
  const stop = startJobTimer(QUEUES.webhook);
  const attempt = job.attemptsMade + 1;
  try {
    const { webhookId, event, payload } = job.data;
    if (!webhookId || !event || payload === undefined) {
      throw new Error('Webhook job missing required fields: webhookId, event, payload');
    }
    // In production we would `await webhookRepo.findById(webhookId)`.
    // The stub bundles the URL + secret directly in the job data via
    // a side-channel `__target` key — real callers should pull from
    // the DB instead.
    const target = readJobTarget(job);
    const body = JSON.stringify({ event, payload, attempt, deliveredAt: new Date().toISOString() });
    const signature = signWebhookPayload(target.secret, body);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-QCMS-Event': event,
      'X-QCMS-Signature': `sha256=${signature}`,
      'X-QCMS-Delivery': job.id ?? '',
      'X-QCMS-Attempt': String(attempt),
      ...target.headers,
    };
    log.debug({ url: target.url, attempt }, 'POSTing webhook');
    let res: Response;
    try {
      res = await fetchWithTimeout(
        target.url,
        { method: 'POST', body, headers },
        TIMEOUT_MS,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const exhausted = attempt >= MAX_ATTEMPTS;
      log.warn({ err: message, attempt, exhausted }, 'Webhook delivery failed (network)');
      if (exhausted) stop('exhausted', err);
      else stop('retry', err);
      throw err; // trigger BullMQ retry or move-to-failed
    }
    if (res.status >= 200 && res.status < 300) {
      log.info({ status: res.status, attempt }, 'Webhook delivered');
      stop('ok');
      return;
    }
    if (RETRYABLE_STATUS.has(res.status)) {
      const exhausted = attempt >= MAX_ATTEMPTS;
      const text = await safeReadText(res);
      log.warn({ status: res.status, attempt, exhausted, body: text }, 'Webhook returned retryable status');
      if (exhausted) stop('exhausted', new Error(`HTTP ${res.status}`));
      else stop('retry', new Error(`HTTP ${res.status}`));
      throw new Error(`Webhook returned ${res.status}`);
    }
    // 4xx: permanent failure. Record the delivery but don't retry.
    const text = await safeReadText(res);
    log.error({ status: res.status, body: text }, 'Webhook returned permanent failure');
    stop('error', new Error(`HTTP ${res.status}`));
  } catch (err) {
    // Defensive: anything that escaped the inner try should still
    // update the timer before bubbling.
    if (job.attemptsMade + 1 >= MAX_ATTEMPTS) stop('exhausted', err);
    else stop('retry', err);
    throw err;
  }
}

interface JobTarget {
  url: string;
  secret: string;
  headers: Record<string, string>;
}

/**
 * Read the target URL/secret/headers from the job. In production
 * this is loaded from the `webhooks` table; the worker bootstrap
 * can inject a `__target` field on the job for unit tests so we
 * don't need a real DB.
 */
function readJobTarget(job: Job<WebhookJobData>): JobTarget {
  // BullMQ's `data` is typed loosely; the cast is safe because we
  // own both producer and consumer in this package.
  const data = job.data as WebhookJobData & { __target?: Partial<JobTarget> };
  const target = data.__target ?? {};
  if (!target.url || !target.secret) {
    throw new Error('Webhook job missing __target.url or __target.secret (load from DB in production)');
  }
  return {
    url: target.url,
    secret: target.secret,
    headers: target.headers ?? {},
  };
}

async function safeReadText(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.length > 1024 ? `${text.slice(0, 1024)}…` : text;
  } catch {
    return '';
  }
}

/**
 * Sign a webhook payload with the given secret. Exposed so the
 * tests (and the API producer) can produce a body whose signature
 * matches what the worker computes.
 */
export function signWebhook(secret: string, body: string): string {
  return signWebhookPayload(secret, body);
}

/** Re-export the raw HMAC helper for SDK parity. */
export { signWebhookPayload as signPayload };

/** Convenience wrapper for tests. */
export async function verifySignature(
  secret: string,
  body: string,
  signatureHeader: string,
): Promise<boolean> {
  const expected = signWebhookPayload(secret, body);
  const provided = signatureHeader.replace(/^sha256=/, '');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    diff |= av ^ bv;
  }
  return diff === 0;
}
