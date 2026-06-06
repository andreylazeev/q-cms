/**
 * React integration for @q-cms/i18n.
 *
 * Provides context-based I18n access via hooks. SSR-safe — no side
 * effects at module scope, all state lives in React context.
 */
import * as React from "react";
import { I18n } from "./i18n.ts";
import type {
  DeepValue,
  InterpolationParams,
  Namespace,
  TranslationKey,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const I18nContext = React.createContext<I18n | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface I18nProviderProps {
  /** Configured {@link I18n} instance. */
  readonly i18n: I18n;
  readonly children: React.ReactNode;
}

/**
 * Provide an {@link I18n} instance to the React tree.
 *
 * SSR-compatible: no module-level state, no side effects on import.
 *
 * @example
 * ```tsx
 * const i18n = new I18n({ defaultLocale: "en", locales: ["en", "fr"] });
 * i18n.loadTranslations("en", "common", { hello: "Hello {{name}}" });
 *
 * function App() {
 *   return (
 *     <I18nProvider i18n={i18n}>
 *       <Page />
 *     </I18nProvider>
 *   );
 * }
 * ```
 */
export function I18nProvider({
  i18n,
  children,
}: I18nProviderProps): React.ReactElement {
  return React.createElement(I18nContext.Provider, { value: i18n }, children);
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function useI18nInstance(): I18n {
  const ctx = React.useContext(I18nContext);
  if (ctx === null) {
    throw new Error(
      "[i18n] useI18n() / useTranslation() must be used within an <I18nProvider>",
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// useI18n
// ---------------------------------------------------------------------------

/** Return value shape for {@link useI18n}. */
export interface UseI18nReturn {
  /** Translate a key with optional interpolation. */
  t: (key: string, params?: InterpolationParams) => string;

  /** Current active locale. */
  locale: string;

  /** Switch the active locale (re-renders consumers). */
  setLocale: (locale: string) => void;

  /** Format a number per current locale conventions. */
  formatNumber: (value: number, locale?: string) => string;

  /** Format a date per current locale conventions. */
  formatDate: (
    value: Date | number | string,
    locale?: string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;

  /** Format a relative time expression ("2 hours ago"). */
  formatRelativeTime: (
    value: Date | number | string,
    locale?: string,
    now?: Date | number,
  ) => string;
}

/**
 * Access the global i18n instance.
 *
 * Returns bound methods that always operate on the current locale.
 * When `setLocale` is called, the component re-renders with the
 * updated locale reflected in `t`, `formatNumber`, etc.
 *
 * @example
 * ```tsx
 * function Header() {
 *   const { t, locale, setLocale } = useI18n();
 *   return (
 *     <header>
 *       <h1>{t("site.title")}</h1>
 *       <select value={locale} onChange={e => setLocale(e.target.value)}>
 *         <option value="en">English</option>
 *         <option value="fr">Français</option>
 *       </select>
 *     </header>
 *   );
 * }
 * ```
 */
export function useI18n(): UseI18nReturn {
  const i18n = useI18nInstance();

  // useSyncExternalStore keeps `locale` in lockstep with the I18n
  // instance — whether setLocale is called via this hook's setter
  // or through the singleton from anywhere else (e.g. another module
  // importing the same i18n instance). The `subscribe` noop for
  // the server guarantees SSR consistency.
  const locale = React.useSyncExternalStore(
    React.useCallback(
      (onStoreChange: () => void) => i18n.subscribe(onStoreChange),
      [i18n],
    ),
    () => i18n.getLocale(),
    () => i18n.getLocale(),
  );

  const setLocale = React.useCallback(
    (next: string) => {
      i18n.setLocale(next);
    },
    [i18n],
  );

  const t = React.useCallback(
    (key: string, params?: InterpolationParams) => i18n.t(key, params),
    [i18n, locale],
  );

  const formatNumber = React.useCallback(
    (value: number, loc?: string) => i18n.formatNumber(value, loc),
    [i18n, locale],
  );

  const formatDate = React.useCallback(
    (
      value: Date | number | string,
      loc?: string,
      options?: Intl.DateTimeFormatOptions,
    ) => i18n.formatDate(value, loc, options),
    [i18n, locale],
  );

  const formatRelativeTime = React.useCallback(
    (value: Date | number | string, loc?: string, now?: Date | number) =>
      i18n.formatRelativeTime(value, loc, now),
    [i18n, locale],
  );

  return React.useMemo(
    () => ({ t, locale, setLocale, formatNumber, formatDate, formatRelativeTime }),
    [t, locale, setLocale, formatNumber, formatDate, formatRelativeTime],
  );
}

// ---------------------------------------------------------------------------
// useTranslation
// ---------------------------------------------------------------------------

/**
 * Return value shape for {@link useTranslation}.
 *
 * @typeParam TSchema — namespace-scoped translations schema
 */
export interface UseTranslationReturn<TSchema extends Record<string, unknown>> {
  /** Translate a key within the namespace (no need to prefix with namespace). */
  t: <K extends TranslationKey<TSchema> & string>(
    key: K,
    params?: InterpolationParams,
  ) => DeepValue<TSchema, K>;

  /** Current active locale. */
  locale: string;
}

/**
 * Access namespace-scoped translations.
 *
 * Keys passed to `t()` are resolved relative to the given namespace,
 * so `t("title")` inside `useTranslation("admin")` resolves to
 * `"admin.title"`.
 *
 * @typeParam TSchema — translations schema for type-safe keys/return values
 *
 * @example
 * ```tsx
 * function AdminPanel() {
 *   const { t, locale } = useTranslation<typeof adminEn>("admin");
 *   return <h1>{t("settings.title")}</h1>; // resolves admin.settings.title
 * }
 * ```
 */
export function useTranslation<TSchema extends Record<string, unknown> = Record<string, unknown>>(
  namespace: Namespace,
): UseTranslationReturn<TSchema> {
  const i18n = useI18nInstance();
  const locale = i18n.getLocale();

  const t = React.useCallback(
    (key: string, params?: InterpolationParams) =>
      i18n.t(`${namespace}.${key}`, params),
    [i18n, namespace],
  ) as UseTranslationReturn<TSchema>["t"];

  return React.useMemo(() => ({ t, locale }), [t, locale]);
}
