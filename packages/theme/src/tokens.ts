/**
 * Design token names and value types used by Q-CMS themes.
 *
 * The shape is intentionally narrow: tokens are the public surface
 * every theme must provide, and they're emitted as CSS custom
 * properties on `:root` (or `[data-theme="…"]`).
 *
 * The taxonomy is **semantic three-tier**:
 *
 *   1. The shape is a nested object (`color.bg.canvas`, `space.4`).
 *   2. A `mergeWithFallbacks()` helper fills gaps from a default
 *      theme so partial themes inherit gracefully.
 *   3. `flattenTokens()` walks the nested shape and emits the
 *      `--color-bg-canvas`, `--space-4` kebab-case CSS variables
 *      the rest of the app reads.
 *
 * @packageDocumentation
 */

/* ---------------------------------------------------------------------------
 * Color tokens (semantic tier)
 *
 * A senior-designer color system uses 3 tiers:
 *   1. **Background layers** — canvas / surface / surface-raised / overlay
 *   2. **Foreground** — fg / fg-muted / fg-subtle / fg-on-accent
 *   3. **Brand & status** — accent / link / success / warning / danger
 *      plus their `-soft` (background tint) and `-fg-on-*` variants.
 *
 * The naming is depth-not-hue. Themes can be minimal (just an
 * accent) or exhaustive (a full chart) and the generator fills the
 * rest from the base.
 * ------------------------------------------------------------------------- */

export interface ColorBgTokens {
  /** Page background — the surface the app sits on. */
  'color-bg-canvas': string;
  /** Card / panel / sidebar surface — one elevation step above canvas. */
  'color-bg-surface': string;
  /** Popover / modal / menu — two elevation steps above canvas. */
  'color-bg-surface-raised': string;
  /** Scrim over media, dim layer behind modals (low alpha OK). */
  'color-bg-overlay': string;
}

export interface ColorFgTokens {
  /** Default text. */
  'color-fg': string;
  /** Subdued copy (eyebrow, metadata, supporting text). */
  'color-fg-muted': string;
  /** Placeholder, disabled, hint. Lowest contrast. */
  'color-fg-subtle': string;
  /** Text rendered ON TOP of the accent fill. */
  'color-fg-on-accent': string;
  /** Text rendered ON TOP of a status fill (e.g. inside a "success" button). */
  'color-fg-on-success': string;
  'color-fg-on-warning': string;
  'color-fg-on-danger': string;
}

export interface ColorBorderTokens {
  /** Default hairline border / divider. */
  'color-border': string;
  /** Stronger border for emphasis (input default, table row, etc). */
  'color-border-strong': string;
  /** Always-visible focus outline color. */
  'color-focus-ring': string;
}

export interface ColorBrandTokens {
  /** Primary brand accent — buttons, links, eyebrows. */
  'color-accent': string;
  /** Hover state of the accent. */
  'color-accent-hover': string;
  /** Tinted background for chips / tags / selected rows. */
  'color-accent-soft': string;
  /** Default link color (may equal `--color-fg` for some themes). */
  'color-link': string;
  /** Hover state of the link. */
  'color-link-hover': string;
}

export interface ColorStatusTokens {
  'color-success': string;
  'color-success-soft': string;
  'color-warning': string;
  'color-warning-soft': string;
  'color-danger': string;
  'color-danger-soft': string;
}

/** Aggregated color shape — all 6 sub-trees merged. */
export interface ColorTokens
  extends ColorBgTokens,
    ColorFgTokens,
    ColorBorderTokens,
    ColorBrandTokens,
    ColorStatusTokens {}

/* ---------------------------------------------------------------------------
 * Spacing — 8-point grid (with the 4px half-step for tight rhythm).
 *
 * Numbered steps are the source of truth. The exported `space` shape
 * is what theme authors fill in; the generator flattens to
 * `--space-0`, `--space-1`, ..., `--space-24` for CSS.
 * ------------------------------------------------------------------------- */

export interface SpacingTokens {
  'space-0': string;
  'space-1': string;
  'space-2': string;
  'space-3': string;
  'space-4': string;
  'space-6': string;
  'space-8': string;
  'space-12': string;
  'space-16': string;
  'space-24': string;
  'space-32': string;
  'space-48': string;
}

/* ---------------------------------------------------------------------------
 * Radius — 5 steps.
 *
 * `radius-full` is the pill shape. `radius-none` exists so a
 * "newspaper" / "editorial" theme can zero everything out without
 * needing string overrides.
 * ------------------------------------------------------------------------- */

export interface RadiusTokens {
  'radius-none': string;
  'radius-sm': string;
  'radius-md': string;
  'radius-lg': string;
  'radius-xl': string;
  'radius-full': string;
}

/* ---------------------------------------------------------------------------
 * Shadows — 4 elevations, each multi-layer (key + ambient).
 *
 * A senior designer never ships `0 4px 8px rgba(0,0,0,0.1)` —
 * that's a single hard shadow, not real elevation. Each step
 * combines a tight contact shadow (key light) and a softer drop
 * (ambient sky) so the card looks lifted, not stamped.
 * ------------------------------------------------------------------------- */

export interface ShadowTokens {
  'shadow-1': string;
  'shadow-2': string;
  'shadow-3': string;
  'shadow-4': string;
}

/* ---------------------------------------------------------------------------
 * Motion — duration + easing tokens. Component CSS references these
 * so the whole app has one rhythm; a theme can tighten (snappy) or
 * stretch (cinematic) the system without rewriting every transition.
 * ------------------------------------------------------------------------- */

export interface MotionTokens {
  /** ~120ms — micro: hover, focus, toggles. */
  'motion-fast': string;
  /** ~200ms — default: cards, color shifts, popovers. */
  'motion-base': string;
  /** ~320ms — large: panels, page transitions. */
  'motion-slow': string;
  /** Easing curve for outgoing states. */
  'ease-out': string;
  /** Easing curve for incoming states. */
  'ease-in': string;
  /** Easing curve for in-place changes (no displacement). */
  'ease-in-out': string;
}

/* ---------------------------------------------------------------------------
 * Z-index — a named scale. Components should pick a step, not a
 * magic number; if you find yourself reaching for `9999`, add a step.
 * ------------------------------------------------------------------------- */

export interface ZIndexTokens {
  'z-base': string;
  'z-dropdown': string;
  'z-sticky': string;
  'z-overlay': string;
  'z-modal': string;
  'z-popover': string;
  'z-toast': string;
}

/* ---------------------------------------------------------------------------
 * Typography — font stacks and a small type scale.
 * ------------------------------------------------------------------------- */

export interface TypographyTokens {
  'font-serif': string;
  'font-sans': string;
  'font-mono': string;
  'font-size-base': string;
  'line-height-base': string;
  'font-size-h1': string;
  'font-size-h2': string;
  'font-size-h3': string;
}

/* ---------------------------------------------------------------------------
 * Layout — max content widths.
 * ------------------------------------------------------------------------- */

export interface LayoutTokens {
  'max-width': string;
  'content-width': string;
}

/**
 * Nested shape authors fill in. The generator flattens this to
 * kebab-case CSS custom properties. Examples:
 *
 *   {
 *     color: { bg: { canvas: '#f7f7f6' } },
 *     space: { 4: '1rem' },
 *     radius: { md: '0.5rem' }
 *   }
 *
 *   → `--color-bg-canvas: #f7f7f6;`
 *   → `--space-4: 1rem;`
 *   → `--radius-md: 0.5rem;`
 */
export interface NestedTokenShape {
  color?:
    | Partial<{
        bg: Partial<ColorBgTokens>;
        fg: Partial<ColorFgTokens>;
        border: Partial<ColorBorderTokens>;
        accent: Partial<Pick<ColorBrandTokens, 'color-accent' | 'color-accent-hover' | 'color-accent-soft'>>;
        link: Partial<Pick<ColorBrandTokens, 'color-link' | 'color-link-hover'>>;
        success: Partial<Pick<ColorStatusTokens, 'color-success' | 'color-success-soft'>>;
        warning: Partial<Pick<ColorStatusTokens, 'color-warning' | 'color-warning-soft'>>;
        danger: Partial<Pick<ColorStatusTokens, 'color-danger' | 'color-danger-soft'>>;
      }>
    | undefined;
  space?: Partial<SpacingTokens> | undefined;
  radius?: Partial<RadiusTokens> | undefined;
  shadow?: Partial<ShadowTokens> | undefined;
  motion?: Partial<MotionTokens> | undefined;
  z?: Partial<ZIndexTokens> | undefined;
  font?:
    | Partial<{
        serif: TypographyTokens['font-serif'];
        sans: TypographyTokens['font-sans'];
        mono: TypographyTokens['font-mono'];
      }>
    | undefined;
  type?:
    | Partial<{
        size: Partial<{
          base: TypographyTokens['font-size-base'];
          h1: TypographyTokens['font-size-h1'];
          h2: TypographyTokens['font-size-h2'];
          h3: TypographyTokens['font-size-h3'];
        }>;
        line: Partial<{
          base: TypographyTokens['line-height-base'];
        }>;
      }>
    | undefined;
  layout?: Partial<LayoutTokens> | undefined;
}

/**
 * The flat token set consumed by the rest of the app (and emitted
 * to CSS). The flat form is what `validateTokens()` and the test
 * suite check against.
 */
export interface DesignTokens
  extends ColorTokens,
    SpacingTokens,
    RadiusTokens,
    ShadowTokens,
    MotionTokens,
    ZIndexTokens,
    TypographyTokens,
    LayoutTokens {}

/* ---------------------------------------------------------------------------
 * Defaults — used as the base for `mergeWithFallbacks()` and as the
 * shape of the built-in "default" theme. A theme that omits tokens
 * inherits these values verbatim.
 * ------------------------------------------------------------------------- */

const DEFAULT_NESTED: NestedTokenShape = {
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
  space: {
    'space-0': '0',
    'space-1': '0.25rem',
    'space-2': '0.5rem',
    'space-3': '0.75rem',
    'space-4': '1rem',
    'space-6': '1.5rem',
    'space-8': '2rem',
    'space-12': '3rem',
    'space-16': '4rem',
    'space-24': '6rem',
    'space-32': '8rem',
    'space-48': '12rem',
  },
  radius: {
    'radius-none': '0',
    'radius-sm': '4px',
    'radius-md': '8px',
    'radius-lg': '12px',
    'radius-xl': '20px',
    'radius-full': '9999px',
  },
  shadow: {
    // Elevation 1: subtle lift for inputs, chips, hovered rows.
    'shadow-1':
      '0 1px 1px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.06)',
    // Elevation 2: cards, popovers, dropdowns.
    'shadow-2':
      '0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 12px rgba(15, 23, 42, 0.08)',
    // Elevation 3: hovered cards, sticky bars.
    'shadow-3':
      '0 2px 4px rgba(15, 23, 42, 0.04), 0 12px 24px rgba(15, 23, 42, 0.10)',
    // Elevation 4: modals, dialogs, command palettes.
    'shadow-4':
      '0 4px 8px rgba(15, 23, 42, 0.05), 0 24px 48px rgba(15, 23, 42, 0.18)',
  },
  motion: {
    'motion-fast': '120ms',
    'motion-base': '200ms',
    'motion-slow': '320ms',
    'ease-out': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
    'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  z: {
    'z-base': '0',
    'z-dropdown': '1000',
    'z-sticky': '1100',
    'z-overlay': '1200',
    'z-modal': '1300',
    'z-popover': '1400',
    'z-toast': '1500',
  },
  font: {
    serif: 'ui-serif, "Iowan Old Style", "Apple Garamond", "Palatino", "Georgia", serif',
    sans: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", system-ui, sans-serif',
    mono: 'ui-monospace, "JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
  },
  type: {
    size: {
      base: '1rem',
      h1: '2.5rem',
      h2: '1.875rem',
      h3: '1.5rem',
    },
    line: {
      base: '1.6',
    },
  },
  layout: {
    'max-width': '72rem',
    'content-width': '44rem',
  },
};

/* ---------------------------------------------------------------------------
 * Flatten a nested shape into a flat `DesignTokens` map. Unknown
 * keys are passed through so a custom theme can extend the system
 * without TypeScript complaining.
 * ------------------------------------------------------------------------- */

type FlatRecord = Record<string, string>;

/**
 * Convert a `NestedTokenShape` into a flat `{ '--key': value }` map.
 * Numeric space keys (`'4'`, `'6'`) become `space-4`, `space-6`.
 *
 * @param nested - The nested shape to flatten.
 * @returns A flat object suitable for `Object.entries` iteration.
 */
export function flattenTokens(nested: NestedTokenShape): DesignTokens {
  const out: FlatRecord = {};
  // Colors — bg, fg, border, accent, link, status
  if (nested.color) {
    pushAll(out, nested.color.bg);
    pushAll(out, nested.color.fg);
    pushAll(out, nested.color.border);
    pushAll(out, nested.color.accent);
    pushAll(out, nested.color.link);
    pushAll(out, nested.color.success);
    pushAll(out, nested.color.warning);
    pushAll(out, nested.color.danger);
  }
  // Spacing / radius / shadow / motion / z-index — pass through (already kebab)
  if (nested.space) pushAll(out, nested.space);
  if (nested.radius) pushAll(out, nested.radius);
  if (nested.shadow) pushAll(out, nested.shadow);
  if (nested.motion) pushAll(out, nested.motion);
  if (nested.z) pushAll(out, nested.z);
  // Typography
  if (nested.font) {
    if (nested.font.serif !== undefined) out['font-serif'] = nested.font.serif;
    if (nested.font.sans !== undefined) out['font-sans'] = nested.font.sans;
    if (nested.font.mono !== undefined) out['font-mono'] = nested.font.mono;
  }
  if (nested.type) {
    if (nested.type.size) {
      if (nested.type.size.base !== undefined) out['font-size-base'] = nested.type.size.base;
      if (nested.type.size.h1 !== undefined) out['font-size-h1'] = nested.type.size.h1;
      if (nested.type.size.h2 !== undefined) out['font-size-h2'] = nested.type.size.h2;
      if (nested.type.size.h3 !== undefined) out['font-size-h3'] = nested.type.size.h3;
    }
    if (nested.type.line) {
      if (nested.type.line.base !== undefined) out['line-height-base'] = nested.type.line.base;
    }
  }
  // Layout
  if (nested.layout) pushAll(out, nested.layout);
  return out as unknown as DesignTokens;
}

function pushAll(out: FlatRecord, src: Record<string, string> | undefined): void {
  if (!src) return;
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
}

/**
 * Recursively merge a partial nested shape over a base. Used to
 * apply a `dark` override on top of a theme's `light` tokens
 * without re-typing every key.
 *
 * @param base - The starting nested shape (e.g. theme tokens).
 * @param override - The partial overrides to apply.
 * @returns A new nested shape with overrides merged in.
 */
export function mergeNested(base: NestedTokenShape, override: NestedTokenShape): NestedTokenShape {
  return {
    color: deepMerge(base.color, override.color) as NestedTokenShape['color'],
    space: { ...(base.space ?? {}), ...(override.space ?? {}) },
    radius: { ...(base.radius ?? {}), ...(override.radius ?? {}) },
    shadow: { ...(base.shadow ?? {}), ...(override.shadow ?? {}) },
    motion: { ...(base.motion ?? {}), ...(override.motion ?? {}) },
    z: { ...(base.z ?? {}), ...(override.z ?? {}) },
    font: { ...(base.font ?? {}), ...(override.font ?? {}) },
    type: {
      size: { ...(base.type?.size ?? {}), ...(override.type?.size ?? {}) },
      line: { ...(base.type?.line ?? {}), ...(override.type?.line ?? {}) },
    },
    layout: { ...(base.layout ?? {}), ...(override.layout ?? {}) },
  };
}

function deepMerge<T extends Record<string, unknown> | undefined>(base: T, override: T): T {
  if (!base) return override;
  if (!override) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const bv = out[k];
    if (isPlainObject(bv) && isPlainObject(v)) {
      out[k] = deepMerge(bv, v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Merge a partial flat `DesignTokens` map over a base, returning a
 * complete `DesignTokens`. Used by `applyThemeToDocument` so a
 * theme that's missing (e.g.) `--shadow-4` still renders correctly
 * using the previous value.
 *
 * @param base - The fallback (typically the resolved defaults).
 * @param override - The partial overrides.
 * @returns A new complete `DesignTokens`.
 */
export function mergeWithFallbacks(base: DesignTokens, override: Partial<DesignTokens>): DesignTokens {
  const out: FlatRecord = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out as unknown as DesignTokens;
}

/**
 * The default nested token shape. Exposed for tests and for theme
 * authors who want to start from a known base and tweak a handful
 * of values.
 */
export const DEFAULT_TOKENS: NestedTokenShape = DEFAULT_NESTED;

/* ---------------------------------------------------------------------------
 * Validation
 * ------------------------------------------------------------------------- */

/**
 * Helper: a typed tuple of all flat token names. Useful for iterating
 * or validating that a candidate object has every key.
 */
export const TOKEN_NAMES = [
  // colors
  'color-bg-canvas',
  'color-bg-surface',
  'color-bg-surface-raised',
  'color-bg-overlay',
  'color-fg',
  'color-fg-muted',
  'color-fg-subtle',
  'color-fg-on-accent',
  'color-fg-on-success',
  'color-fg-on-warning',
  'color-fg-on-danger',
  'color-border',
  'color-border-strong',
  'color-focus-ring',
  'color-accent',
  'color-accent-hover',
  'color-accent-soft',
  'color-link',
  'color-link-hover',
  'color-success',
  'color-success-soft',
  'color-warning',
  'color-warning-soft',
  'color-danger',
  'color-danger-soft',
  // spacing
  'space-0',
  'space-1',
  'space-2',
  'space-3',
  'space-4',
  'space-6',
  'space-8',
  'space-12',
  'space-16',
  'space-24',
  'space-32',
  'space-48',
  // radius
  'radius-none',
  'radius-sm',
  'radius-md',
  'radius-lg',
  'radius-xl',
  'radius-full',
  // shadow
  'shadow-1',
  'shadow-2',
  'shadow-3',
  'shadow-4',
  // motion
  'motion-fast',
  'motion-base',
  'motion-slow',
  'ease-out',
  'ease-in',
  'ease-in-out',
  // z
  'z-base',
  'z-dropdown',
  'z-sticky',
  'z-overlay',
  'z-modal',
  'z-popover',
  'z-toast',
  // typography
  'font-serif',
  'font-sans',
  'font-mono',
  'font-size-base',
  'line-height-base',
  'font-size-h1',
  'font-size-h2',
  'font-size-h3',
  // layout
  'max-width',
  'content-width',
] as const satisfies readonly (keyof DesignTokens)[];

export type TokenName = (typeof TOKEN_NAMES)[number];

/**
 * Validate that `value` covers every required token. Returns a
 * list of missing keys (empty = valid). Used by the registry when
 * a theme is registered, and by tests.
 */
export function validateTokens(value: Partial<DesignTokens>): TokenName[] {
  return TOKEN_NAMES.filter((k) => !(k in value));
}
