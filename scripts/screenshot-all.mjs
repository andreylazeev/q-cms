/**
 * Screenshot all Q-CMS admin pages with headless Chromium.
 *
 * Bypasses real auth (the in-memory stub has no seeded user) by
 * setting the `qcms_token` cookie and the `q-cms-admin:auth`
 * localStorage entry. Pages will render their shell + empty/error
 * states, which is what we want to verify visually.
 */
import { chromium } from '/Users/andrey/Desktop/projects/q-cms/apps/admin/node_modules/playwright/index.mjs';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'screenshots');
const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3001';
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

/** Pages to capture, with optional wait selectors. */
const PAGES = [
  { name: '01-login', path: '/login', auth: false, waitFor: '[data-testid="login-form"]' },
  { name: '02-dashboard', path: '/', auth: true, waitFor: 'body' },
  { name: '03-collections', path: '/collections', auth: true, waitFor: 'body' },
  { name: '04-collection-articles', path: '/collections/articles', auth: true, waitFor: 'body' },
  { name: '05-collection-articles-new', path: '/collections/articles/new', auth: true, waitFor: 'body' },
  { name: '06-collection-articles-edit', path: '/collections/articles/e_changelog', auth: true, waitFor: 'body' },
  { name: '07-media', path: '/media', auth: true, waitFor: 'body' },
  { name: '08-users', path: '/users', auth: true, waitFor: 'body' },
  { name: '09-settings', path: '/settings', auth: true, waitFor: 'body' },
  { name: '11-collections-authors', path: '/collections/authors', auth: true, waitFor: 'body' },
  { name: '12-collections-categories', path: '/collections/categories', auth: true, waitFor: 'body' },
  { name: '13-entry-detail', path: '/collections/articles/e_arch', auth: true, waitFor: 'body' },
];

/** Set fake auth state so middleware + AuthProvider both pass. */
const FAKE_TOKEN = 'fake-jwt-token-for-screenshots';
const FAKE_USER = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'admin@q-cms.local',
  name: 'Admin',
  isSuperAdmin: true,
  isActive: true,
  roles: ['super_admin'],
};

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  for (const { name, path, auth, waitFor } of PAGES) {
    const page = await context.newPage();
    if (auth) {
      await context.addCookies([
        {
          name: 'qcms_token',
          value: FAKE_TOKEN,
          domain: 'localhost',
          path: '/',
          httpOnly: false,
          sameSite: 'Lax',
        },
      ]);
    }

    // Pre-seed localStorage with auth state for the dashboard pages
    if (auth) {
      await page.addInitScript(
        ({ token, user }) => {
          window.localStorage.setItem(
            'q-cms-admin:auth',
            JSON.stringify({ token, user }),
          );
        },
        { token: FAKE_TOKEN, user: FAKE_USER },
      );
    }

    const url = `${ADMIN_URL}${path}`;
    process.stdout.write(`→ ${name} (${url}) ... `);
    const start = Date.now();
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const status = resp?.status() ?? 0;
      // Give client hydration + React Query a moment
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
      await page.waitForSelector(waitFor, { timeout: 8_000 }).catch(() => {});
      // Final settle for any animations
      await page.waitForTimeout(500);
      const file = resolve(OUT_DIR, `${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`OK [${status}] in ${Date.now() - start}ms → ${file}`);
    } catch (err) {
      const file = resolve(OUT_DIR, `${name}.png`);
      try {
        await page.screenshot({ path: file, fullPage: true });
      } catch {}
      console.log(`FAIL in ${Date.now() - start}ms: ${err.message} → ${file}`);
    }
    await page.close();
  }

  await context.close();
  await browser.close();
  console.log(`\nDone. Screenshots written to: ${OUT_DIR}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
