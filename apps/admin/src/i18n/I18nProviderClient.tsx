'use client';

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
 * Locale changes go through {@link setLocaleFromUi} which dispatches
 * a `q-cms:locale-changed` event. The provider listens for that
 * event and bumps a version counter that's spread into a context
 * so all `useI18n()` consumers re-render with the new locale.
 *
 * The provider intentionally re-uses the singleton instead of creating
 * a new I18n per mount — `setLocale` is the only mutable state, and
 * React state here just propagates a version counter to trigger
 * re-renders.
 */

import { I18nProvider, type UseI18nReturn } from '@q-cms/i18n/react';
import * as React from 'react';
import {
  DEFAULT_LOCALE,
  type SupportedLocale,
  isSupportedLocale,
  readStoredLocale,
  writeStoredLocale,
} from './setup.ts';
import { i18n } from './setup.ts';

export interface I18nProviderClientProps {
  children: React.ReactNode;
}

export function I18nProviderClient({ children }: I18nProviderClientProps): React.JSX.Element {
  // Initial mount: hydrate the active locale from localStorage and
  // keep document.lang in sync. Done in an effect (not during render)
  // so the server-rendered HTML uses the default locale and we don't
  // trip React's hydration warning.
  //
  // `useI18n()` already subscribes to locale changes via
  // `useSyncExternalStore`, so we don't need a `key` prop or a
  // version bump to re-render consumers here.
  React.useEffect(() => {
    const stored = readStoredLocale();
    if (stored !== i18n.getLocale()) {
      i18n.setLocale(stored);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = stored;
    }
  }, []);

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

/**
 * Subscribe to the current locale with a stable callback for the
 * language switcher. Calls `onChange` once on mount with the
 * current locale (defaulting to the stored preference); further
 * updates flow through {@link setLocaleFromUi} directly.
 */
export function useLocaleSync(onChange: (locale: SupportedLocale) => void): void {
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  React.useEffect(() => {
    const stored = readStoredLocale();
    if (stored !== i18n.getLocale()) {
      i18n.setLocale(stored);
    }
    onChangeRef.current(i18n.getLocale() as SupportedLocale);
  }, []);
}

/**
 * Programmatic locale switch used by the language picker. Persists
 * the choice to localStorage, updates the I18n instance, and reflects
 * the new value on `<html lang>`. Subscribed `useI18n()` consumers
 * re-render automatically via `useSyncExternalStore`.
 */
export function setLocaleFromUi(next: SupportedLocale): void {
  if (!isSupportedLocale(next)) return;
  i18n.setLocale(next);
  writeStoredLocale(next);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
  }
}

export type { UseI18nReturn };
export { DEFAULT_LOCALE };
