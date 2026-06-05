/**
 * Shared config helpers for Q-CMS packages.
 * Loads and validates environment variables using Zod schemas.
 */

import { z } from 'zod';

/**
 * Schema for required environment variables across all packages.
 * Each app may extend this with its own env schema.
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  PORT: z.coerce.number().int().positive().default(3000),
  API_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_URL: z.string().url().default('http://localhost:3001'),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(20),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  REDIS_DB_CACHE: z.coerce.number().int().min(0).max(15).default(0),
  REDIS_DB_QUEUE: z.coerce.number().int().min(0).max(15).default(1),
  REDIS_DB_SESSIONS: z.coerce.number().int().min(0).max(15).default(2),

  MEILI_URL: z.string().url().default('http://localhost:7700'),
  MEILI_MASTER_KEY: z.string().min(1),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('false'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),
  SESSION_COOKIE_NAME: z.string().default('qcms_session'),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) => (v === '' ? [] : v.split(',').map((o) => o.trim()))),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(600),
  LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(5),

  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@q-cms.local'),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('q-cms-api'),
  SENTRY_DSN: z.string().url().optional(),

  METRICS_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),

  DOCS_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),
  REGISTRATION_OPEN: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('false'),

  DEFAULT_LOCALE: z.string().length(2).default('en'),
  SUPPORTED_LOCALES: z
    .string()
    .default('en')
    .transform((v) => v.split(',').map((s) => s.trim())),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * Parse environment variables, throwing a helpful error if validation fails.
 * Cached after first parse so subsequent imports are O(1).
 */
let cachedEnv: BaseEnv | undefined;

export function loadEnv<T extends BaseEnv = BaseEnv>(schema = baseEnvSchema): T {
  if (cachedEnv) return cachedEnv as T;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv as T;
}

/**
 * Test environment (in-memory defaults; safe for unit tests).
 */
export const testEnv: BaseEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  LOG_FORMAT: 'json',
  PORT: 0,
  API_URL: 'http://localhost:0',
  ADMIN_URL: 'http://localhost:0',
  DATABASE_URL: 'postgres://test:test@localhost:5432/test',
  DATABASE_POOL_MIN: 1,
  DATABASE_POOL_MAX: 5,
  REDIS_URL: 'redis://localhost:6379',
  REDIS_DB_CACHE: 15,
  REDIS_DB_QUEUE: 14,
  REDIS_DB_SESSIONS: 13,
  MEILI_URL: 'http://localhost:7700',
  MEILI_MASTER_KEY: 'test-master-key',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'test-bucket',
  S3_ACCESS_KEY: 'test',
  S3_SECRET_KEY: 'test',
  S3_FORCE_PATH_STYLE: true,
  JWT_SECRET: 'test-secret-32-chars-minimum-1234567890ab',
  JWT_ACCESS_TTL: 900,
  JWT_REFRESH_TTL: 2_592_000,
  SESSION_COOKIE_NAME: 'qcms_session_test',
  CORS_ORIGINS: [],
  RATE_LIMIT_PER_MIN: 1000,
  LOGIN_RATE_LIMIT: 100,
  WEBHOOK_TIMEOUT_MS: 1000,
  WEBHOOK_MAX_ATTEMPTS: 1,
  SMTP_HOST: 'localhost',
  SMTP_PORT: 1025,
  SMTP_SECURE: false,
  SMTP_USER: undefined,
  SMTP_PASS: undefined,
  EMAIL_FROM: 'noreply@test.local',
  OTEL_EXPORTER_OTLP_ENDPOINT: undefined,
  OTEL_SERVICE_NAME: 'q-cms-test',
  SENTRY_DSN: undefined,
  METRICS_ENABLED: false,
  DOCS_ENABLED: false,
  REGISTRATION_OPEN: false,
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en'],
};
