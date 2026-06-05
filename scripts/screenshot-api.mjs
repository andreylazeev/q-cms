/**
 * Screenshot API artifacts (OpenAPI docs, health endpoint, etc.).
 */
import { chromium } from '/Users/andrey/Desktop/projects/q-cms/apps/admin/node_modules/playwright/index.mjs';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'screenshots');
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const PAGES = [
  { name: '10-api-docs', path: '/api/v1/docs', waitFor: '.swagger-ui' },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  for (const { name, path, waitFor } of PAGES) {
    const page = await context.newPage();
    const url = `${API_URL}${path}`;
    process.stdout.write(`→ ${name} (${url}) ... `);
    const start = Date.now();
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const status = resp?.status() ?? 0;
      // Swagger UI loads async; wait for it
      await page.waitForSelector(waitFor, { timeout: 15_000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
      await page.waitForTimeout(1_500);
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
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
