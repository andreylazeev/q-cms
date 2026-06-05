import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest config for all packages and apps.
 * Individual packages can extend this.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    passWithNoTests: true,
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.d.ts',
        '**/index.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@q-cms/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
      '@q-cms/auth': new URL('./packages/auth/src/index.ts', import.meta.url).pathname,
      '@q-cms/db': new URL('./packages/db/src/index.ts', import.meta.url).pathname,
      '@q-cms/sdk': new URL('./packages/sdk/src/index.ts', import.meta.url).pathname,
      '@q-cms/api-client': new URL('./packages/api-client/src/index.ts', import.meta.url).pathname,
      '@q-cms/schema': new URL('./packages/schema/src/index.ts', import.meta.url).pathname,
    },
  },
});
