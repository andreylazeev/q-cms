/**
 * Singleton {@link I18n} instance pre-loaded with English and Russian
 * translation dictionaries.
 *
 * The provider at `I18nProviderClient.tsx` is the only place that
 * mutates the active locale (via `setLocale`); everything else reads
 * through `useI18n()` / `useTranslation()` so the React tree re-renders
 * on locale change.
 *
 * Keys are namespaced under `admin` so consumers can use
 * `useTranslation<typeof en>("admin")` for type-safe key access.
 */

import { I18n } from '@q-cms/i18n';
import { en } from './locales/en.ts';
import { ru } from './locales/ru.ts';

/** Locale codes supported by the admin UI in v0.1. */
export const SUPPORTED_LOCALES = ['en', 'ru'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Default locale when no user preference is stored. */
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/** Display name → code, used by the language switcher. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  ru: 'Русский',
};

/** localStorage key for the user's selected locale. */
export const LOCALE_STORAGE_KEY = 'q-cms-admin:locale';

/** Single I18n instance for the whole admin tree. */
export const i18n = new I18n({
  defaultLocale: DEFAULT_LOCALE,
  locales: [...SUPPORTED_LOCALES],
  fallbackLocale: DEFAULT_LOCALE,
});

// Load the namespace under "admin" — keys in en.ts are written
// without an "admin." prefix on purpose, so consumers pass the
// namespace explicitly to useTranslation("admin").
i18n.loadTranslations('en', 'admin', en);
i18n.loadTranslations('ru', 'admin', ru);

/**
 * Read a stored locale, validating it against the configured set.
 * Returns the default locale when no preference is stored or the
 * stored value is unrecognized (e.g. after a downgrade).
 */
export function readStoredLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
      return raw as SupportedLocale;
    }
  } catch {
    // localStorage can throw in private mode / sandboxed iframes;
    // fall through to the default.
  }
  return DEFAULT_LOCALE;
}

/** Persist the chosen locale. Best-effort — failures are swallowed. */
export function writeStoredLocale(locale: SupportedLocale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore quota / private-mode errors.
  }
}

/** Type guard for {@link SupportedLocale}. */
export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
