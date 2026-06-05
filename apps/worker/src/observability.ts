/**
 * Per-worker observability: Pino logger + Prometheus metrics.
 *
 * Each worker registers itself on startup and gets a child logger
 * and dedicated counter/histogram pair. The registry is exported
 * so the worker's `/metrics` endpoint (or a sidecar scraper) can
 * pull the exposition format.
 *
 * @module observability
 */

import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import pino, { type Logger, type LoggerOptions } from 'pino';

/**
 * Process-wide Prometheus registry. Workers register their metrics
 * here so that the aggregator can expose them in one place.
 */
export const registry = new Registry();

/** Default Node.js metrics (CPU, RSS, event loop lag, GC, etc.). */
collectDefaultMetrics({ register: registry });

/**
 * Per-worker jobs-processed counter. Labels: `queue` + `outcome`
 * (`ok` | `error` | `retry` | `exhausted`).
 */
export const jobsProcessedTotal = new Counter({
  name: 'qcms_worker_jobs_processed_total',
  help: 'Total number of jobs processed by the worker pool.',
  labelNames: ['queue', 'outcome'] as const,
  registers: [registry],
});

/**
 * Per-worker job-duration histogram in seconds. Buckets cover the
 * realistic span from fast webhooks (10ms) to slow image processing
 * (30s).
 */
export const jobDurationSeconds = new Histogram({
  name: 'qcms_worker_job_duration_seconds',
  help: 'Job processing duration in seconds, by queue.',
  labelNames: ['queue', 'outcome'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [registry],
});

/** Per-queue failure counter. */
export const jobErrorsTotal = new Counter({
  name: 'qcms_worker_job_errors_total',
  help: 'Total number of failed jobs, by queue and error type.',
  labelNames: ['queue', 'error'] as const,
  registers: [registry],
});

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const LOG_FORMAT = process.env.LOG_FORMAT ?? 'json';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? 'q-cms-worker';

const baseOptions: LoggerOptions = {
  level: LOG_LEVEL,
  base: { service: SERVICE_NAME, env: process.env.NODE_ENV ?? 'development' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'password',
      '*.password',
      'token',
      '*.token',
      'jwt',
      '*.jwt',
    ],
    censor: '[REDACTED]',
  },
};

/** Shared worker logger. */
export const logger: Logger =
  LOG_FORMAT === 'pretty' && process.env.NODE_ENV !== 'production'
    ? pino({
        ...baseOptions,
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      })
    : pino(baseOptions);

/** Build a child logger with worker-specific bindings. */
export function withLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

// ---------------------------------------------------------------------------
// Timing helper
// ---------------------------------------------------------------------------

/**
 * Record a job's outcome. Wraps the call site in a timing helper
 * that observes the histogram and increments the counter pair.
 *
 * @example
 * ```ts
 * const stop = startJobTimer('reindex');
 * try { await work(); stop('ok'); }
 * catch (e) { stop('error', e); throw e; }
 * ```
 */
export function startJobTimer(
  queue: string,
): (outcome: 'ok' | 'error' | 'retry' | 'exhausted', err?: unknown) => void {
  const end = jobDurationSeconds.startTimer({ queue, outcome: 'pending' });
  return (outcome, err) => {
    end({ queue, outcome });
    jobsProcessedTotal.inc({ queue, outcome });
    if (outcome === 'error' || outcome === 'exhausted') {
      const message = err instanceof Error ? err.message : String(err ?? 'unknown');
      jobErrorsTotal.inc({ queue, error: classifyError(message) });
    }
  };
}

function classifyError(message: string): string {
  // Coarse bucketing — keep cardinality low for Prometheus.
  if (/timeout|aborted/i.test(message)) return 'timeout';
  if (/network|fetch|connect|econnrefused|enotfound/i.test(message)) return 'network';
  if (/not found|404/i.test(message)) return 'not_found';
  if (/auth|401|403/i.test(message)) return 'auth';
  return 'other';
}
