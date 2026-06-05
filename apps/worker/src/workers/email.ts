/**
 * Email worker.
 *
 * Consumes the `email` queue. For each job it sends a transactional
 * email via Nodemailer SMTP and updates the corresponding
 * `email_queue` row's status.
 *
 * Status transitions:
 *   - `pending` → `sent`   on a 2xx SMTP response
 *   - `pending` → `failed` on a transport error (BullMQ retries)
 *
 * After `attempts` the row is left in `failed` with the last error
 * captured.
 *
 * @module workers/email
 */

import type { Job } from 'bullmq';
import nodemailer, { type Transporter } from 'nodemailer';
import { emailQueueRepo } from '../stubs/db.ts';
import { startJobTimer, withLogger } from '../observability.ts';
import { QUEUES } from '../queues.ts';

/**
 * Payload accepted by the email worker.
 *
 * @property id - UUID of the `email_queue` row to update.
 * @property to - Recipient email address.
 * @property subject - Subject line.
 * @property html - HTML body.
 * @property text - Plaintext body (fallback for non-HTML clients).
 * @property from - Optional override of the SMTP `from` envelope.
 * @property attempts - Maximum number of attempts (defaults to 3).
 */
export interface EmailJobData {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  attempts?: number;
}

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'noreply@q-cms.local';

let cachedTransporter: Transporter | undefined;

/**
 * Build (or reuse) a Nodemailer SMTP transporter. The transporter
 * is connection-pooled by Nodemailer; we keep it as a module-level
 * singleton so multiple jobs reuse the same TCP connection.
 */
export function makeTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number.parseInt(process.env.SMTP_PORT ?? '1025', 10),
    secure: process.env.SMTP_SECURE === 'true',
    ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } } : {}),
  });
  return cachedTransporter;
}

/** Reset the cached transporter. Tests use this between cases. */
export function resetTransporter(): void {
  cachedTransporter?.close();
  cachedTransporter = undefined;
}

/**
 * Process a single email job. Throwing triggers BullMQ retry; the
 * final failure leaves the row in `failed`.
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const log = withLogger({ queue: QUEUES.email, jobId: job.id, ...job.data });
  const stop = startJobTimer(QUEUES.email);
  try {
    const { id, to, subject, html, text } = job.data;
    if (!id || !to || !subject) {
      throw new Error('Email job missing required fields: id, to, subject');
    }
    const transporter = makeTransporter();
    const from = job.data.from ?? DEFAULT_FROM;
    const info = await transporter.sendMail({ from, to, subject, html, text });
    await emailQueueRepo.updateStatus(id, 'sent', { sentAt: new Date().toISOString() });
    log.info({ to, subject, messageId: info.messageId }, 'Email sent');
    stop('ok');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const max = job.data.attempts ?? DEFAULT_ATTEMPTS;
    const exhausted = job.attemptsMade + 1 >= max;
    log.warn({ err: message, exhausted, attempt: job.attemptsMade + 1 }, 'Email send failed');
    if (exhausted) {
      await emailQueueRepo.updateStatus(job.data.id, 'failed', { lastError: message });
      stop('exhausted', err);
    } else {
      // Bump the attempt counter; the final update is left to the
      // exhausted branch.
      const existing = await emailQueueRepo.findById(job.data.id);
      if (existing) {
        await emailQueueRepo.updateStatus(job.data.id, 'pending', {
          lastError: message,
          attempts: (existing.attempts ?? 0) + 1,
        });
      }
      stop('retry', err);
    }
    throw err;
  }
}
