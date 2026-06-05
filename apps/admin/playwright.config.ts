import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Q-CMS admin app.
 *
 * - `baseURL` defaults to the dev server port (`3001`) so commands
 *   like `page.goto('/login')` work without a full URL.
 * - Tests are colocated under `e2e/`.
 * - We use the project's local `webServer` hook so a fresh
 *   `next dev` is started (and torn down) per test run.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3001',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
