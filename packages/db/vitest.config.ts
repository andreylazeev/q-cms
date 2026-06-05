/**
 * Vitest configuration — unit tests only.
 *
 * Integration tests live in `test/integration/*` and use a separate config
 * (see `vitest.integration.config.ts`) so they can spin up Testcontainers
 * without slowing the default `pnpm test` loop.
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
    exclude: ['test/integration/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
    globals: false,
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/scripts/**', 'src/**/*.d.ts'],
    },
  },
});
