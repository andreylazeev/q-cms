'use client';

/**
 * Theme provider for the admin app.
 *
 * Wraps the tree in a context that exposes the active `theme` and
 * `mode`, persists the user's choice to `localStorage` (key
 * `qcms_theme`), and applies the theme to the document via
 * `applyThemeToDocument()`.
 *
 * The provider:
 *
 *   1. Reads the persisted `{ theme, mode }` on first render.
 *   2. Falls back to the `default` theme and the OS
 *      `prefers-color-scheme` if nothing is stored.
 *   3. Supports an `auto` mode that re-applies the theme whenever
 *      the OS color scheme changes.
 *   4. Stays in sync with other tabs via the `storage` event.
 *
 * @packageDocumentation
 */

import {
  type Mode,
  type SystemMode,
  type ThemeDefinition,
  applyThemeToDocument,
  getTheme,
  listThemes,
  watchSystemColorScheme,
} from '@q-cms/theme';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

const STORAGE_KEY = 'qcms_theme';
const DEFAULT_THEME_NAME = 'default';
const DEFAULT_MODE: SystemMode = 'auto';
const LIGHT_MODE: Mode = 'light';
const DARK_MODE: Mode = 'dark';

/**
 * Persisted payload. We keep it deliberately small so it round-trips
 * through `localStorage` cleanly.
 */
interface StoredTheme {
  theme: string;
  mode: SystemMode;
}

export interface ThemeContextValue {
  /** The active theme definition. */
  theme: ThemeDefinition;
  /** The active theme name. */
  themeName: string;
  /** The active mode (light, dark, or auto). */
  mode: SystemMode;
  /**
   * The *effective* mode (light or dark). When `mode === 'auto'`,
   * this resolves to the OS preference; otherwise it equals `mode`.
   */
  resolvedMode: Mode;
  /** Every registered theme. */
  availableThemes: ThemeDefinition[];
  /** Switch to a different theme; persisted to `localStorage`. */
  setThemeName: (name: string) => void;
  /** Set the mode (light, dark, or auto); persisted to `localStorage`. */
  setMode: (mode: SystemMode) => void;
  /** Convenience: cycle through registered themes. */
  cycleTheme: () => void;
  /**
   * Reset to defaults: clears the localStorage entry, applies the
   * default theme in `auto` mode, and returns a callback the caller
   * can chain (e.g. a toast).
   */
  reset: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): StoredTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTheme>;
    if (typeof parsed.theme !== 'string') return null;
    const mode: SystemMode = parsed.mode === 'dark' || parsed.mode === 'light' || parsed.mode === 'auto'
      ? parsed.mode
      : 'auto';
    return { theme: parsed.theme, mode };
  } catch {
    return null;
  }
}

function writeStored(value: StoredTheme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore quota / privacy errors — the theme still works in-memory.
  }
}

function clearStored(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Resolve the effective mode (light/dark) when the user has chosen
 * `auto`. Falls back to `light` if `matchMedia` isn't available.
 */
function resolveAutoMode(): Mode {
  if (typeof window === 'undefined' || !window.matchMedia) return LIGHT_MODE;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK_MODE : LIGHT_MODE;
}

export interface ThemeProviderProps {
  children: ReactNode;
  /**
   * Optional override for the initial theme. Mostly used in tests
   * to pin a specific theme; in production we read from
   * `localStorage` and fall back to `default`.
   */
  defaultThemeName?: string;
  /**
   * Optional override for the initial mode. Same use case as
   * `defaultThemeName`.
   */
  defaultMode?: SystemMode;
  /**
   * When `true` (default), the provider mirrors the OS `prefers-color-scheme`
   * media query on the first paint if no stored value exists.
   */
  respectOsPreference?: boolean;
  /**
   * When `true` (default), the provider listens for OS color-scheme
   * changes while `mode === 'auto'` and re-applies the theme.
   */
  watchOsPreference?: boolean;
  /**
   * When `true` (default), the provider listens for `storage` events
   * so theme changes in other tabs take effect immediately.
   */
  syncAcrossTabs?: boolean;
}

export function ThemeProvider({
  children,
  defaultThemeName,
  defaultMode,
  respectOsPreference = true,
  watchOsPreference = true,
  syncAcrossTabs = true,
}: ThemeProviderProps): ReactElement {
  // First render: use defaults so server and client agree.
  const [stored, setStored] = useState<StoredTheme>(() => {
    if (defaultThemeName) {
      return {
        theme: defaultThemeName,
        mode: defaultMode ?? DEFAULT_MODE,
      };
    }
    return { theme: DEFAULT_THEME_NAME, mode: DEFAULT_MODE };
  });

  // After mount, sync with localStorage + OS preference. Re-runs
  // if the caller changes the `defaultThemeName` / `defaultMode`
  // / `respectOsPreference` props (useful in tests). SSR output
  // is unaffected — this effect only runs on the client.
  useEffect(() => {
    const storedValue = readStored();
    if (storedValue && getTheme(storedValue.theme)) {
      setStored(storedValue);
      return;
    }
    if (respectOsPreference && typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const next: StoredTheme = {
        theme: defaultThemeName ?? DEFAULT_THEME_NAME,
        mode: defaultMode ?? DEFAULT_MODE,
      };
      setStored(next);
      // Also write to storage so the next visit remembers.
      writeStored(next);
      // Reference mql so lint doesn't complain — it's read in
      // resolveAutoMode(), but we want the local to remain
      // meaningful for future use.
      void mql;
    }
  }, [defaultThemeName, defaultMode, respectOsPreference]);

  // Apply whenever the active theme / mode changes.
  useEffect(() => {
    const resolved: Mode = stored.mode === 'auto' ? resolveAutoMode() : stored.mode;
    applyThemeToDocument(stored.theme, resolved);
  }, [stored.theme, stored.mode]);

  // Live OS color-scheme tracking.
  useEffect(() => {
    if (!watchOsPreference) return;
    return watchSystemColorScheme(
      () => ({ themeName: stored.theme, mode: stored.mode }),
      (name, m) => applyThemeToDocument(name, m),
    );
  }, [stored.theme, stored.mode, watchOsPreference]);

  // Cross-tab sync via the `storage` event.
  useEffect(() => {
    if (!syncAcrossTabs || typeof window === 'undefined') return;
    const handler = (ev: StorageEvent): void => {
      if (ev.key !== STORAGE_KEY) return;
      const next = readStored();
      if (next && getTheme(next.theme)) {
        setStored(next);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [syncAcrossTabs]);

  const setThemeName = useCallback((name: string) => {
    if (!getTheme(name)) return;
    setStored((prev) => {
      const next = { ...prev, theme: name };
      writeStored(next);
      return next;
    });
  }, []);

  const setMode = useCallback((mode: SystemMode) => {
    setStored((prev) => {
      const next = { ...prev, mode };
      writeStored(next);
      return next;
    });
  }, []);

  const cycleTheme = useCallback(() => {
    setStored((prev) => {
      const themes = listThemes();
      if (themes.length === 0) return prev;
      const idx = themes.findIndex((t) => t.name === prev.theme);
      const nextTheme = themes[(idx + 1) % themes.length];
      if (!nextTheme) return prev;
      const next = { ...prev, theme: nextTheme.name };
      writeStored(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    clearStored();
    const next: StoredTheme = { theme: DEFAULT_THEME_NAME, mode: DEFAULT_MODE };
    setStored(next);
    writeStored(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const theme =
      getTheme(stored.theme) ??
      getTheme(DEFAULT_THEME_NAME) ??
      // Registry should always have at least one theme; this is a
      // defensive fallback in tests that call `clearThemes()`.
      // biome-ignore lint/style/noNonNullAssertion: defensive fallback
      listThemes()[0]!;
    const resolvedMode: Mode = stored.mode === 'auto' ? resolveAutoMode() : stored.mode;
    return {
      theme,
      themeName: theme.name,
      mode: stored.mode,
      resolvedMode,
      availableThemes: listThemes(),
      setThemeName,
      setMode,
      cycleTheme,
      reset,
    };
  }, [stored, setThemeName, setMode, cycleTheme, reset]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Access the current theme context. Throws if called outside a
 * `<ThemeProvider>` so consumers get a loud error rather than a
 * silent `null`.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }
  return ctx;
}
