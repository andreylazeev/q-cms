/**
 * Screenshot the public Q-CMS consumer site.
 */
import { chromium } from '/Users/andrey/Desktop/projects/q-cms/apps/admin/node_modules/playwright/index.mjs';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'screenshots');
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3002';
const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3001';

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const PAGES = [
  { name: '20-public-home', path: '/', waitFor: '[data-featured] img' },
  { name: '21-public-articles', path: '/articles/', waitFor: '[data-list] .index-row' },
  { name: '22-public-article', path: '/articles/welcome-to-q-cms/', waitFor: '.article h1' },
  { name: '23-public-authors', path: '/authors/', waitFor: '[data-list] .author-card' },
  { name: '24-public-categories', path: '/categories/', waitFor: '[data-list] .tag' },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  for (const { name, path, waitFor } of PAGES) {
    const page = await context.newPage();
    const url = `${WEB_URL}${path}`;
    process.stdout.write(`→ ${name} (${url}) ... `);
    const start = Date.now();
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const status = resp?.status() ?? 0;
      await page.waitForSelector(waitFor, { timeout: 8_000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
      await page.waitForTimeout(600);
      const file = resolve(OUT_DIR, `${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`OK [${status}] in ${Date.now() - start}ms → ${file}`);
    } catch (err) {
      const file = resolve(OUT_DIR, `${name}.png`);
      try {
        await page.screenshot({ path: file, fullPage: true });
      } catch {}
      console.log(`FAIL in ${Date.now() - start}ms: ${err.message}`);
    }
    await page.close();
  }

  await context.close();
  await browser.close();
  console.log(`\nDone. Public-site screenshots in ${OUT_DIR}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
