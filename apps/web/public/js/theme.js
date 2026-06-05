/**
 * Q-CMS public site — theme bootstrap.
 *
 * Runs **synchronously** in `<head>` (no `defer`/`async`) so the
 * theme is applied **before first paint** — no flash of wrong theme.
 *
 * Responsibilities (in order):
 *
 *   1. Read the user's stored choice from `localStorage.qcms_theme`.
 *   2. Fall back to the OS `prefers-color-scheme` media query
 *      (and the `default` theme) when nothing is stored.
 *   3. Default-attribute `<html>` (`data-theme`, `data-mode`,
 *      `color-scheme`) so the page never flashes the wrong palette.
 *   4. Inject the matching CSS variables onto `:root` and the
 *      dark-mode override onto `[data-mode="dark"]` inside
 *      `@layer qcms-theme`.
 *   5. Listen to live `prefers-color-scheme` changes (only when
 *      the user is in `auto` mode) and re-apply the theme.
 *   6. Listen to `storage` events so a theme change in the admin
 *      tab takes effect on the public site in another tab.
 *   7. Expose a tiny API on `window.QCMS_THEME` (`get`, `set`,
 *      `list`, `cycle`) for cross-tab / external control.
 *
 * The CSS variable names match `@q-cms/theme` exactly so a page
 * using `site.css` and the script picks up the same look as the
 * admin app. The theme definitions are inlined here because this
 * is a static site — no bundler. Keep them in sync with
 * `packages/theme/src/themes.ts`.
 */
(function () {
  "use strict";

  /** @typedef {{theme:string,mode:'light'|'dark'|'auto'}} StoredTheme */
  const STORAGE_KEY = "qcms_theme";
  const STYLE_ID = "qcms-theme";
  const MOTION_STYLE_ID = "qcms-theme-motion";
  const LAYER_NAME = "qcms-theme";

  /**
   * Inline base styles — applied before the theme CSS is generated
   * so the first paint already has the canvas colors. The `html`
   * element gets `background-color` and `color` derived from the
   * resolved theme so the browser doesn't flash a default
   * `white/black` background.
   */
  /** @type {Record<string, Record<string,Record<string,string>>>} */
  const THEMES = {
    default: {
      light: {
        "color-bg-canvas": "#f7f7f6",
        "color-bg-surface": "#ffffff",
        "color-bg-surface-raised": "#ffffff",
        "color-bg-overlay": "rgba(15, 23, 42, 0.55)",
        "color-fg": "#1a1a1a",
        "color-fg-muted": "#52525b",
        "color-fg-subtle": "#a1a1aa",
        "color-fg-on-accent": "#ffffff",
        "color-fg-on-success": "#ffffff",
        "color-fg-on-warning": "#1a1a1a",
        "color-fg-on-danger": "#ffffff",
        "color-border": "#e4e4e2",
        "color-border-strong": "#c9c9c5",
        "color-focus-ring": "#18181b",
        "color-accent": "#18181b",
        "color-accent-hover": "#3f3f46",
        "color-accent-soft": "#e7e7e4",
        "color-link": "#1a1a1a",
        "color-link-hover": "#18181b",
        "color-success": "#15803d",
        "color-success-soft": "#dcfce7",
        "color-warning": "#475569",
        "color-warning-soft": "#e2e8f0",
        "color-danger": "#b91c1c",
        "color-danger-soft": "#fee2e2",
        "space-0": "0", "space-1": "0.25rem", "space-2": "0.5rem", "space-3": "0.75rem",
        "space-4": "1rem", "space-6": "1.5rem", "space-8": "2rem", "space-12": "3rem",
        "space-16": "4rem", "space-24": "6rem", "space-32": "8rem", "space-48": "12rem",
        "radius-none": "0", "radius-sm": "4px", "radius-md": "8px", "radius-lg": "12px",
        "radius-xl": "20px", "radius-full": "9999px",
        "shadow-1": "0 1px 1px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.06)",
        "shadow-2": "0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 12px rgba(15, 23, 42, 0.08)",
        "shadow-3": "0 2px 4px rgba(15, 23, 42, 0.04), 0 12px 24px rgba(15, 23, 42, 0.10)",
        "shadow-4": "0 4px 8px rgba(15, 23, 42, 0.05), 0 24px 48px rgba(15, 23, 42, 0.18)",
        "motion-fast": "120ms", "motion-base": "200ms", "motion-slow": "320ms",
        "ease-out": "cubic-bezier(0.2, 0.8, 0.2, 1)",
        "ease-in": "cubic-bezier(0.4, 0, 1, 1)",
        "ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
        "z-base": "0", "z-dropdown": "1000", "z-sticky": "1100", "z-overlay": "1200",
        "z-modal": "1300", "z-popover": "1400", "z-toast": "1500",
        "font-serif": 'ui-serif, "Iowan Old Style", "Apple Garamond", "Palatino", "Georgia", serif',
        "font-sans": 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", system-ui, sans-serif',
        "font-mono": 'ui-monospace, "JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
        "font-size-base": "1rem", "line-height-base": "1.6",
        "font-size-h1": "2.5rem", "font-size-h2": "1.875rem", "font-size-h3": "1.5rem",
        "max-width": "72rem", "content-width": "44rem",
      },
      dark: {
        "color-bg-canvas": "#09090b", "color-bg-surface": "#18181b",
        "color-bg-surface-raised": "#27272a", "color-bg-overlay": "rgba(0, 0, 0, 0.7)",
        "color-fg": "#fafafa", "color-fg-muted": "#a1a1aa", "color-fg-subtle": "#71717a",
        "color-fg-on-accent": "#09090b", "color-fg-on-success": "#022c1a",
        "color-fg-on-warning": "#1a1a1a", "color-fg-on-danger": "#ffffff",
        "color-border": "#27272a", "color-border-strong": "#3f3f46",
        "color-focus-ring": "#fafafa",
        "color-accent": "#fafafa", "color-accent-hover": "#d4d4d8", "color-accent-soft": "#3f3f46",
        "color-link": "#fafafa", "color-link-hover": "#fafafa",
        "color-success": "#4ade80", "color-success-soft": "#14532d",
        "color-warning": "#cbd5e1", "color-warning-soft": "#334155",
        "color-danger": "#f87171", "color-danger-soft": "#7f1d1d",
        "shadow-1": "0 1px 1px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.5)",
        "shadow-2": "0 1px 2px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.55)",
        "shadow-3": "0 2px 4px rgba(0, 0, 0, 0.4), 0 12px 24px rgba(0, 0, 0, 0.6)",
        "shadow-4": "0 4px 8px rgba(0, 0, 0, 0.5), 0 24px 48px rgba(0, 0, 0, 0.7)",
      },
    },
    // The "dark" theme — its tokens are dark in both modes
    // (it's a first-class "I want this dark" theme, not just a
    // dark override of `default`).
    dark: {
      light: {
        "color-bg-canvas": "#09090b", "color-bg-surface": "#18181b",
        "color-bg-surface-raised": "#27272a", "color-bg-overlay": "rgba(0, 0, 0, 0.7)",
        "color-fg": "#fafafa", "color-fg-muted": "#a1a1aa", "color-fg-subtle": "#71717a",
        "color-fg-on-accent": "#09090b", "color-fg-on-success": "#022c1a",
        "color-fg-on-warning": "#1a1a1a", "color-fg-on-danger": "#ffffff",
        "color-border": "#27272a", "color-border-strong": "#3f3f46",
        "color-focus-ring": "#fafafa",
        "color-accent": "#fafafa", "color-accent-hover": "#d4d4d8", "color-accent-soft": "#3f3f46",
        "color-link": "#fafafa", "color-link-hover": "#fafafa",
        "color-success": "#4ade80", "color-success-soft": "#14532d",
        "color-warning": "#cbd5e1", "color-warning-soft": "#334155",
        "color-danger": "#f87171", "color-danger-soft": "#7f1d1d",
      },
      dark: {
        "color-bg-canvas": "#09090b", "color-bg-surface": "#18181b",
        "color-bg-surface-raised": "#27272a", "color-bg-overlay": "rgba(0, 0, 0, 0.7)",
        "color-fg": "#fafafa", "color-fg-muted": "#a1a1aa", "color-fg-subtle": "#71717a",
        "color-fg-on-accent": "#09090b", "color-fg-on-success": "#022c1a",
        "color-fg-on-warning": "#1a1a1a", "color-fg-on-danger": "#ffffff",
        "color-border": "#27272a", "color-border-strong": "#3f3f46",
        "color-focus-ring": "#fafafa",
        "color-accent": "#fafafa", "color-accent-hover": "#d4d4d8", "color-accent-soft": "#3f3f46",
        "color-link": "#fafafa", "color-link-hover": "#fafafa",
        "color-success": "#4ade80", "color-success-soft": "#14532d",
        "color-warning": "#cbd5e1", "color-warning-soft": "#334155",
        "color-danger": "#f87171", "color-danger-soft": "#7f1d1d",
        "shadow-1": "0 1px 1px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.5)",
        "shadow-2": "0 1px 2px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.55)",
        "shadow-3": "0 2px 4px rgba(0, 0, 0, 0.4), 0 12px 24px rgba(0, 0, 0, 0.6)",
        "shadow-4": "0 4px 8px rgba(0, 0, 0, 0.5), 0 24px 48px rgba(0, 0, 0, 0.7)",
      },
    },
    midnight: {
      light: {
        "color-bg-canvas": "#f5f3ff", "color-bg-surface": "#ffffff",
        "color-bg-surface-raised": "#ffffff", "color-bg-overlay": "rgba(15, 23, 42, 0.6)",
        "color-fg": "#0f172a", "color-fg-muted": "#475569", "color-fg-subtle": "#94a3b8",
        "color-fg-on-accent": "#ffffff", "color-fg-on-success": "#ffffff",
        "color-fg-on-warning": "#0f172a", "color-fg-on-danger": "#ffffff",
        "color-border": "#e2e8f0", "color-border-strong": "#cbd5e1",
        "color-focus-ring": "#6366f1",
        "color-accent": "#6366f1", "color-accent-hover": "#4f46e5", "color-accent-soft": "#e0e7ff",
        "color-link": "#0f172a", "color-link-hover": "#6366f1",
        "color-success": "#10b981", "color-success-soft": "#d1fae5",
        "color-warning": "#475569", "color-warning-soft": "#e2e8f0",
        "color-danger": "#ef4444", "color-danger-soft": "#fee2e2",
      },
      dark: {
        "color-bg-canvas": "#0b0b14", "color-bg-surface": "#13131f",
        "color-bg-surface-raised": "#1c1c2c", "color-bg-overlay": "rgba(0, 0, 0, 0.75)",
        "color-fg": "#e8e8f0", "color-fg-muted": "#9b9bb0", "color-fg-subtle": "#5c5c75",
        "color-fg-on-accent": "#ffffff", "color-fg-on-success": "#022c1a",
        "color-fg-on-warning": "#1a1a1a", "color-fg-on-danger": "#ffffff",
        "color-border": "#1f1f33", "color-border-strong": "#33334d",
        "color-focus-ring": "#818cf8",
        "color-accent": "#818cf8", "color-accent-hover": "#a5b4fc", "color-accent-soft": "#1e1b4b",
        "color-link": "#e8e8f0", "color-link-hover": "#a5b4fc",
        "color-success": "#34d399", "color-success-soft": "#064e3b",
        "color-warning": "#cbd5e1", "color-warning-soft": "#334155",
        "color-danger": "#fb7185", "color-danger-soft": "#881337",
        "shadow-1": "0 1px 1px rgba(8, 8, 20, 0.4), 0 1px 2px rgba(8, 8, 20, 0.55)",
        "shadow-2": "0 1px 2px rgba(8, 8, 20, 0.5), 0 4px 12px rgba(8, 8, 20, 0.65)",
        "shadow-3": "0 2px 4px rgba(8, 8, 20, 0.45), 0 12px 24px rgba(8, 8, 20, 0.7)",
        "shadow-4": "0 4px 8px rgba(8, 8, 20, 0.55), 0 24px 48px rgba(8, 8, 20, 0.8)",
      },
    },
    newspaper: {
      light: {
        "color-bg-canvas": "#f5f1e8", "color-bg-surface": "#fdfaf2",
        "color-bg-surface-raised": "#fdfaf2", "color-bg-overlay": "rgba(20, 20, 20, 0.55)",
        "color-fg": "#111111", "color-fg-muted": "#4a4a4a", "color-fg-subtle": "#8a8a8a",
        "color-fg-on-accent": "#fdfaf2", "color-fg-on-success": "#fdfaf2",
        "color-fg-on-warning": "#111111", "color-fg-on-danger": "#fdfaf2",
        "color-border": "#2a2a2a", "color-border-strong": "#111111",
        "color-focus-ring": "#8b0000",
        "color-accent": "#8b0000", "color-accent-hover": "#6b0000", "color-accent-soft": "#f0d6d6",
        "color-link": "#111111", "color-link-hover": "#8b0000",
        "color-success": "#14532d", "color-success-soft": "#d1fae5",
        "color-warning": "#92400e", "color-warning-soft": "#e2e8f0",
        "color-danger": "#8b0000", "color-danger-soft": "#fee2e2",
        "radius-none": "0", "radius-sm": "0", "radius-md": "0", "radius-lg": "0",
        "radius-xl": "0", "radius-full": "0",
        "shadow-1": "none", "shadow-2": "none", "shadow-3": "none", "shadow-4": "none",
        "font-serif": '"Playfair Display", "Bodoni 72", "Didot", "Times New Roman", ui-serif, Georgia, serif',
        "font-sans": '"IBM Plex Sans", "Helvetica Neue", system-ui, sans-serif',
        "font-mono": '"IBM Plex Mono", ui-monospace, "Courier New", monospace',
        "font-size-base": "1.0625rem", "line-height-base": "1.7",
        "font-size-h1": "3.25rem", "font-size-h2": "2.25rem", "font-size-h3": "1.625rem",
        "max-width": "64rem", "content-width": "40rem",
      },
      dark: {
        "color-bg-canvas": "#0e0d0a", "color-bg-surface": "#18160f",
        "color-bg-surface-raised": "#221f15", "color-bg-overlay": "rgba(0, 0, 0, 0.75)",
        "color-fg": "#f4ecd8", "color-fg-muted": "#b0a98f", "color-fg-subtle": "#7a7458",
        "color-fg-on-accent": "#0e0d0a", "color-fg-on-success": "#0e0d0a",
        "color-fg-on-warning": "#0e0d0a", "color-fg-on-danger": "#f4ecd8",
        "color-border": "#3a352a", "color-border-strong": "#5a5340",
        "color-focus-ring": "#d4d4d8",
        "color-accent": "#d4d4d8", "color-accent-hover": "#e5e7eb", "color-accent-soft": "#3a2f1c",
        "color-link": "#f4ecd8", "color-link-hover": "#d4d4d8",
        "color-success": "#9aae8c", "color-success-soft": "#2c3a25",
        "color-warning": "#e0a458", "color-warning-soft": "#3a2a16",
        "color-danger": "#e07a5f", "color-danger-soft": "#4a1f15",
        "font-serif": '"Playfair Display", "Bodoni 72", "Didot", "Times New Roman", ui-serif, Georgia, serif',
        "shadow-1": "none", "shadow-2": "none", "shadow-3": "none", "shadow-4": "none",
      },
    },
    editorial: {
      light: {
        "color-bg-canvas": "#fafaf9", "color-bg-surface": "#ffffff",
        "color-bg-surface-raised": "#ffffff", "color-bg-overlay": "rgba(20, 20, 20, 0.5)",
        "color-fg": "#0a0a0a", "color-fg-muted": "#525252", "color-fg-subtle": "#a3a3a3",
        "color-fg-on-accent": "#fafaf9", "color-fg-on-success": "#fafaf9",
        "color-fg-on-warning": "#0a0a0a", "color-fg-on-danger": "#fafaf9",
        "color-border": "#e5e5e5", "color-border-strong": "#d4d4d4",
        "color-focus-ring": "#0a0a0a",
        "color-accent": "#0a0a0a", "color-accent-hover": "#262626", "color-accent-soft": "#e5e5e5",
        "color-link": "#0a0a0a", "color-link-hover": "#525252",
        "color-success": "#166534", "color-success-soft": "#f0fdf4",
        "color-warning": "#475569", "color-warning-soft": "#e2e8f0",
        "color-danger": "#991b1b", "color-danger-soft": "#fef2f2",
        "radius-none": "0", "radius-sm": "2px", "radius-md": "4px", "radius-lg": "6px",
        "radius-xl": "10px", "radius-full": "9999px",
        "shadow-1": "0 1px 0 0 rgba(10, 10, 10, 0.04)",
        "shadow-2": "0 1px 2px 0 rgba(10, 10, 10, 0.04), 0 1px 0 0 rgba(10, 10, 10, 0.04)",
        "shadow-3": "0 2px 4px 0 rgba(10, 10, 10, 0.05), 0 1px 0 0 rgba(10, 10, 10, 0.04)",
        "shadow-4": "0 6px 16px 0 rgba(10, 10, 10, 0.06), 0 1px 0 0 rgba(10, 10, 10, 0.04)",
        "font-sans": '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        "font-size-base": "1.0625rem", "line-height-base": "1.75",
        "font-size-h1": "3rem", "font-size-h2": "2.125rem", "font-size-h3": "1.5rem",
        "max-width": "68rem", "content-width": "40rem",
      },
      dark: {
        "color-bg-canvas": "#0a0a0a", "color-bg-surface": "#141414",
        "color-bg-surface-raised": "#1f1f1f", "color-bg-overlay": "rgba(0, 0, 0, 0.8)",
        "color-fg": "#fafafa", "color-fg-muted": "#a3a3a3", "color-fg-subtle": "#525252",
        "color-fg-on-accent": "#0a0a0a", "color-fg-on-success": "#0a0a0a",
        "color-fg-on-warning": "#0a0a0a", "color-fg-on-danger": "#fafafa",
        "color-border": "#262626", "color-border-strong": "#404040",
        "color-focus-ring": "#fafafa",
        "color-accent": "#fafafa", "color-accent-hover": "#e5e5e5", "color-accent-soft": "#262626",
        "color-link": "#fafafa", "color-link-hover": "#d4d4d4",
        "color-success": "#4ade80", "color-success-soft": "#14532d",
        "color-warning": "#cbd5e1", "color-warning-soft": "#334155",
        "color-danger": "#f87171", "color-danger-soft": "#7f1d1d",
        "shadow-1": "0 1px 0 0 rgba(0, 0, 0, 0.5)",
        "shadow-2": "0 1px 2px 0 rgba(0, 0, 0, 0.4), 0 1px 0 0 rgba(0, 0, 0, 0.5)",
        "shadow-3": "0 2px 4px 0 rgba(0, 0, 0, 0.5), 0 1px 0 0 rgba(0, 0, 0, 0.4)",
        "shadow-4": "0 6px 16px 0 rgba(0, 0, 0, 0.6), 0 1px 0 0 rgba(0, 0, 0, 0.4)",
      },
    },
  };

  // A pre-paint base style so the browser never flashes white when
  // the resolved theme is dark. The values are the `default` light
  // canvas + fg; if the user's stored theme differs, the real
  // values overwrite them in the next step before the first paint
  // of any visible element.
  const PRE_PAINT_FALLBACK_BG = "#f7f7f6";
  const PRE_PAINT_FALLBACK_FG = "#1a1a1a";

  /**
   * @returns {StoredTheme | null}
   */
  function readStored() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed.theme !== "string") return null;
      const mode =
        parsed.mode === "dark" || parsed.mode === "light" || parsed.mode === "auto"
          ? parsed.mode
          : "auto";
      return { theme: parsed.theme, mode };
    } catch (e) {
      return null;
    }
  }

  /**
   * @param {StoredTheme} value
   */
  function writeStored(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  function hasTheme(name) {
    return Object.prototype.hasOwnProperty.call(THEMES, name);
  }

  /**
   * @param {StoredTheme} stored
   * @returns {'light'|'dark'}
   */
  function resolveMode(stored) {
    if (stored.mode === "light" || stored.mode === "dark") return stored.mode;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  }

  /**
   * Apply a theme in a given mode. Idempotent — re-applying with
   * the same args does not mutate the existing style tag's text.
   *
   * @param {string} themeName
   * @param {'light'|'dark'} mode
   */
  function applyTheme(themeName, mode) {
    const root = document.documentElement;
    if (!root) return;

    const themeSet = hasTheme(themeName) ? THEMES[themeName] : THEMES.default;
    const safeName = hasTheme(themeName) ? themeName : "default";
    const tokens = themeSet[mode] || themeSet.light;

    // 1. Default-attribute the root so the page never flashes the
    //    wrong theme. Set `color-scheme` for native form controls.
    root.setAttribute("data-theme", safeName);
    root.setAttribute("data-mode", mode);
    root.style.colorScheme = mode;

    // 2. Prime the canvas color so the very first paint already
    //    looks right. Browsers paint `<html>` background before
    //    they evaluate external stylesheets.
    const bg = tokens["color-bg-canvas"] || PRE_PAINT_FALLBACK_BG;
    const fg = tokens["color-fg"] || PRE_PAINT_FALLBACK_FG;
    root.style.backgroundColor = bg;
    root.style.color = fg;

    // 3. Build the layered CSS.
    const css = buildCSS(safeName, mode);
    upsertStyle(STYLE_ID, css, "tokens");

    // 4. Smooth motion (idempotent — see upsertStyle).
    upsertStyle(
      MOTION_STYLE_ID,
      `*, *::before, *::after { transition: background-color var(--motion-base, 200ms) var(--ease-out, ease-out), color var(--motion-base, 200ms) var(--ease-out, ease-out), border-color var(--motion-base, 200ms) var(--ease-out, ease-out), box-shadow var(--motion-base, 200ms) var(--ease-out, ease-out); } input, textarea, select, [contenteditable="true"] { transition: none !important; }`,
      "motion",
    );
  }

  /**
   * @param {string} themeName
   * @param {'light'|'dark'} mode
   * @returns {string}
   */
  function buildCSS(themeName, mode) {
    const themeSet = THEMES[themeName] || THEMES.default;
    const light = themeSet.light || {};
    const dark = themeSet.dark || light;
    const lightBlock = renderBlock(light, "  ");
    const darkBlock = renderBlock(dark, "  ");
    return `@layer ${LAYER_NAME} {\n:root {\n${lightBlock}\n}\n\n[data-mode="dark"] {\n${darkBlock}\n}\n}`;
  }

  /**
   * @param {Record<string,string>} tokens
   * @param {string} indent
   */
  function renderBlock(tokens, indent) {
    const lines = [];
    for (const key of Object.keys(tokens)) {
      const value = String(tokens[key]).replace(/"/g, '\\"');
      lines.push(`${indent}--${key}: ${value};`);
    }
    return lines.join("\n");
  }

  /**
   * Insert or update a `<style>` tag. Idempotent: re-setting the
   * same content is a no-op (we compare the textContent).
   *
   * @param {string} id
   * @param {string} css
   * @param {string} marker
   */
  function upsertStyle(id, css, marker) {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.textContent !== css) existing.textContent = css;
      return existing;
    }
    const style = document.createElement("style");
    style.id = id;
    style.setAttribute("data-qcms-theme", marker);
    style.textContent = css;
    // Append to <head>; if head isn't ready yet, fall back to
    // appending to the documentElement (it always exists).
    (document.head || document.documentElement).appendChild(style);
    return style;
  }

  /**
   * @returns {StoredTheme}
   */
  function resolveInitial() {
    const stored = readStored();
    if (stored && hasTheme(stored.theme)) {
      return { theme: stored.theme, mode: stored.mode };
    }
    return { theme: "default", mode: "auto" };
  }

  /**
   * Re-apply the active theme in the current OS color scheme.
   * No-op when the user has explicitly chosen light or dark.
   */
  function applyFromCurrent() {
    const stored = readStored() || { theme: "default", mode: "auto" };
    const mode = resolveMode(stored);
    applyTheme(stored.theme, mode);
  }

  // Expose a small API for the admin app / cross-tab updates.
  /** @type {{get():StoredTheme, set(StoredTheme):void, list():string[], cycle():string}} */
  window.QCMS_THEME = {
    get: function () {
      const stored = readStored();
      return stored || { theme: "default", mode: "auto" };
    },
    set: function (value) {
      if (!value || typeof value !== "object") return;
      const theme = hasTheme(value.theme) ? value.theme : "default";
      const mode =
        value.mode === "dark" || value.mode === "light" || value.mode === "auto"
          ? value.mode
          : "auto";
      const next = { theme, mode };
      writeStored(next);
      applyTheme(theme, resolveMode(next));
    },
    list: function () {
      return Object.keys(THEMES);
    },
    cycle: function () {
      const current = readStored() || { theme: "default", mode: "auto" };
      const names = Object.keys(THEMES);
      const idx = names.indexOf(current.theme);
      const next = names[(idx + 1 + names.length) % names.length] || "default";
      const value = { theme: next, mode: current.mode || "auto" };
      writeStored(value);
      applyTheme(next, resolveMode(value));
      return next;
    },
  };

  // 1. Apply immediately and synchronously, before any visible
  //    paint. This is the whole point of having this script in
  //    <head> with no defer/async.
  const initial = resolveInitial();
  applyTheme(initial.theme, resolveMode(initial));

  // 2. Live OS color-scheme changes — only honor them when the
  //    user is in `auto` mode (so explicit choices are sticky).
  if (typeof window.matchMedia === "function") {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onMqlChange = function () {
      const stored = readStored();
      if (!stored) {
        applyTheme("default", mql.matches ? "dark" : "light");
        return;
      }
      if (stored.mode === "auto") {
        applyTheme(stored.theme, mql.matches ? "dark" : "light");
      }
    };
    if (mql.addEventListener) {
      mql.addEventListener("change", onMqlChange);
    } else if (mql.addListener) {
      mql.addListener(onMqlChange);
    }
  }

  // 3. Cross-tab sync via the `storage` event.
  window.addEventListener("storage", function (ev) {
    if (ev.key !== STORAGE_KEY) return;
    applyFromCurrent();
  });
})();
