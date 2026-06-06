import type {
  DeepValue,
  I18nConfig,
  InterpolationParams,
  Namespace,
  PluralCategory,
  TranslationKey,
  TranslationValue,
  Translations,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INTERPOLATION_RE = /\{\{(\w+)\}\}/g;

/**
 * Replace `{{key}}` placeholders with values from `params`.
 * Keys not found in `params` are left untouched.
 */
function interpolate(
  template: string,
  params?: InterpolationParams,
): string {
  if (!params) return template;
  return template.replace(INTERPOLATION_RE, (_match, key: string) => {
    const val = params[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

/**
 * Select the best plural category for `count` per `locale`.
 * Falls back to `"other"` when the source has no match.
 */
function selectPluralCategory(
  count: number,
  locale: string,
): PluralCategory {
  try {
    const rules = new Intl.PluralRules(locale);
    return rules.select(count) as PluralCategory;
  } catch {
    // Unknown locale — default to English-style rules.
    return count === 1 ? "one" : "other";
  }
}

/**
 * Walk a nested translations object by dot-separated path.
 * Returns `undefined` when any segment is missing or the path
 * resolves to a non-leaf value.
 */
function resolvePath(
  translations: Translations,
  path: string,
): TranslationValue | undefined {
  const segments = path.split(".");
  let current: TranslationValue | Translations | undefined = translations;

  for (const segment of segments) {
    if (current === undefined || current === null) return undefined;
    if (typeof current === "string") return undefined;
    // Check for pluralized record at leaf
    if (
      typeof current === "object" &&
      "other" in current &&
      "one" in current
    ) {
      // We're at a leaf plural record — can't go deeper
      return undefined;
    }
    current = (current as Translations)[segment];
  }

  if (current === undefined || current === null) return undefined;

  // Must be a leaf value
  if (typeof current === "string") return current;
  if (typeof current === "object" && "other" in current) {
    return current as PluralizedTranslationShape;
  }

  return undefined;
}

/** Narrow shape for runtime plural checks. */
type PluralizedTranslationShape = {
  [C in PluralCategory]?: string;
} & { other: string };

// ---------------------------------------------------------------------------
// I18n class
// ---------------------------------------------------------------------------

/**
 * Locale-aware translation engine with zero external dependencies.
 *
 * Features:
 * - `{{key}}` interpolation
 * - Dot-notation nested key paths (`"admin.settings.title"`)
 * - Pluralization via `{{count}}` + `Intl.PluralRules`
 * - Locale-aware number, date, and relative-time formatting
 * - Namespace-scoped translation loading
 * - Fallback locale chain
 *
 * @typeParam TSchema — optional translations schema for static key checking
 *
 * @example
 * ```ts
 * const i18n = new I18n({ defaultLocale: "en", locales: ["en", "fr"] });
 * i18n.loadTranslations("en", "common", {
 *   greeting: "Hello {{name}}",
 *   items: { one: "{{count}} item", other: "{{count}} items" },
 * });
 * i18n.t("common.greeting", { name: "Alice" }); // "Hello Alice"
 * i18n.t("common.items", { count: 3 });          // "3 items"
 * ```
 */
export class I18n<
  TSchema extends Record<string, unknown> = Record<string, string>,
> {
  readonly #config: Readonly<Required<I18nConfig>>;
  readonly #store: Map<string, Translations>;
  #locale: string;
  readonly #listeners: Set<() => void> = new Set();

  constructor(config: I18nConfig) {
    this.#config = {
      defaultLocale: config.defaultLocale,
      locales: config.locales,
      fallbackLocale: config.fallbackLocale ?? config.defaultLocale,
    };
    this.#store = new Map();
    this.#locale = config.defaultLocale;

    if (config.locales.length === 0) {
      throw new Error("[i18n] At least one locale must be provided");
    }
  }

  // -----------------------------------------------------------------------
  // Locale management
  // -----------------------------------------------------------------------

  /** Switch the active locale. Must be one of the configured `locales`. */
  setLocale(locale: string): void {
    if (!this.#config.locales.includes(locale)) {
      throw new Error(
        `[i18n] Locale "${locale}" is not in the configured locales: ${this.#config.locales.join(", ")}`,
      );
    }
    if (this.#locale === locale) return;
    this.#locale = locale;
    for (const listener of this.#listeners) {
      listener();
    }
  }

  /** Return the currently active locale code. */
  getLocale(): string {
    return this.#locale;
  }

  /** Return all configured locales. */
  getLocales(): readonly string[] {
    return this.#config.locales;
  }

  /**
   * Subscribe to locale changes. The callback fires AFTER the active
   * locale has been updated. Returns an unsubscribe function.
   *
   * Designed for use with `useSyncExternalStore` in React bindings.
   */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  // -----------------------------------------------------------------------
  // Translation loading
  // -----------------------------------------------------------------------

  /**
   * Load (or overwrite) translations for a given locale+namespace pair.
   *
   * Keys from the loaded translations are merged at the top level of the
   * namespace. Existing keys for that locale+namespace are replaced.
   */
  loadTranslations(
    locale: string,
    namespace: Namespace,
    translations: Translations,
  ): void {
    const storeKey = `${locale}:${namespace}`;
    const existing = this.#store.get(storeKey) ?? {};
    this.#store.set(storeKey, { ...existing, ...translations });
  }

  // -----------------------------------------------------------------------
  // Core translation
  // -----------------------------------------------------------------------

  /**
   * Translate a dot-separated key.
   *
   * Resolution order:
   * 1. Active locale
   * 2. Fallback locale (if different)
   *
   * @param key       — dot-path into the merged translations tree (e.g. `"auth.login.title"`)
   * @param params    — interpolation values for `{{key}}` placeholders
   * @param locale    — override locale for this call (default: active locale)
   */
  t<K extends TranslationKey<TSchema>>(
    key: K,
    params?: InterpolationParams,
    locale?: string,
  ): DeepValue<TSchema, K> & string;
  t(key: string, params?: InterpolationParams, locale?: string): string {
    const loc = locale ?? this.#locale;
    const value = this.#resolveValue(key, loc);

    if (value === undefined) {
      const chain: string[] = [];
      if (loc !== this.#config.fallbackLocale) {
        chain.push(this.#config.fallbackLocale);
      }
      chain.push(this.#config.defaultLocale);

      for (const fallback of chain) {
        if (fallback === loc) continue;
        const fb = this.#resolveValue(key, fallback);
        if (fb !== undefined) {
          return this.#renderValue(fb, params, fallback);
        }
      }

      return key; // Last-resort: return the key itself
    }

    return this.#renderValue(value, params, loc);
  }

  // -----------------------------------------------------------------------
  // Formatting
  // -----------------------------------------------------------------------

  /**
   * Format a number according to `locale` conventions.
   *
   * @example
   * ```ts
   * i18n.formatNumber(1234567.89);           // "1,234,567.89" (en)
   * i18n.formatNumber(1234567.89, "de-DE");  // "1.234.567,89"
   * ```
   */
  formatNumber(value: number, locale?: string): string {
    try {
      return new Intl.NumberFormat(locale ?? this.#locale).format(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Format a date according to `locale` conventions.
   *
   * @example
   * ```ts
   * i18n.formatDate(new Date("2026-01-15")); // "1/15/2026" (en-US)
   * ```
   */
  formatDate(
    value: Date | number | string,
    locale?: string,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    const date = value instanceof Date ? value : new Date(value);
    try {
      return new Intl.DateTimeFormat(
        locale ?? this.#locale,
        options ?? {
          year: "numeric",
          month: "short",
          day: "numeric",
        },
      ).format(date);
    } catch {
      return date.toLocaleDateString(locale ?? this.#locale);
    }
  }

  /**
   * Format a value as a relative time expression ("2 hours ago", "in 3 days").
   *
   * @param value — a `Date`, timestamp, or ISO string to compare against `now`
   * @param locale — locale override (default: active locale)
   * @param now — reference timestamp (default: `Date.now()`)
   *
   * @example
   * ```ts
   * i18n.formatRelativeTime(new Date(Date.now() - 7200000)); // "2 hours ago"
   * ```
   */
  formatRelativeTime(
    value: Date | number | string,
    locale?: string,
    now?: Date | number,
  ): string {
    const date = value instanceof Date ? value : new Date(value);
    const ref = now !== undefined ? (now instanceof Date ? now : new Date(now)) : new Date();
    const diffMs = date.getTime() - ref.getTime();
    const absMs = Math.abs(diffMs);

    const units: [number, Intl.RelativeTimeFormatUnit][] = [
      [365.25 * 24 * 60 * 60 * 1000, "year"],
      [30 * 24 * 60 * 60 * 1000, "month"],
      [7 * 24 * 60 * 60 * 1000, "week"],
      [24 * 60 * 60 * 1000, "day"],
      [60 * 60 * 1000, "hour"],
      [60 * 1000, "minute"],
      [1000, "second"],
    ];

    for (const [threshold, unit] of units) {
      if (absMs >= threshold || unit === "second") {
        const value = Math.round(diffMs / threshold);
        try {
          return new Intl.RelativeTimeFormat(
            locale ?? this.#locale,
            { numeric: "auto" },
          ).format(value, unit);
        } catch {
          // Fallback: crude English relative time
          const abs = Math.abs(value);
          const unitStr = abs === 1 ? unit : `${unit}s`;
          if (value === 0) return `now`;
          if (value < 0) return `${abs} ${unitStr} ago`;
          return `in ${abs} ${unitStr}`;
        }
      }
    }

    return "now";
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  /**
   * Walk all loaded namespaces for `locale` and return the first
   * matching translation value at `key`.
   */
  #resolveValue(key: string, locale: string): TranslationValue | undefined {
    const prefix = `${locale}:`;
    for (const [storeKey, translations] of this.#store) {
      if (!storeKey.startsWith(prefix)) continue;
      // Strip namespace prefix from key: "common.greeting" → "greeting"
      const namespace = storeKey.slice(prefix.length);
      const remainder = key.startsWith(namespace + ".")
        ? key.slice(namespace.length + 1)
        : key;
      const resolved = resolvePath(translations, remainder);
      if (resolved !== undefined) return resolved;
    }
    return undefined;
  }

  /**
   * Given a resolved {@link TranslationValue}, apply interpolation
   * and (if applicable) plural selection.
   */
  #renderValue(
    value: TranslationValue,
    params: InterpolationParams | undefined,
    locale: string,
  ): string {
    if (typeof value === "string") {
      return interpolate(value, params);
    }

    // Pluralized translation
    const count =
      params !== undefined && "count" in params
        ? Number(params["count"])
        : 0;
    const category = selectPluralCategory(count, locale);

    // Try exact category, then "other" fallback
    const record = value as PluralizedTranslationShape;
    const template = record[category] ?? record.other;
    if (template === undefined) return String(count);

    return interpolate(template, params);
  }
}
