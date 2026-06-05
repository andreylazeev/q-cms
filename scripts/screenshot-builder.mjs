/**
 * Screenshot the polished Q-CMS template builder screens.
 *
 * Captures the eight PNGs the brief calls for:
 *   - 60-page-builder-empty           — palette + empty state
 *   - 61-page-builder-with-blocks     — palette + 4-section canvas
 *   - 62-page-builder-dragging        — mid-drag visual feedback
 *   - 63-page-builder-preview-mobile  — preview iframe, mobile size
 *   - 64-page-builder-preview-desktop — preview iframe, desktop size
 *   - 65-template-list                — card grid
 *   - 66-public-template-rendered     — public site, default theme
 *   - 67-public-template-theme-switched — public site, dark + newspaper
 *
 * Requires the admin (port 3001) and web (port 3002) servers to be
 * running. The auth cookie is the same fake token the
 * `screenshot-templates.mjs` script uses.
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

async function withAdminAuth(context, page, fn) {
  await page.addInitScript(
    ({ token, user }) => {
      window.localStorage.setItem('q-cms-admin:auth', JSON.stringify({ token, user }));
    },
    { token: FAKE_TOKEN, user: FAKE_USER },
  );
  await fn(page);
}

async function gotoSettle(page, url) {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(800);
  return resp;
}

async function shoot(page, name) {
  const file = resolve(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  → ${file}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
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

  // 60: empty builder — open the seeded template, then remove every
  // section in local builder state. The admin screenshot stub is
  // page-local, so templates created on /templates/new are not
  // visible after the redirect to /templates/:id.
  {
    const page = await context.newPage();
    await withAdminAuth(context, page, async (p) => {
      await gotoSettle(p, `${ADMIN_URL}/templates/tpl_home`);
      await p.waitForSelector('[data-testid="page-builder"]', { timeout: 8_000 });
      for (;;) {
        const remove = p.locator('[data-testid^="canvas-remove-"]').first();
        if ((await remove.count()) === 0) break;
        await remove.click();
        await p.waitForTimeout(100);
      }
      await p.waitForSelector('text=Or click any card in the palette to add your first section.', { timeout: 8_000 });
      await p.waitForTimeout(800);
      await shoot(p, '60-page-builder-empty');
    });
    await page.close();
  }

  // 61: builder with blocks — open the seeded home-default template.
  {
    const page = await context.newPage();
    await withAdminAuth(context, page, async (p) => {
      await gotoSettle(p, `${ADMIN_URL}/templates/tpl_home`);
      await p.waitForSelector('[data-testid="page-builder"]', { timeout: 8_000 });
      await p.waitForTimeout(800);
      await shoot(p, '61-page-builder-with-blocks');
    });
    await page.close();
  }

  // 62: dragging — open the seeded template, then simulate a drag
  // on the first card's handle. We use `page.mouse` to keep the
  // HTML5 dnd events firing.
  {
    const page = await context.newPage();
    await withAdminAuth(context, page, async (p) => {
      await gotoSettle(p, `${ADMIN_URL}/templates/tpl_home`);
      await p.waitForSelector('[data-testid="page-builder"]', { timeout: 8_000 });
      const handle = await p.$('[data-testid^="canvas-handle-"]');
      if (handle) {
        const box = await handle.boundingBox();
        if (box) {
          await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await p.mouse.down();
          await p.mouse.move(box.x + 200, box.y + 200, { steps: 8 });
          await p.waitForTimeout(200);
          await shoot(p, '62-page-builder-dragging');
          await p.mouse.up();
        }
      } else {
        await shoot(p, '62-page-builder-dragging');
      }
    });
    await page.close();
  }

  // 63: preview mobile
  {
    const page = await context.newPage();
    await withAdminAuth(context, page, async (p) => {
      await gotoSettle(p, `${ADMIN_URL}/templates/tpl_home`);
      await p.waitForSelector('[data-testid="page-builder"]', { timeout: 8_000 });
      await p.click('[data-testid="page-builder-toggle-mode"]');
      await p.waitForSelector('[data-testid="page-builder-preview"]', { timeout: 5_000 });
      await p.click('[data-testid="preview-device-mobile"]');
      await p.waitForTimeout(1200);
      await shoot(p, '63-page-builder-preview-mobile');
    });
    await page.close();
  }

  // 64: preview desktop
  {
    const page = await context.newPage();
    await withAdminAuth(context, page, async (p) => {
      await gotoSettle(p, `${ADMIN_URL}/templates/tpl_home`);
      await p.waitForSelector('[data-testid="page-builder"]', { timeout: 8_000 });
      await p.click('[data-testid="page-builder-toggle-mode"]');
      await p.waitForSelector('[data-testid="page-builder-preview"]', { timeout: 5_000 });
      await p.click('[data-testid="preview-device-desktop"]');
      await p.waitForTimeout(1200);
      await shoot(p, '64-page-builder-preview-desktop');
    });
    await page.close();
  }

  // 65: template list
  {
    const page = await context.newPage();
    await withAdminAuth(context, page, async (p) => {
      await gotoSettle(p, `${ADMIN_URL}/templates`);
      await p.waitForTimeout(600);
      await shoot(p, '65-template-list');
    });
    await page.close();
  }

  // 66: public home, default theme
  {
    const page = await context.newPage();
    await gotoSettle(page, `${WEB_URL}/`);
    await page.waitForSelector('.template-root .hero', { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await shoot(page, '66-public-template-rendered');
    await page.close();
  }

  // 67: public home, dark theme + newspaper (best-effort)
  {
    const page = await context.newPage();
    await gotoSettle(page, `${WEB_URL}/`);
    await page.waitForSelector('.template-root .hero', { timeout: 8_000 }).catch(() => {});
    await page.evaluate(() => {
      window.QCMS_THEME?.set({ theme: 'newspaper', mode: 'dark' });
    });
    await page.waitForTimeout(800);
    await shoot(page, '67-public-template-theme-switched');
    await page.close();
  }

  await context.close();
  await browser.close();
  console.log(`\nDone. Builder screenshots in ${OUT_DIR}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
