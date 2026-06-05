/**
 * Screenshot the editor improvements added by Subagent 3.
 *
 *   40-editor-with-preview.png — edit page with the split preview pane
 *   41-editor-slash-menu.png   — slash menu open, grouped by category
 *   42-preview-page.png        — standalone /preview/[id] page
 *
 * Auth state is pre-seeded into localStorage so the dashboard shell
 * does not redirect to /login.
 */
import { chromium } from '/Users/andrey/Desktop/projects/q-cms/apps/admin/node_modules/playwright/index.mjs';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'screenshots');
const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3001';

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

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });

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

  // --- 40: editor with live preview ---
  {
    const page = await context.newPage();
    await page.addInitScript(
      ({ token, user, content }) => {
        window.localStorage.setItem('q-cms-admin:auth', JSON.stringify({ token, user }));
        // Pre-seed the entry's content via a global the editor reads.
        // (The stub api-client returns hard-coded data so we use
        // a MutationObserver-free approach: just put a demo value
        // into a known location and have the page read it.)
        window.__QCMS_DEMO_CONTENT__ = content;
      },
      {
        token: FAKE_TOKEN,
        user: FAKE_USER,
        content: [
          '# v0.1 — Seed',
          '',
          'Welcome to the first public seed of Q-CMS.',
          '',
          '## What ships',
          '',
          'Roles, permissions, collections, the admin shell, the API contract and a block-based editor — all wired up and ready to extend.',
          '',
          '## How to extend',
          '',
          'Add new collections from the admin, or use the CLI to scaffold a new package.',
        ].join('\n'),
      },
    );
    await page.goto(`${ADMIN_URL}/collections/articles/e_changelog`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    await page.waitForSelector('[data-testid="qcms-editor"]', { timeout: 10_000 }).catch(() => {});
    await page.waitForSelector('[data-testid="qcms-editor-preview"]', { timeout: 10_000 }).catch(() => {});
    // Replace the contenteditable text via DOM so the React onInput fires.
    await page.evaluate(() => {
      const surface = document.querySelector('[data-testid="qcms-editor-surface"]');
      if (!surface) return;
      const content = window.__QCMS_DEMO_CONTENT__ ?? '';
      // Replace innerText to trigger React's onInput.
      const text = document.createTextNode(content);
      surface.replaceChildren(text);
      surface.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });
    await page.waitForTimeout(800);
    const file = resolve(OUT_DIR, '40-editor-with-preview.png');
    await page.screenshot({ path: file, fullPage: true });
    console.log(`→ 40-editor-with-preview.png  saved`);
    await page.close();
  }

  // --- 41: editor slash menu open & grouped ---
  {
    const page = await context.newPage();
    await page.addInitScript(
      ({ token, user }) => {
        window.localStorage.setItem('q-cms-admin:auth', JSON.stringify({ token, user }));
      },
      { token: FAKE_TOKEN, user: FAKE_USER },
    );
    await page.goto(`${ADMIN_URL}/collections/articles/new`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    await page.waitForSelector('[data-testid="qcms-editor-empty"]', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Add a block' }).click();
    await page.waitForSelector('[data-testid="slash-menu"]', { timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(400);
    const file = resolve(OUT_DIR, '41-editor-slash-menu.png');
    await page.screenshot({ path: file, fullPage: true });
    console.log(`→ 41-editor-slash-menu.png    saved`);
    await page.close();
  }

  // --- 42: standalone preview page ---
  {
    const page = await context.newPage();
    await page.addInitScript(
      ({ token, user }) => {
        window.localStorage.setItem('q-cms-admin:auth', JSON.stringify({ token, user }));
      },
      { token: FAKE_TOKEN, user: FAKE_USER },
    );
    await page.goto(`${ADMIN_URL}/preview/e_changelog`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    await page.waitForSelector('[data-testid="preview-article"]', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(800);
    const file = resolve(OUT_DIR, '42-preview-page.png');
    await page.screenshot({ path: file, fullPage: true });
    console.log(`→ 42-preview-page.png         saved`);
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
