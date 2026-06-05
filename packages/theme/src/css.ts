/**
 * CSS generation for themes.
 *
 * The generator turns a `ThemeDefinition` (or a raw token map) into
 * a string of CSS rules suitable for injection into a `<style>` tag
 * or a build-time stylesheet. Output is intentionally minimal:
 *
 *   @layer qcms-theme {
 *     :root {
 *       --color-fg: #1a1a1a;
 *       --space-4: 1rem;
 *       …
 *     }
 *     [data-mode="dark"] {
 *       --color-fg: #f4f4f5;
 *       …
 *     }
 *   }
 *
 * The `@layer` wrapper is the key to a clean cascade: it lets app
 * CSS always win over theme defaults without resorting to
 * `!important`, while still letting per-theme overrides land
 * predictably.
 *
 * @packageDocumentation
 */

import type { ThemeDefinition } from './themes';
import type { DesignTokens, TokenName } from './tokens';
import { TOKEN_NAMES } from './tokens';

/**
 * Escape a string for safe embedding in a CSS `url(…)` or `content`
 * declaration. The token set we ship is plain hex/rgb/rem values,
 * so most strings are inert, but a custom theme could include
 * `url(images/foo.png)` — handle quotes defensively.
 */
function cssEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Group flat token names by section so the output CSS is human-
 * readable and labeled with semantic comments. The order is
 * intentional: a designer reading the generated CSS sees the
 * color system first, then spacing, radius, shadow, motion, and
 * finally typography + layout.
 */
const SECTION_ORDER: readonly { title: string; match: (key: TokenName) => boolean }[] = [
  { title: 'Backgrounds', match: (k) => k.startsWith('color-bg-') },
  { title: 'Foreground', match: (k) => k.startsWith('color-fg-') },
  { title: 'Borders & focus', match: (k) => k === 'color-border' || k === 'color-border-strong' || k === 'color-focus-ring' },
  { title: 'Brand', match: (k) => k.startsWith('color-accent') || k.startsWith('color-link') },
  { title: 'Status', match: (k) => k === 'color-success' || k === 'color-success-soft' || k === 'color-warning' || k === 'color-warning-soft' || k === 'color-danger' || k === 'color-danger-soft' },
  { title: 'Spacing', match: (k) => k.startsWith('space-') },
  { title: 'Radius', match: (k) => k.startsWith('radius-') },
  { title: 'Shadow', match: (k) => k.startsWith('shadow-') },
  { title: 'Motion', match: (k) => k.startsWith('motion-') || k.startsWith('ease-') },
  { title: 'Z-index', match: (k) => k.startsWith('z-') },
  { title: 'Typography', match: (k) => k.startsWith('font-') || k === 'line-height-base' },
  { title: 'Layout', match: (k) => k === 'max-width' || k === 'content-width' },
];

/**
 * Render a flat token record as a labelled block of CSS custom
 * properties. Output is grouped by section with `/* ── X ── *\/`
 * comments so a designer reading the generated CSS can find what
 * they need at a glance.
 */
function renderTokenBlock(tokens: DesignTokens, indent: string): string {
  const lines: string[] = [];
  const emitted = new Set<TokenName>();
  for (const section of SECTION_ORDER) {
    const sectionKeys = (TOKEN_NAMES as readonly TokenName[]).filter(
      (k) => section.match(k) && k in tokens && tokens[k] !== undefined,
    );
    if (sectionKeys.length === 0) continue;
    lines.push(`${indent}/* ${section.title} */`);
    for (const key of sectionKeys) {
      const value = tokens[key];
      if (value === undefined) continue;
      lines.push(`${indent}--${key}: ${cssEscape(String(value))};`);
      emitted.add(key);
    }
    lines.push('');
  }
  // Any keys not matched by a section (e.g. custom theme
  // extensions) get emitted at the end so nothing is lost.
  const remaining = (TOKEN_NAMES as readonly TokenName[]).filter(
    (k) => !emitted.has(k) && k in tokens && tokens[k] !== undefined,
  );
  for (const key of remaining) {
    const value = tokens[key];
    if (value === undefined) continue;
    lines.push(`${indent}--${key}: ${cssEscape(String(value))};`);
  }
  // Trim trailing empty line.
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

/**
 * Wrap a CSS body inside `@layer qcms-theme { … }`. Pass `false`
 * for `useLayer` to skip the wrapper (e.g. for tests that need to
 * count raw `:root` rules).
 */
function wrapInLayer(body: string, useLayer: boolean): string {
  if (!useLayer) return body;
  return `@layer qcms-theme {\n${body}\n}`;
}

export interface ThemeCSSOptions {
  /** Custom selector for the light block. Defaults to `:root`. */
  readonly selector?: string;
  /** Custom selector for the dark block. Defaults to `[data-mode="dark"]`. */
  readonly darkSelector?: string;
  /**
   * Whether to wrap output in `@layer qcms-theme { … }`. Defaults
   * to `true`. The layer makes the cascade deterministic: app
   * code can always override theme variables without `!important`,
   * and themes layered over one another compose predictably.
   */
  readonly useLayer?: boolean;
  /**
   * If `true`, skip the `[data-mode="dark"]` block entirely. The
   * public-site FOUC-prevention script uses this when the user has
   * `prefers-color-scheme: light` and we only want to set the
   * `:root` tokens before paint.
   */
  readonly skipDark?: boolean;
}

/**
 * Generate the full CSS ruleset for a theme.
 *
 * The output is a multi-line string with `:root` (light) and
 * `[data-mode="dark"]` (dark, if the theme defines one). The
 * selector can be customised via `options.selector` if `:root` is
 * too restrictive (e.g. embedding inside a Shadow DOM root).
 *
 * By default the result is wrapped in `@layer qcms-theme` so it
 * composes cleanly with consumer CSS.
 *
 * @example
 * ```ts
 * const css = themeToCSS(getTheme("default")!);
 * document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);
 * ```
 *
 * @param theme - The theme to render.
 * @param options - Optional render flags.
 */
export function themeToCSS(theme: ThemeDefinition, options?: ThemeCSSOptions): string {
  const lightSelector = options?.selector ?? ':root';
  const darkSelector = options?.darkSelector ?? '[data-mode="dark"]';
  const indent = '  ';
  const useLayer = options?.useLayer ?? true;
  const skipDark = options?.skipDark ?? false;

  const lightBlock = `${lightSelector} {\n${renderTokenBlock(theme.tokens, indent)}\n}`;
  let body = lightBlock;
  if (theme.dark && !skipDark) {
    const darkBlock = `${darkSelector} {\n${renderTokenBlock(theme.dark, indent)}\n}`;
    body = `${lightBlock}\n\n${darkBlock}`;
  }
  return wrapInLayer(body, useLayer);
}

/**
 * Render an inline `style="…"` snippet for a single element.
 *
 * Mostly useful for preview tiles in the theme picker where we don't
 * want to set up a full stylesheet. The keys are emitted as
 * `--${key}: value;`. The output is **unlayered** (it's inlined
 * on a single element where the cascade isn't a concern).
 *
 * @param tokens - Tokens to render.
 * @returns A CSS string suitable for `element.setAttribute("style", …)`.
 */
export function tokensToInlineStyle(tokens: DesignTokens): string {
  const parts: string[] = [];
  for (const key of TOKEN_NAMES as readonly TokenName[]) {
    const value = tokens[key];
    if (value === undefined) continue;
    parts.push(`--${key}: ${cssEscape(String(value))};`);
  }
  return parts.join(' ');
}
