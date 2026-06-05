/**
 * DOM application helpers.
 *
 * `applyThemeToDocument()` is the runtime entry point used by both
 * the admin `ThemeProvider` and the public-site boot script. It
 *
 *   1. sets `data-theme` and `data-mode` attributes on `<html>`,
 *   2. injects (or updates) a `<style id="qcms-theme">` block with
 *      the theme's CSS variables (wrapped in `@layer qcms-theme`),
 *   3. on first paint, primes the `color-scheme` hint and `data-*`
 *      attributes so the browser doesn't flash the wrong theme.
 *
 * The function is **idempotent**: calling it twice with the same
 * args produces the same DOM. Calling it with different args
 * mutates the existing style tag (no accumulation).
 *
 * @packageDocumentation
 */

import { themeToCSS } from './css';
import { getTheme } from './registry';

/** The `id` we use to mark the theme `<style>` element. */
export const STYLE_ID = 'qcms-theme';

/** `data-mode` value options. */
export type Mode = 'light' | 'dark';

/** A `SystemMode` adds the OS-driven `'auto'` option. */
export type SystemMode = Mode | 'auto';

/** Token to use as a CSS layer wrapper around injected styles. */
const LAYER_NAME = 'qcms-theme';

/** Inline style we apply to `<html>` to make the theme transition smooth. */
const TRANSITION_INJECTION = `
*, *::before, *::after {
  transition: background-color var(--motion-base, 200ms) var(--ease-out, ease-out),
              color var(--motion-base, 200ms) var(--ease-out, ease-out),
              border-color var(--motion-base, 200ms) var(--ease-out, ease-out),
              box-shadow var(--motion-base, 200ms) var(--ease-out, ease-out);
}
input, textarea, select, [contenteditable="true"] {
  transition: none !important;
}
`.trim();

/**
 * Optional configuration. Pass `styleElement` to share an existing
 * style tag (useful in tests). Pass `document` to inject a fake
 * document-like object (also for tests).
 */
export interface ApplyOptions {
  /** Override the `<style>` element used to host the CSS. */
  styleElement?: HTMLStyleElement | null;
  /** Override the `document` reference. */
  document?: Document | null;
  /**
   * If `true` (default), also inject a small global transition rule
   * so theme swaps feel smooth. Set to `false` for tests / first
   * paint paths where you don't want any extra CSS.
   */
  withTransitions?: boolean;
  /**
   * If `true` (default), wrap the theme CSS in `@layer qcms-theme`.
   * Disable for tests that need a single `:root` rule outside a
   * layer (rare).
   */
  useLayer?: boolean;
}

/**
 * Inject the global smooth-transition stylesheet. Idempotent.
 */
function ensureTransitions(doc: Document): void {
  const id = `${STYLE_ID}-motion`;
  if (doc.getElementById(id)) return;
  const style = doc.createElement('style');
  style.id = id;
  style.setAttribute('data-qcms-theme', 'motion');
  style.textContent = `@layer ${LAYER_NAME} { ${TRANSITION_INJECTION} }`;
  doc.head?.appendChild(style);
}

/**
 * Apply a theme to the given document. The CSS variables end up on
 * `:root` (light) and `[data-mode="dark"]` (dark override, if the
 * theme defines one).
 *
 * @param themeName - The name of a registered theme.
 * @param mode - `light` or `dark`. If the theme has no `dark` block,
 *               the light tokens are reused but `data-mode` is still
 *               set so CSS can opt in.
 * @param options - Optional test hooks and feature flags.
 * @returns `true` if the theme was applied, `false` if it isn't
 *               registered (no DOM mutation happens in that case).
 */
export function applyThemeToDocument(
  themeName: string,
  mode: Mode = 'light',
  options?: ApplyOptions,
): boolean {
  const theme = getTheme(themeName);
  if (!theme) {
    return false;
  }
  const doc = options?.document ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) {
    return false;
  }
  const withTransitions = options?.withTransitions ?? true;
  const useLayer = options?.useLayer ?? true;

  const root = doc.documentElement;
  if (root) {
    // Default-attribute the root so the page never flashes the
    // wrong theme while React/HTML hydrates.
    root.setAttribute('data-theme', themeName);
    root.setAttribute('data-mode', mode);
    // Hint to the browser so native form controls + scrollbars
    // match the active mode.
    root.style.colorScheme = mode;
  }

  const css = themeToCSS(theme, { useLayer });
  const existing = options?.styleElement ?? (doc.getElementById(STYLE_ID) as HTMLStyleElement | null);
  if (existing) {
    // No-op when the CSS is identical — the call is idempotent.
    if (existing.textContent !== css) {
      existing.textContent = css;
    }
  } else {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.setAttribute('data-qcms-theme', 'tokens');
    style.textContent = css;
    doc.head?.appendChild(style);
  }

  if (withTransitions) {
    ensureTransitions(doc);
  }
  return true;
}

/**
 * Resolve the currently-applied theme name by reading `data-theme`
 * from the document root. Returns `null` if not set.
 */
export function readAppliedTheme(doc: Document = globalThis.document): string | null {
  return doc.documentElement?.getAttribute('data-theme') ?? null;
}

/**
 * Resolve the currently-applied mode by reading `data-mode` from
 * the document root. Returns `"light"` if not set.
 */
export function readAppliedMode(doc: Document = globalThis.document): Mode {
  const v = doc.documentElement?.getAttribute('data-mode');
  return v === 'dark' ? 'dark' : 'light';
}

/**
 * Build a pre-paint stylesheet for a given theme. This is what the
 * public site uses to avoid a flash of wrong-themed content: the
 * CSS is rendered at request time, embedded inline in `<head>`,
 * and applied **before** the body parses.
 *
 * The output is a complete `<style>` tag (not just the inner CSS)
 * so the public-site script can `document.write` it without
 * escaping issues.
 *
 * @param themeName - The name of a registered theme.
 * @param mode - The initial mode to assume.
 * @returns A `<style>` tag string, or `null` if the theme isn't
 *          registered.
 */
export function buildPrePaintStyleTag(themeName: string, _mode: Mode = 'light'): string | null {
  const theme = getTheme(themeName);
  if (!theme) return null;
  const css = themeToCSS(theme, { useLayer: false });
  return `<style id="${STYLE_ID}" data-qcms-theme="pre-paint">${css}</style>`;
}

/**
 * Listen to `prefers-color-scheme` changes and re-apply the
 * current theme in the new mode. Returns a cleanup function.
 *
 * The admin `ThemeProvider` registers this when the user has
 * `auto` mode selected; the public site does the same on every
 * page.
 *
 * @param getCurrent - Returns the theme name and current mode.
 * @param apply - The apply function (e.g. `applyThemeToDocument`).
 * @returns A teardown function.
 */
export function watchSystemColorScheme(
  getCurrent: () => { themeName: string; mode: SystemMode },
  apply: (themeName: string, mode: Mode) => boolean,
): () => void {
  void getCurrent;
  void apply;
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (): void => {
    const { themeName, mode } = getCurrent();
    if (mode !== 'auto') return;
    apply(themeName, mql.matches ? 'dark' : 'light');
  };
  if (mql.addEventListener) {
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }
  // Safari < 14 fallback
  // biome-ignore lint/suspicious/noExplicitAny: legacy API
  mql.addListener(handler as any);
  return () => {
    // biome-ignore lint/suspicious/noExplicitAny: legacy API
    (mql as any).removeListener?.(handler as any);
  };
}
