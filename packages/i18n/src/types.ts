import type { Locale } from "@q-cms/core";

// ---------------------------------------------------------------------------
// Translation value shapes
// ---------------------------------------------------------------------------

/**
 * Permitted plural categories (CLDR / ICU subset).
 *
 * `zero`, `one`, `two`, `few`, `many` are locale-dependent;
 * `other` is the universal fallback and MUST always be provided.
 */
export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

/** A record mapping plural categories to translation templates. */
export type PluralizedTranslation = {
  [C in PluralCategory]?: string;
} & { other: string };

/** A leaf translation: either a plain string or a pluralized record. */
export type TranslationValue = string | PluralizedTranslation;

// ---------------------------------------------------------------------------
// Translations tree
// ---------------------------------------------------------------------------

/**
 * Recursive translations tree shape.
 *
 * @example
 * ```ts
 * const en: Translations = {
 *   auth: {
 *     login: {
 *       title: "Welcome back",
 *       submit: "Sign in",
 *     },
 *   },
 *   items: { one: "{{count}} item", other: "{{count}} items" },
 * };
 * ```
 */
export type Translations = {
  readonly [key: string]: TranslationValue | Translations;
};

// ---------------------------------------------------------------------------
// Namespace
// ---------------------------------------------------------------------------

/** Logical grouping identifier for a set of translations. */
export type Namespace = string;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Configuration passed to the {@link I18n} constructor.
 *
 * All locale values are plain strings at the boundary; the class
 * handles conversion to/from {@link Locale} branded types internally.
 */
export interface I18nConfig {
  /** Default locale used when no explicit locale is supplied. */
  readonly defaultLocale: string;
  /** All supported locale codes. */
  readonly locales: readonly string[];
  /**
   * Fallback locale used when a translation key is missing in the
   * active locale. Defaults to `defaultLocale`.
   */
  readonly fallbackLocale?: string;
}

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

/** Key-value map used for `{{key}}` template interpolation. */
export type InterpolationParams = Readonly<Record<string, string | number>>;

// ---------------------------------------------------------------------------
// Translation key helpers
// ---------------------------------------------------------------------------

/**
 * Type-level dot-notation path into a translations schema.
 *
 * @example
 * ```ts
 * type Schema = { auth: { login: { title: string } } };
 * // "auth.login.title"
 * ```
 */
export type TranslationKey<TSchema> = TSchema extends Record<string, unknown>
  ? {
      [K in keyof TSchema & string]: TSchema[K] extends Record<string, unknown>
        ?
            | K
            | `${K}.${TranslationKey<TSchema[K]>}`
        : K;
    }[keyof TSchema & string]
  : string;

// ---------------------------------------------------------------------------
// Deep value extraction
// ---------------------------------------------------------------------------

/**
 * Resolve a dot-path `P` into the value type at that position in `T`.
 *
 * Falls back to `string` when the path cannot be statically followed.
 */
export type DeepValue<
  T,
  P extends string,
> = P extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? DeepValue<T[Head], Tail>
    : string
  : P extends keyof T
    ? T[P] extends TranslationValue
      ? T[P]
      : string
    : string;

// ---------------------------------------------------------------------------
// Re-exports from core
// ---------------------------------------------------------------------------

export type { Locale };
