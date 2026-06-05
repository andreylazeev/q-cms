/**
 * Built-in Q-CMS themes and the `ThemeDefinition` contract.
 *
 * Every theme is a flat record of token values (a `DesignTokens`
 * object). The `default` theme uses a neutral graphite palette
 * palette; `dark` is its night-mode twin; `newspaper` is a
 * high-contrast serif-heavy variant.
 *
 * Themes are framework-agnostic — apply them to a React tree via
 * `applyThemeToDocument()` (see `apply.ts`) or generate raw CSS
 * with `themeToCSS()` (see `css.ts`).
 *
 * @packageDocumentation
 */

import { DEFAULT_TOKENS, type DesignTokens, type NestedTokenShape, flattenTokens, mergeNested } from './tokens';

/* ---------------------------------------------------------------------------
 * Public types
 * ------------------------------------------------------------------------- */

/**
 * Six swatches that the ThemePicker renders for each theme card.
 *
 * Order matters — the picker reads the colors left-to-right
 * (canvas, surface, fg, accent, muted, border) and a designer
 * should see the theme's visual rhythm at a glance.
 */
export interface ThemeSwatch {
  /** Page background. */
  bg: string;
  /** Card / panel surface. */
  surface: string;
  /** Default text. */
  fg: string;
  /** Brand accent. */
  accent: string;
  /** Subdued / metadata text. */
  muted: string;
  /** Hairline border. */
  border: string;
}

/**
 * A theme is a named bundle of token values plus a human label
 * and description. The `modes` field lets a theme opt into a
 * matching dark variant: when the host toggles `mode = 'dark'`,
 * we emit the theme's `dark` tokens under `html[data-mode="dark"]`.
 */
export interface ThemeDefinition {
  /** Unique machine name, e.g. `"default"`, `"dark"`, `"newspaper"`. */
  name: string;
  /** Display name for the admin UI. */
  label: string;
  /** Short marketing description. */
  description: string;
  /**
   * "Light" / default-mode token values. Used when
   * `data-mode="light"`. Also the values emitted on `:root` for
   * pre-paint FOUC prevention.
   */
  tokens: DesignTokens;
  /**
   * Optional dark-mode override. If omitted, the light tokens are
   * reused under `[data-mode="dark"]`.
   */
  dark?: DesignTokens | undefined;
  /**
   * The light swatches rendered in the ThemePicker card preview.
   * If omitted, the picker derives them from `tokens`.
   */
  swatch?: ThemeSwatch | undefined;
  /**
   * Optional badge shown on the card (e.g. "Popular", "New").
   * Renders as a small pill in the top-right of the card.
   */
  badge?: string | undefined;
  /**
   * Light/dark nature of the theme. "light" themes look right in
   * light mode; "dark" themes are primarily intended for dark mode
   * and the picker shows them in dark by default. "any" is neutral.
   */
  modeHint?: 'light' | 'dark' | 'any' | undefined;
}

/* ---------------------------------------------------------------------------
 * Internal helpers
 * ------------------------------------------------------------------------- */

/**
 * Build a flat `DesignTokens` from a nested shape, applying any
 * partial `dark` overrides on top. The result is always a *complete*
 * token set — gaps in the partial shape are filled from the
 * design-system defaults (e.g. spacing, radius, motion tokens)
 * so the registry can validate every theme against the same full
 * `TOKEN_NAMES` list.
 *
 * @param light - Light nested shape (theme-specific overrides).
 * @param dark - Optional dark nested shape.
 * @returns A tuple `[lightFlat, darkFlat]`. `darkFlat` is `undefined`
 *          when the theme has no dark variant.
 */
function build(
  light: NestedTokenShape,
  dark?: NestedTokenShape,
): [DesignTokens, DesignTokens | undefined] {
  const baseFlat = flattenTokens(DEFAULT_TOKENS);
  const lightFlat = { ...baseFlat, ...flattenTokens(light) };
  if (!dark) return [lightFlat, undefined];
  const merged = mergeNested(light, dark);
  const darkFlat = { ...lightFlat, ...flattenTokens(merged) };
  return [lightFlat, darkFlat];
}

/* ---------------------------------------------------------------------------
 * DEFAULT — neutral graphite admin/public baseline
 * ------------------------------------------------------------------------- */

const DEFAULT_LIGHT: NestedTokenShape = {
  color: {
    bg: {
      'color-bg-canvas': '#f7f7f6',
      'color-bg-surface': '#ffffff',
      'color-bg-surface-raised': '#ffffff',
      'color-bg-overlay': 'rgba(15, 23, 42, 0.55)',
    },
    fg: {
      'color-fg': '#1a1a1a',
      'color-fg-muted': '#52525b',
      'color-fg-subtle': '#a1a1aa',
      'color-fg-on-accent': '#ffffff',
      'color-fg-on-success': '#ffffff',
      'color-fg-on-warning': '#1a1a1a',
      'color-fg-on-danger': '#ffffff',
    },
    border: {
      'color-border': '#e4e4e2',
      'color-border-strong': '#c9c9c5',
      'color-focus-ring': '#18181b',
    },
    accent: {
      'color-accent': '#18181b',
      'color-accent-hover': '#3f3f46',
      'color-accent-soft': '#e7e7e4',
    },
    link: {
      'color-link': '#1a1a1a',
      'color-link-hover': '#3f3f46',
    },
    success: {
      'color-success': '#15803d',
      'color-success-soft': '#dcfce7',
    },
    warning: {
      'color-warning': '#475569',
      'color-warning-soft': '#e2e8f0',
    },
    danger: {
      'color-danger': '#b91c1c',
      'color-danger-soft': '#fee2e2',
    },
  },
  font: {
    serif: 'ui-serif, "Iowan Old Style", "Apple Garamond", "Palatino", "Georgia", serif',
    sans: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", system-ui, sans-serif',
    mono: 'ui-monospace, "JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
  },
  type: {
    size: { base: '1rem', h1: '2.5rem', h2: '1.875rem', h3: '1.5rem' },
    line: { base: '1.6' },
  },
  layout: {
    'max-width': '72rem',
    'content-width': '44rem',
  },
};

const DEFAULT_DARK: NestedTokenShape = {
  color: {
    bg: {
      'color-bg-canvas': '#09090b',
      'color-bg-surface': '#18181b',
      'color-bg-surface-raised': '#27272a',
      'color-bg-overlay': 'rgba(0, 0, 0, 0.7)',
    },
    fg: {
      'color-fg': '#fafafa',
      'color-fg-muted': '#a1a1aa',
      'color-fg-subtle': '#71717a',
      'color-fg-on-accent': '#09090b',
      'color-fg-on-success': '#022c1a',
      'color-fg-on-warning': '#1a1a1a',
      'color-fg-on-danger': '#ffffff',
    },
    border: {
      'color-border': '#27272a',
      'color-border-strong': '#3f3f46',
      'color-focus-ring': '#d4d4d8',
    },
    accent: {
      'color-accent': '#fafafa',
      'color-accent-hover': '#d4d4d8',
      'color-accent-soft': '#3f3f46',
    },
    link: {
      'color-link': '#fafafa',
      'color-link-hover': '#d4d4d8',
    },
    success: {
      'color-success': '#4ade80',
      'color-success-soft': '#14532d',
    },
    warning: {
      'color-warning': '#cbd5e1',
      'color-warning-soft': '#334155',
    },
    danger: {
      'color-danger': '#f87171',
      'color-danger-soft': '#7f1d1d',
    },
  },
  shadow: {
    'shadow-1': '0 1px 1px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.5)',
    'shadow-2': '0 1px 2px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.55)',
    'shadow-3': '0 2px 4px rgba(0, 0, 0, 0.4), 0 12px 24px rgba(0, 0, 0, 0.6)',
    'shadow-4': '0 4px 8px rgba(0, 0, 0, 0.5), 0 24px 48px rgba(0, 0, 0, 0.7)',
  },
};

/* ---------------------------------------------------------------------------
 * MIDNIGHT — calm, deep night mode with a violet-blue accent.
 *
 * This is the "premium" dark theme: not the default dark with the
 * dial turned up, but a deliberate night-mode companion that uses
 * a violet-blue accent and gentler shadows for a more focused
 * reading / writing feel.
 * ------------------------------------------------------------------------- */

const MIDNIGHT_LIGHT: NestedTokenShape = {
  color: {
    bg: {
      // Light mode is still a soft, slightly cool canvas — the
      // theme is dark-first, but light mode shouldn't shock.
      'color-bg-canvas': '#f5f3ff',
      'color-bg-surface': '#ffffff',
      'color-bg-surface-raised': '#ffffff',
      'color-bg-overlay': 'rgba(15, 23, 42, 0.6)',
    },
    fg: {
      'color-fg': '#0f172a',
      'color-fg-muted': '#475569',
      'color-fg-subtle': '#94a3b8',
      'color-fg-on-accent': '#ffffff',
      'color-fg-on-success': '#ffffff',
      'color-fg-on-warning': '#0f172a',
      'color-fg-on-danger': '#ffffff',
    },
    border: {
      'color-border': '#e2e8f0',
      'color-border-strong': '#cbd5e1',
      'color-focus-ring': '#6366f1',
    },
    accent: {
      'color-accent': '#6366f1',
      'color-accent-hover': '#4f46e5',
      'color-accent-soft': '#e0e7ff',
    },
    link: {
      'color-link': '#0f172a',
      'color-link-hover': '#6366f1',
    },
    success: {
      'color-success': '#10b981',
      'color-success-soft': '#d1fae5',
    },
    warning: {
      'color-warning': '#475569',
      'color-warning-soft': '#e2e8f0',
    },
    danger: {
      'color-danger': '#ef4444',
      'color-danger-soft': '#fee2e2',
    },
  },
  font: {
    serif: 'ui-serif, "Iowan Old Style", "Apple Garamond", "Palatino", "Georgia", serif',
    sans: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", system-ui, sans-serif',
    mono: 'ui-monospace, "JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
  },
  type: {
    size: { base: '1rem', h1: '2.5rem', h2: '1.875rem', h3: '1.5rem' },
    line: { base: '1.6' },
  },
  layout: {
    'max-width': '72rem',
    'content-width': '44rem',
  },
};

const MIDNIGHT_DARK: NestedTokenShape = {
  color: {
    bg: {
      'color-bg-canvas': '#0b0b14',
      'color-bg-surface': '#13131f',
      'color-bg-surface-raised': '#1c1c2c',
      'color-bg-overlay': 'rgba(0, 0, 0, 0.75)',
    },
    fg: {
      'color-fg': '#e8e8f0',
      'color-fg-muted': '#9b9bb0',
      'color-fg-subtle': '#5c5c75',
      'color-fg-on-accent': '#ffffff',
      'color-fg-on-success': '#022c1a',
      'color-fg-on-warning': '#1a1a1a',
      'color-fg-on-danger': '#ffffff',
    },
    border: {
      'color-border': '#1f1f33',
      'color-border-strong': '#33334d',
      'color-focus-ring': '#818cf8',
    },
    accent: {
      'color-accent': '#818cf8',
      'color-accent-hover': '#a5b4fc',
      'color-accent-soft': '#1e1b4b',
    },
    link: {
      'color-link': '#e8e8f0',
      'color-link-hover': '#a5b4fc',
    },
    success: {
      'color-success': '#34d399',
      'color-success-soft': '#064e3b',
    },
    warning: {
      'color-warning': '#cbd5e1',
      'color-warning-soft': '#334155',
    },
    danger: {
      'color-danger': '#fb7185',
      'color-danger-soft': '#881337',
    },
  },
  shadow: {
    'shadow-1': '0 1px 1px rgba(8, 8, 20, 0.4), 0 1px 2px rgba(8, 8, 20, 0.55)',
    'shadow-2': '0 1px 2px rgba(8, 8, 20, 0.5), 0 4px 12px rgba(8, 8, 20, 0.65)',
    'shadow-3': '0 2px 4px rgba(8, 8, 20, 0.45), 0 12px 24px rgba(8, 8, 20, 0.7)',
    'shadow-4': '0 4px 8px rgba(8, 8, 20, 0.55), 0 24px 48px rgba(8, 8, 20, 0.8)',
  },
};

/* ---------------------------------------------------------------------------
 * NEWSPAPER — high-contrast serif (already in v0.1, slightly refined)
 * ------------------------------------------------------------------------- */

const NEWSPAPER_LIGHT: NestedTokenShape = {
  color: {
    bg: {
      'color-bg-canvas': '#f5f1e8',
      'color-bg-surface': '#fdfaf2',
      'color-bg-surface-raised': '#fdfaf2',
      'color-bg-overlay': 'rgba(20, 20, 20, 0.55)',
    },
    fg: {
      'color-fg': '#111111',
      'color-fg-muted': '#4a4a4a',
      'color-fg-subtle': '#8a8a8a',
      'color-fg-on-accent': '#fdfaf2',
      'color-fg-on-success': '#fdfaf2',
      'color-fg-on-warning': '#111111',
      'color-fg-on-danger': '#fdfaf2',
    },
    border: {
      'color-border': '#2a2a2a',
      'color-border-strong': '#111111',
      'color-focus-ring': '#8b0000',
    },
    accent: {
      'color-accent': '#8b0000',
      'color-accent-hover': '#6b0000',
      'color-accent-soft': '#f0d6d6',
    },
    link: {
      'color-link': '#111111',
      'color-link-hover': '#8b0000',
    },
    success: {
      'color-success': '#14532d',
      'color-success-soft': '#d1fae5',
    },
    warning: {
      'color-warning': '#475569',
      'color-warning-soft': '#e2e8f0',
    },
    danger: {
      'color-danger': '#8b0000',
      'color-danger-soft': '#fee2e2',
    },
  },
  radius: {
    // Print aesthetic — square corners throughout.
    'radius-none': '0',
    'radius-sm': '0',
    'radius-md': '0',
    'radius-lg': '0',
    'radius-xl': '0',
    'radius-full': '0',
  },
  shadow: {
    // No elevation in print.
    'shadow-1': 'none',
    'shadow-2': 'none',
    'shadow-3': 'none',
    'shadow-4': 'none',
  },
  font: {
    serif: '"Playfair Display", "Bodoni 72", "Didot", "Times New Roman", ui-serif, Georgia, serif',
    sans: '"IBM Plex Sans", "Helvetica Neue", system-ui, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, "Courier New", monospace',
  },
  type: {
    size: { base: '1.0625rem', h1: '3.25rem', h2: '2.25rem', h3: '1.625rem' },
    line: { base: '1.7' },
  },
  layout: {
    'max-width': '64rem',
    'content-width': '40rem',
  },
};

const NEWSPAPER_DARK: NestedTokenShape = {
  color: {
    bg: {
      'color-bg-canvas': '#0e0d0a',
      'color-bg-surface': '#18160f',
      'color-bg-surface-raised': '#221f15',
      'color-bg-overlay': 'rgba(0, 0, 0, 0.75)',
    },
    fg: {
      'color-fg': '#f4ecd8',
      'color-fg-muted': '#b0a98f',
      'color-fg-subtle': '#7a7458',
      'color-fg-on-accent': '#0e0d0a',
      'color-fg-on-success': '#0e0d0a',
      'color-fg-on-warning': '#0e0d0a',
      'color-fg-on-danger': '#f4ecd8',
    },
    border: {
      'color-border': '#3a352a',
      'color-border-strong': '#5a5340',
      'color-focus-ring': '#d4d4d8',
    },
    accent: {
      'color-accent': '#d4d4d8',
      'color-accent-hover': '#e5e7eb',
      'color-accent-soft': '#3a2f1c',
    },
    link: {
      'color-link': '#f4ecd8',
      'color-link-hover': '#d4d4d8',
    },
    success: {
      'color-success': '#9aae8c',
      'color-success-soft': '#2c3a25',
    },
    warning: {
      'color-warning': '#e0a458',
      'color-warning-soft': '#3a2a16',
    },
    danger: {
      'color-danger': '#e07a5f',
      'color-danger-soft': '#4a1f15',
    },
  },
  font: {
    serif: '"Playfair Display", "Bodoni 72", "Didot", "Times New Roman", ui-serif, Georgia, serif',
    sans: '"IBM Plex Sans", "Helvetica Neue", system-ui, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, "Courier New", monospace',
  },
};

/* ---------------------------------------------------------------------------
 * EDITORIAL — minimalist, high-contrast monochrome, subtle serif accent.
 *
 * A Stripe-Press / Linear-blog take: lots of whitespace, a single
 * hairline accent, no shadows. Designed for long-form reading.
 * ------------------------------------------------------------------------- */

const EDITORIAL_LIGHT: NestedTokenShape = {
  color: {
    bg: {
      'color-bg-canvas': '#fafaf9',
      'color-bg-surface': '#ffffff',
      'color-bg-surface-raised': '#ffffff',
      'color-bg-overlay': 'rgba(20, 20, 20, 0.5)',
    },
    fg: {
      'color-fg': '#0a0a0a',
      'color-fg-muted': '#525252',
      'color-fg-subtle': '#a3a3a3',
      'color-fg-on-accent': '#fafaf9',
      'color-fg-on-success': '#fafaf9',
      'color-fg-on-warning': '#0a0a0a',
      'color-fg-on-danger': '#fafaf9',
    },
    border: {
      'color-border': '#e5e5e5',
      'color-border-strong': '#d4d4d4',
      'color-focus-ring': '#0a0a0a',
    },
    accent: {
      // Near-black accent — keep it monochromatic; the brand
      // expression is whitespace + typography, not color.
      'color-accent': '#0a0a0a',
      'color-accent-hover': '#262626',
      'color-accent-soft': '#e5e5e5',
    },
    link: {
      'color-link': '#0a0a0a',
      'color-link-hover': '#525252',
    },
    success: {
      'color-success': '#166534',
      'color-success-soft': '#f0fdf4',
    },
    warning: {
      'color-warning': '#475569',
      'color-warning-soft': '#e2e8f0',
    },
    danger: {
      'color-danger': '#991b1b',
      'color-danger-soft': '#fef2f2',
    },
  },
  radius: {
    // Sharper, but not print-zero — minimal rounding only.
    'radius-none': '0',
    'radius-sm': '2px',
    'radius-md': '4px',
    'radius-lg': '6px',
    'radius-xl': '10px',
    'radius-full': '9999px',
  },
  shadow: {
    'shadow-1': '0 1px 0 0 rgba(10, 10, 10, 0.04)',
    'shadow-2': '0 1px 2px 0 rgba(10, 10, 10, 0.04), 0 1px 0 0 rgba(10, 10, 10, 0.04)',
    'shadow-3': '0 2px 4px 0 rgba(10, 10, 10, 0.05), 0 1px 0 0 rgba(10, 10, 10, 0.04)',
    'shadow-4': '0 6px 16px 0 rgba(10, 10, 10, 0.06), 0 1px 0 0 rgba(10, 10, 10, 0.04)',
  },
  font: {
    serif: 'ui-serif, "Iowan Old Style", "Apple Garamond", "Palatino", "Georgia", serif',
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    mono: 'ui-monospace, "JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
  },
  type: {
    // Slightly larger base + looser line-height — designed for
    // long-form reading.
    size: { base: '1.0625rem', h1: '3rem', h2: '2.125rem', h3: '1.5rem' },
    line: { base: '1.75' },
  },
  layout: {
    'max-width': '68rem',
    'content-width': '40rem',
  },
};

const EDITORIAL_DARK: NestedTokenShape = {
  color: {
    bg: {
      'color-bg-canvas': '#0a0a0a',
      'color-bg-surface': '#141414',
      'color-bg-surface-raised': '#1f1f1f',
      'color-bg-overlay': 'rgba(0, 0, 0, 0.8)',
    },
    fg: {
      'color-fg': '#fafafa',
      'color-fg-muted': '#a3a3a3',
      'color-fg-subtle': '#525252',
      'color-fg-on-accent': '#0a0a0a',
      'color-fg-on-success': '#0a0a0a',
      'color-fg-on-warning': '#0a0a0a',
      'color-fg-on-danger': '#fafafa',
    },
    border: {
      'color-border': '#262626',
      'color-border-strong': '#404040',
      'color-focus-ring': '#fafafa',
    },
    accent: {
      'color-accent': '#fafafa',
      'color-accent-hover': '#e5e5e5',
      'color-accent-soft': '#262626',
    },
    link: {
      'color-link': '#fafafa',
      'color-link-hover': '#d4d4d4',
    },
    success: {
      'color-success': '#4ade80',
      'color-success-soft': '#14532d',
    },
    warning: {
      'color-warning': '#cbd5e1',
      'color-warning-soft': '#334155',
    },
    danger: {
      'color-danger': '#f87171',
      'color-danger-soft': '#7f1d1d',
    },
  },
  shadow: {
    'shadow-1': '0 1px 0 0 rgba(0, 0, 0, 0.5)',
    'shadow-2': '0 1px 2px 0 rgba(0, 0, 0, 0.4), 0 1px 0 0 rgba(0, 0, 0, 0.5)',
    'shadow-3': '0 2px 4px 0 rgba(0, 0, 0, 0.5), 0 1px 0 0 rgba(0, 0, 0, 0.4)',
    'shadow-4': '0 6px 16px 0 rgba(0, 0, 0, 0.6), 0 1px 0 0 rgba(0, 0, 0, 0.4)',
  },
};

/* ---------------------------------------------------------------------------
 * Flatten & register
 * ------------------------------------------------------------------------- */

const [DEFAULT_TOKENS_FLAT, DEFAULT_DARK_FLAT] = build(DEFAULT_LIGHT, DEFAULT_DARK);
const [MIDNIGHT_TOKENS_FLAT, MIDNIGHT_DARK_FLAT] = build(MIDNIGHT_LIGHT, MIDNIGHT_DARK);
const [NEWSPAPER_TOKENS_FLAT, NEWSPAPER_DARK_FLAT] = build(NEWSPAPER_LIGHT, NEWSPAPER_DARK);
const [EDITORIAL_TOKENS_FLAT, EDITORIAL_DARK_FLAT] = build(EDITORIAL_LIGHT, EDITORIAL_DARK);

const DEFAULT_THEME: ThemeDefinition = {
  name: 'default',
  label: 'Default',
  description: 'Neutral graphite — quiet Q-CMS baseline.',
  tokens: DEFAULT_TOKENS_FLAT,
  dark: DEFAULT_DARK_FLAT,
  modeHint: 'any',
  swatch: {
    bg: '#f7f7f6',
    surface: '#ffffff',
    fg: '#1a1a1a',
    accent: '#18181b',
    muted: '#52525b',
    border: '#e8e4dd',
  },
};

const DARK_THEME: ThemeDefinition = {
  name: 'dark',
  label: 'Dark',
  description: 'Charcoal night mode of the default palette.',
  tokens: DEFAULT_DARK_FLAT ?? DEFAULT_TOKENS_FLAT,
  modeHint: 'dark',
  badge: 'Classic',
  swatch: {
    bg: '#09090b',
    surface: '#18181b',
    fg: '#fafafa',
    accent: '#fafafa',
    muted: '#a1a1aa',
    border: '#27272a',
  },
};

const MIDNIGHT_THEME: ThemeDefinition = {
  name: 'midnight',
  label: 'Midnight',
  description: 'Deep, calm night mode with a violet-blue accent.',
  tokens: MIDNIGHT_TOKENS_FLAT,
  dark: MIDNIGHT_DARK_FLAT,
  modeHint: 'dark',
  badge: 'New',
  swatch: {
    bg: '#0b0b14',
    surface: '#1c1c2c',
    fg: '#e8e8f0',
    accent: '#818cf8',
    muted: '#9b9bb0',
    border: '#1f1f33',
  },
};

const NEWSPAPER_THEME: ThemeDefinition = {
  name: 'newspaper',
  label: 'Newspaper',
  description: 'High-contrast, serif-heavy editorial theme.',
  tokens: NEWSPAPER_TOKENS_FLAT,
  dark: NEWSPAPER_DARK_FLAT,
  modeHint: 'any',
  swatch: {
    bg: '#f5f1e8',
    surface: '#fdfaf2',
    fg: '#111111',
    accent: '#8b0000',
    muted: '#4a4a4a',
    border: '#2a2a2a',
  },
};

const EDITORIAL_THEME: ThemeDefinition = {
  name: 'editorial',
  label: 'Editorial',
  description: 'Minimalist monochrome with a subtle serif accent.',
  tokens: EDITORIAL_TOKENS_FLAT,
  dark: EDITORIAL_DARK_FLAT,
  modeHint: 'any',
  badge: 'Featured',
  swatch: {
    bg: '#fafaf9',
    surface: '#ffffff',
    fg: '#0a0a0a',
    accent: '#0a0a0a',
    muted: '#525252',
    border: '#e5e5e5',
  },
};

/**
 * The default set of themes registered at module load time. Consumers
 * can call `clearThemes()` + `registerTheme()` to install their own.
 */
export const BUILT_IN_THEMES: readonly ThemeDefinition[] = [
  DEFAULT_THEME,
  DARK_THEME,
  MIDNIGHT_THEME,
  NEWSPAPER_THEME,
  EDITORIAL_THEME,
];
