/**
 * Vitest configuration — integration tests using Testcontainers.
 *
 * Spins up an ephemeral PostgreSQL instance, applies the schema, runs the
 * integration suite, and tears the container down. Invoke with:
 * ```sh
 * pnpm test:integration
 * ```
 */

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const coreSrc = resolve(__dirname, '../core/src');

export default defineConfig({
  resolve: {
    alias: {
      '@q-cms/core': coreSrc,
      '@q-cms/core/result': resolve(coreSrc, 'result.ts'),
      '@q-cms/core/errors': resolve(coreSrc, 'errors/index.ts'),
      '@q-cms/core/types': resolve(coreSrc, 'types/index.ts'),
      '@q-cms/core/branded': resolve(coreSrc, 'branded.ts'),
      '@q-cms/core/validate': resolve(coreSrc, 'validate/index.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    environment: 'node',
    globals: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    sequence: {
      concurrent: false,
    },
  },
});
