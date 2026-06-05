/**
 * Pino logger configured from environment variables.
 *
 * - `LOG_LEVEL` controls verbosity (default `info`).
 * - `LOG_FORMAT=pretty` switches to a human-friendly transport; otherwise
 *   we emit JSON suitable for Vector / Promtail → Loki.
 *
 * The logger is a process-wide singleton; modules import it directly.
 *
 * @module logger
 */

import pino, { type Logger, type LoggerOptions } from 'pino';
import { getEnv } from './env.ts';

const env = getEnv();

const baseOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: {
    service: env.OTEL_SERVICE_NAME,
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
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

/** Lazily-evaluated pretty transport (kept out of the test path). */
function buildLogger(): Logger {
  if (env.LOG_FORMAT === 'pretty' && env.NODE_ENV !== 'production') {
    return pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
      },
    });
  }
  return pino(baseOptions);
}

/** Shared logger instance. */
export const logger: Logger = buildLogger();

/**
 * Build a child logger with a bound context (request_id, user_id, ...).
 * Use this in middleware and request handlers instead of mutating the
 * global logger.
 */
export function withContext(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

export type { Logger };
