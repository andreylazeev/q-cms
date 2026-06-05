/**
 * @q-cms/i18n — zero-dependency localization framework for Q-CMS.
 *
 * Core: {@link I18n} class with `{{key}}` interpolation, dot-notation
 * nested keys, pluralization, and locale-aware formatting.
 *
 * React: {@link I18nProvider}, {@link useI18n}, {@link useTranslation}
 * for component-level translation with SSR safety.
 *
 * @packageDocumentation
 */

export { I18n } from "./i18n.ts";

export {
  I18nProvider,
  useI18n,
  useTranslation,
} from "./react.tsx";

export type {
  I18nProviderProps,
  UseI18nReturn,
  UseTranslationReturn,
} from "./react.tsx";

export type {
  DeepValue,
  I18nConfig,
  InterpolationParams,
  Locale,
  Namespace,
  PluralCategory,
  PluralizedTranslation,
  TranslationKey,
  TranslationValue,
  Translations,
} from "./types.ts";
