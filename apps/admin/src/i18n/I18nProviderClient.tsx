"use client";

/**
 * Client-side I18n provider.
 *
 * The shared `i18n` singleton is created at module load with the
 * default locale, but we want the active locale to follow the user's
 * stored preference (or the browser language on first visit). This
 * component:
 *
 *  1. Reads the stored locale in an effect so SSR markup uses the
 *     default (no hydration mismatch).
 *  2. Calls `i18n.setLocale(...)` and re-renders consumers.
 *  3. Updates `document.documentElement.lang` so screen readers and
 *     the browser's hyphenation/IME pick the right language.
 *
 * The provider intentionally re-uses the singleton instead of creating
 * a new I18n per mount — `setLocale` is the only mutable state, and
 * React state here just propagates a version counter to trigger
 * re-renders.
 */

import * as React from "react";
import { I18nProvider, type UseI18nReturn } from "@q-cms/i18n/react";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  readStoredLocale,
  writeStoredLocale,
  type SupportedLocale,
} from "./setup.ts";
import { i18n } from "./setup.ts";

export interface I18nProviderClientProps {
  children: React.ReactNode;
}

export function I18nProviderClient({
  children,
}: I18nProviderClientProps): React.JSX.Element {
  // Bump this counter on every setLocale() so consumers that read
  // the i18n instance directly (not via hooks) also re-render.
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  // Initial mount: hydrate the active locale from localStorage and
  // keep document.lang in sync. Done in an effect (not during render)
  // so the server-rendered HTML uses the default locale and we don't
  // trip React's hydration warning.
  React.useEffect(() => {
    const stored = readStoredLocale();
    if (stored !== i18n.getLocale()) {
      i18n.setLocale(stored);
      forceUpdate();
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = stored;
    }
  }, []);

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

/**
 * Subscribe to the current locale with a stable callback for the
 * language switcher. Calls `onChange` whenever the user picks a new
 * locale via `setLocale`, so a `<select>` can stay controlled.
 */
export function useLocaleSync(
  onChange: (locale: SupportedLocale) => void,
): void {
  React.useEffect(() => {
    const stored = readStoredLocale();
    if (stored !== i18n.getLocale()) {
      i18n.setLocale(stored);
    }
    onChange(i18n.getLocale() as SupportedLocale);
    // Run only on mount — the caller owns further updates via
    // setLocaleFromUi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Programmatic locale switch used by the language picker. Persists
 * the choice to localStorage, updates the I18n instance, and reflects
 * the new value on `<html lang>`.
 */
export function setLocaleFromUi(next: SupportedLocale): void {
  if (!isSupportedLocale(next)) return;
  i18n.setLocale(next);
  writeStoredLocale(next);
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
  }
  // Force a synthetic re-render on consumers that don't subscribe via
  // useI18n (e.g. the AppRouterCacheProvider). The hook layer already
  // re-renders on its own.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("q-cms:locale-changed", { detail: next }));
  }
}

export type { UseI18nReturn };
export { DEFAULT_LOCALE };
