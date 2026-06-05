/**
 * FOUC test for the admin's pre-paint theme bootstrap.
 *
 * The admin `RootLayout` injects a synchronous inline script in
 * `<head>` so the user's stored theme is applied BEFORE the first
 * paint. Without it, the default light theme flashes for a frame
 * before `<ThemeProvider>` runs in `useEffect` and switches to the
 * stored dark theme.
 *
 * These tests run the generated IIFE inside a real DOM, then
 * verify:
 *
 *   1. `data-theme` and `data-mode` are set on `<html>` immediately
 *      after the IIFE returns (synchronously, before any paint).
 *   2. The matching `<style id="qcms-theme">` tag was injected.
 *   3. The CSS variables on `:root` reflect the stored theme.
 *   4. With no stored value, the OS preference is honored.
 *   5. Re-applying via `window.QCMS_THEME.set()` is idempotent
 *      (no duplicate `<style>` tags).
 *   6. The generator's output is valid JavaScript and doesn't
 *      leak `</script>` sequences (XSS safety for inline scripts).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildThemeBootstrapScript } from '../src/lib/theme-bootstrap';

function makeDom({ stored = null, prefersDark = false }: { stored?: { theme: string; mode: string } | null; prefersDark?: boolean } = {}): {
  window: Window & typeof globalThis;
  document: Document;
} {
  // Use a fresh document each time so the test is hermetic.
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-mode');
  document.documentElement.style.cssText = '';

  // Wipe any existing style tags from a prior test.
  for (const id of ['qcms-theme', 'qcms-theme-motion']) {
    document.getElementById(id)?.remove();
  }

  // Reset storage.
  window.localStorage.clear();
  if (stored) {
    window.localStorage.setItem('qcms_theme', JSON.stringify(stored));
  }

  // Override matchMedia for this test.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('dark') ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });

  return { window, document };
}

function runBootstrapScript(): void {
  const script = buildThemeBootstrapScript();
  // Parse the IIFE, then invoke it in the current global scope.
  // Using `new Function` keeps the body out of the module scope so
  // `window` references inside the IIFE hit the real window — same
  // as a `<script>` tag parsed by the browser.
  // biome-ignore lint/security/noGlobalEval: required to mirror inline <script> execution
  new Function(script)();
}

type QcmsThemeApi = {
  get(): { theme: string; mode: string };
  set(v: { theme: string; mode: string }): void;
  list(): string[];
  cycle(): string;
};
function qcmsTheme(): QcmsThemeApi {
  return (window as unknown as { QCMS_THEME: QcmsThemeApi }).QCMS_THEME;
}

describe('admin theme bootstrap', () => {
  beforeEach(() => {
    // Each test gets a clean DOM (see makeDom). We still wipe
    // localStorage between tests in case the previous test
    // mutated it.
    window.localStorage.clear();
  });

  afterEach(() => {
    // Wipe anything the script injected so the next test starts
    // with a blank document.
    for (const id of ['qcms-theme', 'qcms-theme-motion']) {
      document.getElementById(id)?.remove();
    }
    window.localStorage.clear();
  });

  it('applies the stored theme synchronously (no async gap)', () => {
    makeDom({ stored: { theme: 'midnight', mode: 'dark' } });
    runBootstrapScript();

    expect(document.documentElement.getAttribute('data-theme')).toBe('midnight');
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
  });

  it('injects exactly one <style id="qcms-theme"> with the right CSS', () => {
    makeDom({ stored: { theme: 'midnight', mode: 'dark' } });
    runBootstrapScript();

    const styles = document.querySelectorAll('style#qcms-theme');
    expect(styles.length).toBe(1);

    const css = styles[0]?.textContent ?? '';
    // Midnight's violet-blue accent in dark mode.
    expect(css).toContain('--color-accent: #818cf8');
    // And its dark canvas.
    expect(css).toContain('--color-bg-canvas: #0b0b14');
  });

  it('emits the dark-mode override inside [data-mode="dark"]', () => {
    makeDom({ stored: { theme: 'default', mode: 'dark' } });
    runBootstrapScript();

    const css = document.getElementById('qcms-theme')?.textContent ?? '';
    expect(css).toContain('[data-mode="dark"]');
    // Default's dark canvas is #09090b.
    expect(css).toContain('--color-bg-canvas: #09090b');
  });

  it('falls back to the OS preference in auto mode', () => {
    makeDom({ stored: { theme: 'default', mode: 'auto' }, prefersDark: true });
    runBootstrapScript();
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');

    // Light OS preference → light mode.
    makeDom({ stored: { theme: 'default', mode: 'auto' }, prefersDark: false });
    runBootstrapScript();
    expect(document.documentElement.getAttribute('data-mode')).toBe('light');
  });

  it('falls back to default theme when nothing is stored', () => {
    makeDom();
    runBootstrapScript();
    expect(document.documentElement.getAttribute('data-theme')).toBe('default');
  });

  it('falls back to default theme when stored name is unknown', () => {
    makeDom({ stored: { theme: 'nonexistent', mode: 'dark' } });
    runBootstrapScript();
    expect(document.documentElement.getAttribute('data-theme')).toBe('default');
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
  });

  it('sets color-scheme so native form controls match', () => {
    makeDom({ stored: { theme: 'midnight', mode: 'dark' } });
    runBootstrapScript();
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('sets an inline background color on <html> for the pre-stylesheet moment', () => {
    makeDom({ stored: { theme: 'midnight', mode: 'dark' } });
    runBootstrapScript();
    // Midnight's dark canvas.
    expect(document.documentElement.style.backgroundColor).toBeTruthy();
  });

  it('is idempotent — re-applying via QCMS_THEME.set does not duplicate <style>', () => {
    makeDom({ stored: { theme: 'default', mode: 'light' } });
    runBootstrapScript();

    qcmsTheme().set({
      theme: 'editorial',
      mode: 'light',
    });
    qcmsTheme().set({
      theme: 'editorial',
      mode: 'light',
    });

    const styles = document.querySelectorAll('style#qcms-theme');
    expect(styles.length).toBe(1);
    const css = styles[0]?.textContent ?? '';
    expect(css).toContain('--color-accent: #0a0a0a');
  });

  it('QCMS_THEME.cycle advances through the catalog and persists', () => {
    makeDom({ stored: { theme: 'default', mode: 'light' } });
    runBootstrapScript();

    const next = qcmsTheme().cycle();
    expect(next).not.toBe('default');
    expect(document.documentElement.getAttribute('data-theme')).toBe(next);

    const persisted = window.localStorage.getItem('qcms_theme');
    expect(persisted).toBe(JSON.stringify({ theme: next, mode: 'light' }));
  });

  it('exposes every built-in theme via QCMS_THEME.list()', () => {
    makeDom();
    runBootstrapScript();
    const list = qcmsTheme().list();
    for (const expected of ['default', 'dark', 'midnight', 'newspaper', 'editorial']) {
      expect(list).toContain(expected);
    }
  });
});

describe('admin theme bootstrap script safety', () => {
  it('is valid JavaScript (parses without throwing)', () => {
    const script = buildThemeBootstrapScript();
    expect(() => new Function(script)).not.toThrow();
  });

  it('never emits a literal </script> sequence in the embedded data', () => {
    const script = buildThemeBootstrapScript();
    // The JSON-encoded payload must use `<\/` so the inlined
    // `<script>` block can't be terminated by a malicious token
    // value. A `</script` substring (case-insensitive) would
    // indicate a regression.
    expect(/<\/script/i.test(script)).toBe(false);
  });

  it('returns a stable string for the same input (SSR-safe)', () => {
    // SSR stability matters because Next.js can re-render the
    // layout and the resulting HTML must be byte-identical to
    // avoid a hydration mismatch on the inline <script> tag.
    const a = buildThemeBootstrapScript();
    const b = buildThemeBootstrapScript();
    expect(a).toBe(b);
  });
});
