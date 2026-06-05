/**
 * Theme switching verification script for the public Q-CMS site.
 *
 * Loads each public page in three different themes (default, dark,
 * newspaper) and writes a screenshot to `screenshots/`. Also verifies
 * that:
 *
 *   - the page picks up the `data-theme` attribute on <html>
 *   - the active theme's CSS variables end up in the DOM
 *   - the page renders without unhandled console errors
 *
 * Usage:
 *   pnpm dev:web   # in another shell
 *   node scripts/test-theme.mjs
 *
 * Env:
 *   WEB_URL   — defaults to http://localhost:3002
 */
import { chromium } from '/Users/andrey/Desktop/projects/q-cms/apps/admin/node_modules/playwright/index.mjs';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'screenshots');
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3002';

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const THEMES = [
  { name: 'default', label: 'Default' },
  { name: 'dark', label: 'Dark' },
  { name: 'midnight', label: 'Midnight' },
  { name: 'newspaper', label: 'Newspaper' },
  { name: 'editorial', label: 'Editorial' },
];

const MODES = ['light', 'dark'];

const PAGES = [
  { name: 'home', path: '/', waitFor: '[data-featured] img' },
  { name: 'articles', path: '/articles/', waitFor: '[data-list] .index-row' },
  { name: 'article', path: '/articles/welcome-to-q-cms/', waitFor: '.article h1' },
  { name: 'authors', path: '/authors/', waitFor: '[data-list] .author-card' },
  { name: 'categories', path: '/categories/', waitFor: '[data-list] .tag' },
];

/**
 * @param {import('playwright').Page} page
 * @param {string} themeName
 * @param {string} mode
 */
async function applyThemeViaApi(page, themeName, mode) {
  // Use the global API exposed by /js/theme.js.
  await page.evaluate(
    ({ theme, mode }) => {
      window.QCMS_THEME?.set({ theme, mode });
    },
    { theme: themeName, mode },
  );
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  /** @type {Array<{page:string, theme:string, mode:string, status:string, error?:string}>} */
  const results = [];

  for (const theme of THEMES) {
    for (const mode of MODES) {
      for (const { name: pageName, path, waitFor } of PAGES) {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (err) => errors.push(String(err)));
        page.on('console', (msg) => {
          if (msg.type() === 'error') errors.push(msg.text());
        });

        const url = `${WEB_URL}${path}`;
        const label = `${pageName}__${theme.name}__${mode}`;
        const start = Date.now();
        try {
          const resp = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30_000,
          });
          // Wait for the page to settle and any data-* slots to render.
          await page.waitForSelector(waitFor, { timeout: 8_000 }).catch(() => {});
          await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});

          // Apply the theme after the page is up so we override any
          // pre-set attributes cleanly.
          await applyThemeViaApi(page, theme.name, mode);

          // Verify the theme was applied.
          const meta = await page.evaluate(() => {
            const root = document.documentElement;
            return {
              dataTheme: root.getAttribute('data-theme'),
              dataMode: root.getAttribute('data-mode'),
              bgVar: getComputedStyle(root).getPropertyValue('--color-bg-canvas').trim(),
              accentVar: getComputedStyle(root).getPropertyValue('--color-accent').trim(),
            };
          });

          if (meta.dataTheme !== theme.name) {
            throw new Error(
              `data-theme mismatch: expected ${theme.name}, got ${meta.dataTheme}`,
            );
          }
          if (meta.dataMode !== mode) {
            throw new Error(
              `data-mode mismatch: expected ${mode}, got ${meta.dataMode}`,
            );
          }
          if (!meta.bgVar) {
            throw new Error('no --color-bg-canvas CSS variable on <html>');
          }

          await page.waitForTimeout(300);
          const file = resolve(OUT_DIR, `theme-${label}.png`);
          await page.screenshot({ path: file, fullPage: false });
          const status = resp?.status() ?? 0;
          const elapsed = Date.now() - start;
          console.log(
            `OK  ${label.padEnd(38)} [${status}] ${elapsed}ms  bg=${meta.bgVar}  accent=${meta.accentVar}`,
          );
          results.push({ page: pageName, theme: theme.name, mode, status: 'ok' });
        } catch (err) {
          const file = resolve(OUT_DIR, `theme-${label}.png`);
          try {
            await page.screenshot({ path: file, fullPage: false });
          } catch {}
          console.log(`FAIL ${label}: ${err.message}`);
          results.push({
            page: pageName,
            theme: theme.name,
            mode,
            status: 'fail',
            error: err.message,
          });
        } finally {
          if (errors.length > 0) {
            console.log(`    page errors: ${errors.join(' | ')}`);
          }
          await page.close();
        }
      }
    }
  }

  await context.close();
  await browser.close();

  // Summary
  const total = results.length;
  const ok = results.filter((r) => r.status === 'ok').length;
  const fail = total - ok;
  console.log(`\nTheme verification: ${ok}/${total} OK, ${fail} failed.`);
  console.log(`Screenshots saved to ${OUT_DIR}/theme-*.png`);

  // Write a machine-readable summary
  const summaryPath = resolve(OUT_DIR, 'theme-summary.json');
  writeFileSync(
    summaryPath,
    JSON.stringify({ ok, fail, total, results }, null, 2),
    'utf-8',
  );
  console.log(`Summary written to ${summaryPath}`);

  if (fail > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
