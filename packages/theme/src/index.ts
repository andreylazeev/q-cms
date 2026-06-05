/**
 * @q-cms/theme — design tokens, built-in themes, CSS generator,
 * and DOM application helpers.
 *
 * The package is framework-agnostic at the core. The `ThemeProvider`
 * React component lives in `@q-cms/ui` and wraps this package.
 *
 * @packageDocumentation
 */

export type {
  ColorBgTokens,
  ColorFgTokens,
  ColorBorderTokens,
  ColorBrandTokens,
  ColorStatusTokens,
  ColorTokens,
  SpacingTokens,
  RadiusTokens,
  ShadowTokens,
  MotionTokens,
  ZIndexTokens,
  TypographyTokens,
  LayoutTokens,
  NestedTokenShape,
  DesignTokens,
  TokenName,
} from './tokens';

export {
  TOKEN_NAMES,
  validateTokens,
  flattenTokens,
  mergeNested,
  mergeWithFallbacks,
  DEFAULT_TOKENS,
} from './tokens';

export type { ThemeDefinition, ThemeSwatch } from './themes';
export { BUILT_IN_THEMES } from './themes';

export {
  registerTheme,
  getTheme,
  listThemes,
  clearThemes,
  requireTheme,
  seedBuiltInThemes,
} from './registry';

export { themeToCSS, tokensToInlineStyle } from './css';
export type { ThemeCSSOptions } from './css';

export {
  STYLE_ID,
  applyThemeToDocument,
  readAppliedTheme,
  readAppliedMode,
  buildPrePaintStyleTag,
  watchSystemColorScheme,
} from './apply';
export type { ApplyOptions, Mode, SystemMode } from './apply';
