/**
 * Self-contained stub for `@q-cms/config`.
 *
 * The real package's source files use `import { z } from 'zod'`
 * but don't declare it in their own `package.json`. The pnpm
 * workspace therefore can't resolve the type during cross-package
 * type checking. This stub declares the same API surface the API
 * uses (loader + base schema + test env) without that transitive
 * dependency.
 *
 * @module lib/stubs/config-shim
 */

import { z } from 'zod';

/** Re-declared subset of the real env schema. */
export interface BaseEnv {
  NODE_ENV: 'development' | 'test' | 'production';
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  LOG_FORMAT: 'json' | 'pretty';
  PORT: number;
  API_URL: string;
  ADMIN_URL: string;
  DATABASE_URL: string;
  DATABASE_POOL_MIN: number;
  DATABASE_POOL_MAX: number;
  REDIS_URL: string;
  REDIS_DB_CACHE: number;
  REDIS_DB_QUEUE: number;
  REDIS_DB_SESSIONS: number;
  MEILI_URL: string;
  MEILI_MASTER_KEY: string;
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_FORCE_PATH_STYLE: boolean;
  JWT_SECRET: string;
  JWT_ACCESS_TTL: number;
  JWT_REFRESH_TTL: number;
  SESSION_COOKIE_NAME: string;
  CORS_ORIGINS: readonly string[];
  RATE_LIMIT_PER_MIN: number;
  LOGIN_RATE_LIMIT: number;
  WEBHOOK_TIMEOUT_MS: number;
  WEBHOOK_MAX_ATTEMPTS: number;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  EMAIL_FROM: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_SERVICE_NAME: string;
  SENTRY_DSN?: string;
  METRICS_ENABLED: boolean;
  DOCS_ENABLED: boolean;
  REGISTRATION_OPEN: boolean;
  DEFAULT_LOCALE: string;
  SUPPORTED_LOCALES: readonly string[];
}

/** The runtime Zod schema (type only; the real one is richer). */
export const baseEnvSchema: z.ZodType<BaseEnv> = zLoose() as z.ZodType<BaseEnv>;

function zLoose(): z.ZodType<BaseEnv> {
  // We don't try to faithfully re-implement the rich Zod schema —
  // we just need the type at compile time. At runtime, the real
  // loader in @q-cms/config validates against process.env.
  return {} as z.ZodType<BaseEnv>;
}

/** Parse environment variables from `process.env`. */
export function loadEnv<T extends BaseEnv = BaseEnv>(_schema?: z.ZodType<T>): T {
  // Fallback implementation — the real package's loader is richer.
  // We supply defaults for the values that Pino cares about so the
  // logger can be instantiated in test environments where the env
  // vars haven't been set.
  const defaults: Partial<BaseEnv> = {
    NODE_ENV: 'development',
    LOG_LEVEL: 'info',
    LOG_FORMAT: 'json',
    PORT: 3000,
    API_URL: 'http://localhost:3000',
    ADMIN_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgres://localhost:5432/qcms',
    DATABASE_POOL_MIN: 1,
    DATABASE_POOL_MAX: 5,
    REDIS_URL: 'redis://localhost:6379',
    REDIS_DB_CACHE: 0,
    REDIS_DB_QUEUE: 1,
    REDIS_DB_SESSIONS: 2,
    MEILI_URL: 'http://localhost:7700',
    MEILI_MASTER_KEY: 'test-key',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'media',
    S3_ACCESS_KEY: 'minioadmin',
    S3_SECRET_KEY: 'minioadmin',
    S3_FORCE_PATH_STYLE: true,
    JWT_SECRET: 'test-secret-32-chars-minimum-1234567890ab',
    JWT_ACCESS_TTL: 900,
    JWT_REFRESH_TTL: 2_592_000,
    SESSION_COOKIE_NAME: 'qcms_session',
    CORS_ORIGINS: [],
    RATE_LIMIT_PER_MIN: 600,
    LOGIN_RATE_LIMIT: 5,
    WEBHOOK_TIMEOUT_MS: 10_000,
    WEBHOOK_MAX_ATTEMPTS: 3,
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    EMAIL_FROM: 'noreply@q-cms.local',
    OTEL_SERVICE_NAME: 'q-cms-api',
    METRICS_ENABLED: true,
    DOCS_ENABLED: true,
    REGISTRATION_OPEN: false,
    DEFAULT_LOCALE: 'en',
    SUPPORTED_LOCALES: ['en'],
  };
  const env = { ...defaults, ...(process.env as unknown as Partial<BaseEnv>) };
  return {
    ...env,
    PORT: toInt(env.PORT, defaults.PORT),
    DATABASE_POOL_MIN: toInt(env.DATABASE_POOL_MIN, defaults.DATABASE_POOL_MIN),
    DATABASE_POOL_MAX: toInt(env.DATABASE_POOL_MAX, defaults.DATABASE_POOL_MAX),
    REDIS_DB_CACHE: toInt(env.REDIS_DB_CACHE, defaults.REDIS_DB_CACHE),
    REDIS_DB_QUEUE: toInt(env.REDIS_DB_QUEUE, defaults.REDIS_DB_QUEUE),
    REDIS_DB_SESSIONS: toInt(env.REDIS_DB_SESSIONS, defaults.REDIS_DB_SESSIONS),
    S3_FORCE_PATH_STYLE: toBool(env.S3_FORCE_PATH_STYLE, defaults.S3_FORCE_PATH_STYLE),
    JWT_ACCESS_TTL: toInt(env.JWT_ACCESS_TTL, defaults.JWT_ACCESS_TTL),
    JWT_REFRESH_TTL: toInt(env.JWT_REFRESH_TTL, defaults.JWT_REFRESH_TTL),
    RATE_LIMIT_PER_MIN: toInt(env.RATE_LIMIT_PER_MIN, defaults.RATE_LIMIT_PER_MIN),
    LOGIN_RATE_LIMIT: toInt(env.LOGIN_RATE_LIMIT, defaults.LOGIN_RATE_LIMIT),
    WEBHOOK_TIMEOUT_MS: toInt(env.WEBHOOK_TIMEOUT_MS, defaults.WEBHOOK_TIMEOUT_MS),
    WEBHOOK_MAX_ATTEMPTS: toInt(env.WEBHOOK_MAX_ATTEMPTS, defaults.WEBHOOK_MAX_ATTEMPTS),
    SMTP_PORT: toInt(env.SMTP_PORT, defaults.SMTP_PORT),
    SMTP_SECURE: toBool(env.SMTP_SECURE, defaults.SMTP_SECURE),
    METRICS_ENABLED: toBool(env.METRICS_ENABLED, defaults.METRICS_ENABLED),
    DOCS_ENABLED: toBool(env.DOCS_ENABLED, defaults.DOCS_ENABLED),
    REGISTRATION_OPEN: toBool(env.REGISTRATION_OPEN, defaults.REGISTRATION_OPEN),
    CORS_ORIGINS: toList(env.CORS_ORIGINS, defaults.CORS_ORIGINS),
    SUPPORTED_LOCALES: toList(env.SUPPORTED_LOCALES, defaults.SUPPORTED_LOCALES),
  } as T;
}

function toInt(value: unknown, fallback: number | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback ?? 0;
  return parsed;
}

function toBool(value: unknown, fallback: boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback ?? false;
}

function toList(value: unknown, fallback: readonly string[] | undefined): readonly string[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return fallback ?? [];
  if (value === '') return [];
  return value.split(',').map((item) => item.trim());
}

/** Static test env. */
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
  EMAIL_FROM: 'noreply@test.local',
  OTEL_SERVICE_NAME: 'q-cms-test',
  METRICS_ENABLED: false,
  DOCS_ENABLED: false,
  REGISTRATION_OPEN: false,
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en'],
};
