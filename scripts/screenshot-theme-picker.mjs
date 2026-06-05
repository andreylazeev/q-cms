/**
 * ThemePicker screenshot script.
 *
 * Captures the new settings → Theme card (which now hosts the
 * gallery-quality ThemePicker plus a live preview and a token
 * inspector) in multiple states:
 *
 *   50-theme-picker-light.png       — light mode, default theme
 *   51-theme-picker-dark.png        — dark mode, midnight theme
 *   52-theme-cards-hover.png        — mouse hovering a card
 *   53-theme-token-inspector.png    — token inspector expanded
 *   54-theme-active-card.png        — non-default card marked active
 *   55-theme-filter-dark.png        — only dark themes visible
 *   56-theme-default-card.png       — close-up of the default card
 *   57-theme-midnight-card.png      — close-up of the midnight card
 *   58-theme-editorial-card.png     — close-up of the editorial card
 *   59-theme-picker-magazine.png    — newspaper card visible
 *
 * Also re-runs the existing theme sweep (5 pages × all themes ×
 * light + dark) so the new `midnight` and `editorial` themes are
 * captured in `screenshots/theme-*.png` (overwriting the old
 * 3-theme sweep).
 *
 * Usage:
 *   pnpm dev:admin   pnpm dev:web
 *   node scripts/screenshot-theme-picker.mjs
 */
import { chromium } from '/Users/andrey/Desktop/projects/q-cms/apps/admin/node_modules/playwright/index.mjs';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
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

async function setupAdminContext(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
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
  await context.addInitScript(
    ({ token, user }) => {
      window.localStorage.setItem('q-cms-admin:auth', JSON.stringify({ token, user }));
    },
    { token: FAKE_TOKEN, user: FAKE_USER },
  );
  return context;
}

async function applyTheme(page, themeName, mode) {
  await page.evaluate(
    ({ theme, mode }) => {
      // The admin uses the @q-cms/ui theme provider, which writes
      // its choice to `qcms_theme` in localStorage. We use the
      // ThemeProvider by writing to that key + dispatching a
      // synthetic `storage` event so the provider picks it up
      // (cross-tab is exactly what it listens for).
      window.localStorage.setItem('qcms_theme', JSON.stringify({ theme, mode }));
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'qcms_theme',
          newValue: JSON.stringify({ theme, mode }),
          storageArea: window.localStorage,
        }),
      );
    },
    { theme: themeName, mode },
  );
}

async function shot(page, name) {
  const file = resolve(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  → ${name}.png`);
  return file;
}

async function captureSettingsCards(browser) {
  console.log('\n[1/3] Settings → Theme card screenshots');
  const context = await setupAdminContext(browser);

  // 50. light mode, default theme
  {
    const page = await context.newPage();
    await page.goto(`${ADMIN_URL}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="settings-page"]');
    await page.waitForSelector('[data-testid="theme-picker"]');
    await applyTheme(page, 'default', 'light');
    await page.waitForTimeout(500);
    await shot(page, '50-theme-picker-light');
    await page.close();
  }

  // 51. dark mode, midnight theme
  {
    const page = await context.newPage();
    await page.goto(`${ADMIN_URL}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="settings-page"]');
    await page.waitForSelector('[data-testid="theme-picker"]');
    await applyTheme(page, 'midnight', 'dark');
    await page.waitForTimeout(500);
    await shot(page, '51-theme-picker-dark');
    await page.close();
  }

  // 52. hover a non-active card
  {
    const page = await context.newPage();
    await page.goto(`${ADMIN_URL}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="settings-page"]');
    await page.waitForSelector('[data-testid="theme-picker"]');
    await applyTheme(page, 'default', 'light');
    const card = await page.$('[data-theme-name="editorial"]');
    if (card) {
      const box = await card.boundingBox();
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(350);
    }
    await shot(page, '52-theme-cards-hover');
    await page.close();
  }

  // 53. token inspector open
  {
    const page = await context.newPage();
    await page.goto(`${ADMIN_URL}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="settings-page"]');
    await page.waitForSelector('[data-testid="token-inspector-details"]');
    await applyTheme(page, 'editorial', 'light');
    // Open the <details>
    await page.click('summary');
    await page.waitForSelector('[data-testid="token-inspector"]');
    await page.waitForTimeout(400);
    await shot(page, '53-theme-token-inspector');
    await page.close();
  }

  // 54. active card (non-default)
  {
    const page = await context.newPage();
    await page.goto(`${ADMIN_URL}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="settings-page"]');
    await page.waitForSelector('[data-testid="theme-picker"]');
    await applyTheme(page, 'newspaper', 'light');
    await page.waitForTimeout(500);
    await shot(page, '54-theme-active-card');
    await page.close();
  }

  // 55. filter → only dark themes
  {
    const page = await context.newPage();
    await page.goto(`${ADMIN_URL}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="settings-page"]');
    await page.waitForSelector('[data-testid="theme-picker"]');
    await applyTheme(page, 'midnight', 'dark');
    await page.click('[data-testid="filter-dark"]');
    await page.waitForTimeout(400);
    await shot(page, '55-theme-filter-dark');
    await page.close();
  }

  // 56-59. close-up of individual cards
  for (const [name, theme] of [
    ['56-theme-default-card', 'default'],
    ['57-theme-midnight-card', 'midnight'],
    ['58-theme-editorial-card', 'editorial'],
    ['59-theme-picker-magazine', 'newspaper'],
  ]) {
    const page = await context.newPage();
    await page.goto(`${ADMIN_URL}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="settings-page"]');
    await page.waitForSelector('[data-testid="theme-picker"]');
    await applyTheme(page, theme, theme === 'midnight' || theme === 'dark' ? 'dark' : 'light');
    await page.waitForTimeout(400);
    // Crop to the card area.
    const card = await page.$(`[data-theme-name="${theme}"]`);
    if (card) {
      const file = resolve(OUT_DIR, `${name}.png`);
      await card.screenshot({ path: file });
      console.log(`  → ${name}.png (card crop)`);
    } else {
      await shot(page, name);
    }
    await page.close();
  }

  await context.close();
}

async function capturePublicThemeSweep(browser) {
  console.log('\n[2/3] Public-site theme sweep (5 pages × 5 themes × 2 modes)');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

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

  const results = [];
  for (const theme of THEMES) {
    for (const mode of MODES) {
      for (const { name: pageName, path, waitFor } of PAGES) {
        const page = await context.newPage();
        const url = `${WEB_URL}${path}`;
        const label = `${pageName}__${theme.name}__${mode}`;
        try {
          const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          await page.waitForSelector(waitFor, { timeout: 8_000 }).catch(() => {});
          await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
          await page.evaluate(
            ({ theme, mode }) => window.QCMS_THEME?.set({ theme, mode }),
            { theme: theme.name, mode },
          );
          // Verify the theme actually applied.
          const meta = await page.evaluate(() => {
            const root = document.documentElement;
            return {
              dataTheme: root.getAttribute('data-theme'),
              dataMode: root.getAttribute('data-mode'),
              bgVar: getComputedStyle(root).getPropertyValue('--color-bg-canvas').trim(),
            };
          });
          if (meta.dataTheme !== theme.name) {
            throw new Error(`data-theme mismatch: expected ${theme.name}, got ${meta.dataTheme}`);
          }
          if (meta.dataMode !== mode) {
            throw new Error(`data-mode mismatch: expected ${mode}, got ${meta.dataMode}`);
          }
          if (!meta.bgVar) {
            throw new Error('no --color-bg-canvas CSS variable on <html>');
          }
          await page.waitForTimeout(300);
          const file = resolve(OUT_DIR, `theme-${label}.png`);
          await page.screenshot({ path: file, fullPage: false });
          const elapsed = Date.now() - Date.now();
          results.push({ page: pageName, theme: theme.name, mode, status: 'ok' });
          process.stdout.write(`OK  ${label.padEnd(40)}  bg=${meta.bgVar}\n`);
          void elapsed;
        } catch (err) {
          const file = resolve(OUT_DIR, `theme-${label}.png`);
          try { await page.screenshot({ path: file, fullPage: false }); } catch {}
          process.stdout.write(`FAIL ${label}: ${err.message}\n`);
          results.push({
            page: pageName,
            theme: theme.name,
            mode,
            status: 'fail',
            error: err.message,
          });
        } finally {
          await page.close();
        }
      }
    }
  }

  await context.close();
  return results;
}

async function captureFoucTest(browser) {
  console.log('\n[3/3] FOUC test — verify no flash of wrong theme on public home');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  // Pre-seed dark mode.
  await context.addInitScript(() => {
    window.localStorage.setItem('qcms_theme', JSON.stringify({ theme: 'midnight', mode: 'dark' }));
  });
  const page = await context.newPage();
  await page.goto(`${WEB_URL}/`, { waitUntil: 'domcontentloaded' });
  // Read the data-theme / data-mode that were set on first paint.
  const initial = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      dataTheme: root.getAttribute('data-theme'),
      dataMode: root.getAttribute('data-mode'),
      bg: getComputedStyle(root).backgroundColor,
      fg: getComputedStyle(root).color,
    };
  });
  console.log('  Initial state:', initial);
  if (initial.dataTheme !== 'midnight' || initial.dataMode !== 'dark') {
    console.log('  WARN: theme was not set on first paint — possible FOUC');
  } else {
    console.log('  OK: theme was applied before first paint (no FOUC)');
  }
  await page.waitForTimeout(500);
  await shot(page, '60-theme-fouc-test');
  await page.close();
  await context.close();
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const start = Date.now();
  await captureSettingsCards(browser);
  const results = await capturePublicThemeSweep(browser);
  await captureFoucTest(browser);
  await browser.close();

  const total = results.length;
  const ok = results.filter((r) => r.status === 'ok').length;
  console.log(`\nDone. Public-site theme sweep: ${ok}/${total} OK.`);
  console.log(`Screenshots written to: ${OUT_DIR}`);
  console.log(`Total time: ${(Date.now() - start) / 1000}s`);

  const summaryPath = resolve(OUT_DIR, 'theme-picker-summary.json');
  writeFileSync(
    summaryPath,
    JSON.stringify({
      settingsCards: 10,
      publicSweep: { ok, fail: total - ok, total },
      results,
    }, null, 2),
    'utf-8',
  );
  console.log(`Summary written to: ${summaryPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
