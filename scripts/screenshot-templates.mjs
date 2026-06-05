/**
 * Screenshot the new Q-CMS template builder screens.
 *
 * Captures:
 *   - 30-template-list         — /templates
 *   - 31-template-builder      — /templates/tpl_home
 *   - 32-template-preview      — preview modal open in the builder
 *   - 33-template-public       — public home page rendered by template-engine
 */
import { chromium } from '/Users/andrey/Desktop/projects/q-cms/apps/admin/node_modules/playwright/index.mjs';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'screenshots');
const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3002';

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const FAKE_TOKEN = 'fake-jwt-token-for-screenshots';
const FAKE_USER = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'admin@q-cms.local',
  name: 'Admin',
  isSuperAdmin: true,
  isActive: true,
  roles: ['super_admin'],
};

async function captureAdmin(page, name, path) {
  const url = `${ADMIN_URL}${path}`;
  process.stdout.write(`→ ${name} (${url}) ... `);
  const start = Date.now();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const status = resp?.status() ?? 0;
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(800);
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
}

async function captureWeb(page, name, path, waitFor) {
  const url = `${WEB_URL}${path}`;
  process.stdout.write(`→ ${name} (${url}) ... `);
  const start = Date.now();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const status = resp?.status() ?? 0;
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 10_000 }).catch(() => {});
    }
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(1200);
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
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  // Authenticate once.
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

  // 30: list
  {
    const page = await context.newPage();
    await page.addInitScript(
      ({ token, user }) => {
        window.localStorage.setItem('q-cms-admin:auth', JSON.stringify({ token, user }));
      },
      { token: FAKE_TOKEN, user: FAKE_USER },
    );
    await captureAdmin(page, '30-template-list', '/templates');
    await page.close();
  }

  // 31: builder
  {
    const page = await context.newPage();
    await page.addInitScript(
      ({ token, user }) => {
        window.localStorage.setItem('q-cms-admin:auth', JSON.stringify({ token, user }));
      },
      { token: FAKE_TOKEN, user: FAKE_USER },
    );
    await captureAdmin(page, '31-template-builder', '/templates/tpl_home');
    await page.close();
  }

  // 32: builder with preview modal open
  {
    const page = await context.newPage();
    await page.addInitScript(
      ({ token, user }) => {
        window.localStorage.setItem('q-cms-admin:auth', JSON.stringify({ token, user }));
      },
      { token: FAKE_TOKEN, user: FAKE_USER },
    );
    const url = `${ADMIN_URL}/templates/tpl_home`;
    process.stdout.write(`→ 32-template-preview (${url}) ... `);
    const start = Date.now();
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const status = resp?.status() ?? 0;
      await page.waitForSelector('[data-testid="page-builder"]', { timeout: 15_000 });
      await page.click('[data-testid="page-builder-toggle-mode"]');
      await page.waitForSelector('[data-testid="page-builder-preview"]', { timeout: 5_000 });
      await page.waitForSelector('[data-testid="page-builder-preview-iframe"]', { timeout: 5_000 });
      // Give the iframe time to render.
      await page.waitForTimeout(2000);
      const file = resolve(OUT_DIR, '32-template-preview.png');
      await page.screenshot({ path: file, fullPage: true });
      console.log(`OK [${status}] in ${Date.now() - start}ms → ${file}`);
    } catch (err) {
      const file = resolve(OUT_DIR, '32-template-preview.png');
      try {
        await page.screenshot({ path: file, fullPage: true });
      } catch {}
      console.log(`FAIL in ${Date.now() - start}ms: ${err.message} → ${file}`);
    }
    await page.close();
  }

  // 33: public home rendered via template engine
  {
    const page = await context.newPage();
    await captureWeb(page, '33-template-public', '/', '.template-root .hero');
    await page.close();
  }

  await context.close();
  await browser.close();
  console.log(`\nDone. Template screenshots in ${OUT_DIR}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
