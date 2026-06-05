import { defineConfig } from 'vitest/config';

/**
 * Integration tests config — uses testcontainers for Postgres/Redis/Meilisearch/MinIO.
 * Tests in this config are slow and require Docker. Run with `pnpm test:integration`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    teardownTimeout: 30_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // share containers across files
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',
    },
  },
});
