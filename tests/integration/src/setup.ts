/**
 * Testcontainers setup for integration tests.
 * Spins up Postgres, Redis, Meilisearch, MinIO once and shares across all tests.
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

export interface TestInfra {
  postgres: StartedPostgreSqlContainer;
  redis: StartedTestContainer;
  meilisearch: StartedTestContainer;
  minio: StartedTestContainer;
  cleanup: () => Promise<void>;
}

let infra: TestInfra | undefined;

export async function startInfra(): Promise<TestInfra> {
  if (infra) return infra;

  console.log('🐳 Starting test infrastructure (Postgres, Redis, Meilisearch, MinIO)...');

  // Postgres
  const postgres = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('qcms_test')
    .withUsername('qcms')
    .withPassword('qcms')
    .withCommand(['postgres', '-c', 'shared_buffers=128MB', '-c', 'fsync=off', '-c', 'synchronous_commit=off'])
    .start();
  console.log(`  ✓ Postgres on ${postgres.getConnectionUri()}`);

  // Init extensions
  const connStr = postgres.getConnectionUri();
  execSync(
    `psql "${connStr}" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "pgcrypto"; CREATE EXTENSION IF NOT EXISTS "citext";'`,
    { stdio: 'ignore' }
  );

  // Redis
  const redis = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withCommand(['redis-server', '--save', '', '--appendonly', 'no'])
    .start();
  console.log(`  ✓ Redis on ${redis.getHost()}:${redis.getMappedPort(6379)}`);

  // Meilisearch
  const meilisearch = await new GenericContainer('getmeili/meilisearch:v1.10')
    .withExposedPorts(7700)
    .withEnvironment({
      MEILI_MASTER_KEY: 'test-master-key',
      MEILI_NO_ANALYTICS: 'true',
      MEILI_ENV: 'development',
    })
    .start();
  await sleep(2000); // wait for Meilisearch to be ready
  console.log(`  ✓ Meilisearch on ${meilisearch.getHost()}:${meilisearch.getMappedPort(7700)}`);

  // MinIO
  const minio = await new GenericContainer('minio/minio:latest')
    .withExposedPorts(9000)
    .withEnvironment({
      MINIO_ROOT_USER: 'minioadmin',
      MINIO_ROOT_PASSWORD: 'minioadmin',
    })
    .withCommand(['server', '/data'])
    .start();
  await sleep(3000); // wait for MinIO to be ready
  console.log(`  ✓ MinIO on ${minio.getHost()}:${minio.getMappedPort(9000)}`);

  // Apply migrations
  console.log('  ⏳ Applying migrations...');
  try {
    execSync('pnpm --filter @q-cms/db migrate', {
      env: { ...process.env, DATABASE_URL: connStr },
      stdio: 'pipe',
    });
    console.log('  ✓ Migrations applied');
  } catch (e) {
    console.warn('  ⚠ Migration apply failed (will rely on schema push):', (e as Error).message);
  }

  // Set env vars
  process.env.DATABASE_URL = connStr;
  process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;
  process.env.MEILI_URL = `http://${meilisearch.getHost()}:${meilisearch.getMappedPort(7700)}`;
  process.env.MEILI_MASTER_KEY = 'test-master-key';
  process.env.S3_ENDPOINT = `http://${minio.getHost()}:${minio.getMappedPort(9000)}`;
  process.env.S3_BUCKET = 'qcms-test';
  process.env.S3_ACCESS_KEY = 'minioadmin';
  process.env.S3_SECRET_KEY = 'minioadmin';
  process.env.S3_FORCE_PATH_STYLE = 'true';
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-1234567890';
  process.env.NODE_ENV = 'test';

  infra = {
    postgres,
    redis,
    meilisearch,
    minio,
    cleanup: async () => {
      console.log('🐳 Stopping test infrastructure...');
      await Promise.allSettled([postgres.stop(), redis.stop(), meilisearch.stop(), minio.stop()]);
      infra = undefined;
    },
  };

  return infra;
}

/**
 * Truncate all tables for test isolation.
 */
export async function truncateAll(): Promise<void> {
  if (!infra) return;
  const connStr = infra.postgres.getConnectionUri();
  execSync(
    `psql "${connStr}" -c "
      TRUNCATE TABLE
        audit_log,
        entry_comments,
        entry_relations,
        entry_revisions,
        entries,
        collections,
        media_tag_assignments,
        media_tags,
        media_variants,
        media,
        media_folders,
        webhook_deliveries,
        webhooks,
        email_queue,
        email_templates,
        user_roles,
        role_permissions,
        api_tokens,
        sessions,
        users,
        roles,
        permissions
      RESTART IDENTITY CASCADE;
    "`,
    { stdio: 'ignore' }
  );
}
