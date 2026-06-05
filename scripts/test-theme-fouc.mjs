/**
 * FOUC test for apps/web/public/js/theme.js.
 *
 * Loads the public site (or just executes theme.js in jsdom) and
 * verifies that:
 *
 *   1. The script applies the stored theme synchronously
 *      (data-theme / data-mode are set on <html> immediately after
 *      the IIFE returns).
 *   2. Re-running the script (or calling the API twice) is
 *      idempotent — the DOM doesn't accumulate <style> tags.
 *   3. The CSS variables on :root reflect the stored theme.
 *   4. With no stored value, the OS preference is honored.
 *
 * Run with: node scripts/test-theme-fouc.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from '/Users/andrey/Desktop/projects/q-cms/apps/admin/node_modules/jsdom/lib/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(__dirname, '..', 'apps', 'web', 'public', 'js', 'theme.js');

if (!existsSync(SCRIPT_PATH)) {
  console.error(`theme.js not found at ${SCRIPT_PATH}`);
  process.exit(1);
}

const SCRIPT = readFileSync(SCRIPT_PATH, 'utf-8');

function makeDom({ stored = null, prefersDark = false } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><head></head><body></body></html>`,
    {
      url: 'http://localhost/',
      pretendToBeVisual: true,
      runScripts: 'dangerously',
    },
  );
  const { window } = dom;
  // Stub matchMedia.
  window.matchMedia = (q) => ({
    matches: q.includes('dark') ? prefersDark : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => {},
    onchange: null,
  });
  // Stub localStorage.
  const store = new Map();
  if (stored) store.set('qcms_theme', JSON.stringify(stored));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, 'localStorage', { value: localStorage });
  return { dom, window };
}

/** Append the script as a real `<script>` element so JSDOM runs it
 *  in the window's own global scope. */
function runScript(window, src) {
  // Suppress JSDOM's CSS parser warnings — they don't affect the
  // test assertions (we read the DOM directly, not the parsed
  // stylesheet).
  const origError = window.console.error;
  window.console.error = (...args) => {
    const msg = String(args[0] ?? '');
    if (msg.includes('Could not parse CSS stylesheet')) return;
    origError.apply(window.console, args);
  };
  const s = window.document.createElement('script');
  s.textContent = src;
  window.document.head.appendChild(s);
  window.console.error = origError;
}

let pass = 0;
let fail = 0;
const results = [];

function expect(name, cond, detail) {
  if (cond) {
    pass++;
    results.push({ name, status: 'ok' });
    console.log(`  OK   ${name}`);
  } else {
    fail++;
    results.push({ name, status: 'fail', detail });
    console.log(`  FAIL ${name}: ${detail}`);
  }
}

async function run() {
  console.log('[1] theme.js applies stored theme synchronously');
  {
    const { window } = makeDom({ stored: { theme: 'midnight', mode: 'dark' } });
    runScript(window, SCRIPT);
    expect(
      'data-theme attribute set on <html>',
      window.document.documentElement.getAttribute('data-theme') === 'midnight',
      window.document.documentElement.getAttribute('data-theme'),
    );
    expect(
      'data-mode attribute set on <html>',
      window.document.documentElement.getAttribute('data-mode') === 'dark',
      window.document.documentElement.getAttribute('data-mode'),
    );
    const styles = window.document.querySelectorAll('style#qcms-theme');
    expect('qcms-theme <style> tag injected', styles.length === 1, `got ${styles.length}`);
    const css = styles[0]?.textContent ?? '';
    expect('CSS includes the accent color', css.includes('--color-accent: #818cf8'), css.slice(0, 200));
  }

  console.log('\n[2] theme.js is idempotent — calling set() twice does not duplicate <style>');
  {
    const { window } = makeDom({ stored: { theme: 'default', mode: 'light' } });
    runScript(window, SCRIPT);
    window.QCMS_THEME.set({ theme: 'editorial', mode: 'light' });
    window.QCMS_THEME.set({ theme: 'editorial', mode: 'light' });
    const styles = window.document.querySelectorAll('style#qcms-theme');
    expect('still exactly one qcms-theme <style>', styles.length === 1, `got ${styles.length}`);
    const css = styles[0]?.textContent ?? '';
    expect('CSS reflects the latest theme', css.includes('--color-accent: #0a0a0a'), css.slice(0, 200));
  }

  console.log('\n[3] theme.js falls back to OS preference in auto mode');
  {
    const { window } = makeDom({ prefersDark: true });
    runScript(window, SCRIPT);
    expect(
      'mode resolves to dark',
      window.document.documentElement.getAttribute('data-mode') === 'dark',
      window.document.documentElement.getAttribute('data-mode'),
    );
  }

  console.log('\n[4] QCMS_THEME.list() exposes every theme');
  {
    const { window } = makeDom();
    runScript(window, SCRIPT);
    const list = window.QCMS_THEME.list();
    expect('5 themes are registered', list.length === 5, `got ${list.length}`);
    for (const expected of ['default', 'dark', 'midnight', 'newspaper', 'editorial']) {
      expect(`list contains ${expected}`, list.includes(expected), list.join(','));
    }
  }

  console.log('\n[5] QCMS_THEME.cycle() advances through the catalog');
  {
    const { window } = makeDom({ stored: { theme: 'default', mode: 'light' } });
    runScript(window, SCRIPT);
    const next = window.QCMS_THEME.cycle();
    expect('cycle returns the next theme', next !== 'default', next);
    expect(
      'data-theme was updated',
      window.document.documentElement.getAttribute('data-theme') === next,
      window.document.documentElement.getAttribute('data-theme'),
    );
  }

  console.log(`\nResults: ${pass} passed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
