import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BUILT_IN_THEMES,
  type DesignTokens,
  TOKEN_NAMES,
  type ThemeDefinition,
  applyThemeToDocument,
  buildPrePaintStyleTag,
  clearThemes,
  flattenTokens,
  getTheme,
  listThemes,
  mergeWithFallbacks,
  readAppliedMode,
  readAppliedTheme,
  registerTheme,
  requireTheme,
  seedBuiltInThemes,
  themeToCSS,
  tokensToInlineStyle,
  validateTokens,
  watchSystemColorScheme,
} from './index';
import { DEFAULT_TOKENS, type NestedTokenShape, flattenTokens as flattenTokensCheck } from './tokens';

/* ---------------------------------------------------------------------------
 * Test helpers
 * ------------------------------------------------------------------------- */

function makeTokens(overrides: Partial<DesignTokens> = {}): DesignTokens {
  // Start from the design system's defaults so the test token set
  // matches what the registry actually validates against.
  const base = flattenTokensCheck(DEFAULT_TOKENS);
  return { ...base, ...overrides };
}

/**
 * Build a token set with specific keys omitted. Used to exercise the
 * "missing tokens" path in `validateTokens` and `registerTheme`.
 */
function makeTokensWithout<K extends keyof DesignTokens>(omit: readonly K[]): Partial<DesignTokens> {
  const full = makeTokens();
  const out: Partial<DesignTokens> = {};
  for (const key of Object.keys(full) as (keyof DesignTokens)[]) {
    if (omit.includes(key as K)) continue;
    out[key] = full[key];
  }
  return out;
}

function makeTheme(overrides: Partial<ThemeDefinition> = {}): ThemeDefinition {
  return {
    name: 'test',
    label: 'Test',
    description: 'A test theme',
    tokens: makeTokens(),
    ...overrides,
  };
}

/* ---------------------------------------------------------------------------
 * tokens.ts
 * ------------------------------------------------------------------------- */

describe('validateTokens', () => {
  it('returns an empty list for a complete token set', () => {
    expect(validateTokens(makeTokens())).toEqual([]);
  });

  it('reports missing keys', () => {
    const partial = makeTokensWithout(['color-bg-canvas', 'radius-sm']);
    const missing = validateTokens(partial);
    expect(missing).toContain('color-bg-canvas');
    expect(missing).toContain('radius-sm');
  });

  it('covers every name in TOKEN_NAMES', () => {
    expect(TOKEN_NAMES.length).toBeGreaterThan(40);
    for (const name of TOKEN_NAMES) {
      expect(name).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('includes the new semantic-tier color tokens', () => {
    expect(TOKEN_NAMES).toContain('color-bg-canvas');
    expect(TOKEN_NAMES).toContain('color-bg-surface');
    expect(TOKEN_NAMES).toContain('color-bg-surface-raised');
    expect(TOKEN_NAMES).toContain('color-bg-overlay');
    expect(TOKEN_NAMES).toContain('color-fg-subtle');
    expect(TOKEN_NAMES).toContain('color-fg-on-accent');
    expect(TOKEN_NAMES).toContain('color-fg-on-success');
    expect(TOKEN_NAMES).toContain('color-fg-on-warning');
    expect(TOKEN_NAMES).toContain('color-fg-on-danger');
    expect(TOKEN_NAMES).toContain('color-focus-ring');
    expect(TOKEN_NAMES).toContain('color-accent-hover');
    expect(TOKEN_NAMES).toContain('color-success-soft');
    expect(TOKEN_NAMES).toContain('color-warning-soft');
    expect(TOKEN_NAMES).toContain('color-danger-soft');
  });

  it('includes the new motion and z-index tokens', () => {
    expect(TOKEN_NAMES).toContain('motion-fast');
    expect(TOKEN_NAMES).toContain('motion-base');
    expect(TOKEN_NAMES).toContain('motion-slow');
    expect(TOKEN_NAMES).toContain('ease-out');
    expect(TOKEN_NAMES).toContain('ease-in');
    expect(TOKEN_NAMES).toContain('ease-in-out');
    expect(TOKEN_NAMES).toContain('z-base');
    expect(TOKEN_NAMES).toContain('z-dropdown');
    expect(TOKEN_NAMES).toContain('z-sticky');
    expect(TOKEN_NAMES).toContain('z-modal');
    expect(TOKEN_NAMES).toContain('z-toast');
  });

  it('includes the 4-step shadow scale', () => {
    expect(TOKEN_NAMES).toContain('shadow-1');
    expect(TOKEN_NAMES).toContain('shadow-2');
    expect(TOKEN_NAMES).toContain('shadow-3');
    expect(TOKEN_NAMES).toContain('shadow-4');
  });
});

describe('flattenTokens', () => {
  it('flattens a nested shape into a flat kebab-case map', () => {
    const nested: NestedTokenShape = {
      color: { bg: { 'color-bg-canvas': '#fff' } },
      space: { 'space-4': '1rem' },
      radius: { 'radius-md': '8px' },
    };
    const flat = flattenTokens(nested);
    expect(flat['color-bg-canvas']).toBe('#fff');
    expect(flat['space-4']).toBe('1rem');
    expect(flat['radius-md']).toBe('8px');
  });

  it('produces a complete DesignTokens when applied to DEFAULT_TOKENS', () => {
    const flat = flattenTokens(DEFAULT_TOKENS);
    expect(validateTokens(flat)).toEqual([]);
  });
});

describe('mergeWithFallbacks', () => {
  it('inherits every missing key from the base', () => {
    const base = makeTokens();
    const partial: Partial<DesignTokens> = { 'color-accent': '#ff00ff' };
    const merged = mergeWithFallbacks(base, partial);
    expect(merged['color-accent']).toBe('#ff00ff');
    expect(merged['color-fg']).toBe(base['color-fg']);
    expect(merged['space-4']).toBe(base['space-4']);
    // Result is a full token set.
    expect(validateTokens(merged)).toEqual([]);
  });

  it('drops nullish override values', () => {
    const base = makeTokens();
    const merged = mergeWithFallbacks(base, {
      'color-fg': undefined as unknown as string,
    });
    expect(merged['color-fg']).toBe(base['color-fg']);
  });
});

/* ---------------------------------------------------------------------------
 * registry.ts
 * ------------------------------------------------------------------------- */

describe('registry', () => {
  beforeEach(() => {
    clearThemes();
    seedBuiltInThemes();
  });
  afterEach(() => {
    clearThemes();
    seedBuiltInThemes();
  });

  it('seeds built-in themes on first import', () => {
    const names = listThemes().map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['default', 'dark', 'midnight', 'newspaper', 'editorial']),
    );
  });

  it('exposes every built-in theme through getTheme', () => {
    for (const t of BUILT_IN_THEMES) {
      expect(getTheme(t.name)?.label).toBe(t.label);
    }
  });

  it('registerTheme adds a custom theme and is idempotent on replace', () => {
    const theme = makeTheme({ name: 'custom', label: 'Custom' });
    registerTheme(theme);
    expect(getTheme('custom')?.label).toBe('Custom');

    const replacement = makeTheme({ name: 'custom', label: 'Custom v2' });
    registerTheme(replacement);
    expect(getTheme('custom')?.label).toBe('Custom v2');
  });

  it('registerTheme rejects incomplete token sets', () => {
    const bad = makeTheme({ name: 'bad', tokens: makeTokensWithout(['color-fg']) as DesignTokens });
    expect(() => registerTheme(bad)).toThrow(/missing tokens/);
  });

  it('registerTheme rejects themes without required metadata', () => {
    expect(() => registerTheme({ ...makeTheme(), name: '' })).toThrow(/name is required/);
    expect(() => registerTheme({ ...makeTheme(), label: '' })).toThrow(/label is required/);
    expect(() => registerTheme({ ...makeTheme(), tokens: undefined as unknown as DesignTokens })).toThrow(
      /tokens is required/,
    );
  });

  it('listThemes returns a snapshot, not a live view', () => {
    const snapshot = listThemes();
    const before = snapshot.length;
    registerTheme(makeTheme({ name: 'tmp' }));
    expect(snapshot.length).toBe(before);
  });

  it('clearThemes empties the registry', () => {
    clearThemes();
    expect(listThemes()).toEqual([]);
    // Re-seed for other tests.
    seedBuiltInThemes();
    expect(listThemes().length).toBeGreaterThan(0);
  });

  it('requireTheme throws with a helpful message on miss', () => {
    expect(() => requireTheme('nope')).toThrow(/nope.*not registered/);
  });
});

/* ---------------------------------------------------------------------------
 * themes.ts
 * ------------------------------------------------------------------------- */

describe('built-in themes', () => {
  beforeEach(() => {
    clearThemes();
    seedBuiltInThemes();
  });

  it('default uses the neutral graphite palette', () => {
    const t = requireTheme('default');
    expect(t.tokens['color-bg-canvas']).toBe('#f7f7f6');
    expect(t.tokens['color-accent']).toBe('#18181b');
  });

  it('dark theme itself uses dark token values', () => {
    const t = requireTheme('dark');
    expect(t.tokens['color-bg-canvas']).toBe('#09090b');
    expect(t.tokens['color-fg']).toBe('#fafafa');
  });

  it('default provides a dark-mode override block', () => {
    const t = requireTheme('default');
    expect(t.dark).toBeDefined();
    expect(t.dark?.['color-bg-canvas']).toBe('#09090b');
  });

  it('midnight uses a violet-blue accent', () => {
    const t = requireTheme('midnight');
    expect(t.tokens['color-accent']).toBe('#6366f1');
    expect(t.dark?.['color-accent']).toBe('#818cf8');
  });

  it('editorial is minimalist (near-black accent, square-ish radius)', () => {
    const t = requireTheme('editorial');
    expect(t.tokens['color-accent']).toBe('#0a0a0a');
    expect(t.tokens['radius-md']).toBe('4px');
    expect(t.tokens['font-size-base']).toBe('1.0625rem');
  });

  it('newspaper has square corners and serif typography', () => {
    const t = requireTheme('newspaper');
    expect(t.tokens['radius-md']).toBe('0');
    expect(t.tokens['font-serif']).toMatch(/Playfair/);
  });

  it('every built-in theme has a complete token set', () => {
    for (const t of BUILT_IN_THEMES) {
      expect(validateTokens(t.tokens)).toEqual([]);
      if (t.dark) expect(validateTokens(t.dark)).toEqual([]);
    }
  });

  it('every built-in theme has a swatch preview', () => {
    for (const t of BUILT_IN_THEMES) {
      expect(t.swatch).toBeDefined();
      expect(t.swatch?.accent).toMatch(/^#/);
    }
  });
});

/* ---------------------------------------------------------------------------
 * css.ts
 * ------------------------------------------------------------------------- */

describe('themeToCSS', () => {
  beforeEach(() => {
    clearThemes();
    seedBuiltInThemes();
  });

  it('emits a :root block for the light tokens', () => {
    const css = themeToCSS(requireTheme('default'));
    expect(css).toMatch(/:root\s*\{/);
    expect(css).toContain('--color-fg: #1a1a1a;');
    expect(css).toContain('--color-accent: #18181b;');
  });

  it('emits a [data-mode="dark"] block when the theme has one', () => {
    const css = themeToCSS(requireTheme('default'));
    expect(css).toMatch(/\[data-mode="dark"\]\s*\{/);
    expect(css).toContain('--color-bg-canvas: #09090b;');
  });

  it('omits the dark block when the theme has no dark variant', () => {
    const t = makeTheme({ name: 'noDark' });
    t.dark = undefined;
    const css = themeToCSS(t);
    expect(css).not.toContain('[data-mode="dark"]');
  });

  it('respects a custom selector', () => {
    const t = requireTheme('default');
    const css = themeToCSS(t, { selector: '.my-root' });
    expect(css).toMatch(/\.my-root\s*\{/);
  });

  it('escapes embedded quotes in token values', () => {
    const t = makeTheme({
      name: 'quote',
      tokens: makeTokens({ 'font-sans': 'Arial, "Helvetica"' }),
    });
    const css = themeToCSS(t);
    expect(css).toContain('Arial, \\"Helvetica\\"');
  });

  it('wraps the body in @layer qcms-theme by default', () => {
    const css = themeToCSS(requireTheme('default'));
    expect(css.startsWith('@layer qcms-theme {')).toBe(true);
    expect(css.trimEnd().endsWith('}')).toBe(true);
  });

  it('can skip the @layer wrapper for pre-paint / build use cases', () => {
    const css = themeToCSS(requireTheme('default'), { useLayer: false });
    expect(css.startsWith('@layer')).toBe(false);
  });

  it('emits semantic section comments so the output is human-readable', () => {
    const css = themeToCSS(requireTheme('default'));
    expect(css).toContain('/* Backgrounds */');
    expect(css).toContain('/* Spacing */');
    expect(css).toContain('/* Motion */');
    expect(css).toContain('/* Z-index */');
  });
});

describe('tokensToInlineStyle', () => {
  it('renders all tokens as CSS custom properties', () => {
    const t = makeTokens({ 'color-fg': '#123456' });
    const inline = tokensToInlineStyle(t);
    expect(inline).toContain('--color-fg: #123456;');
    expect(inline).toContain('--space-4: 1rem;');
    expect(inline.startsWith('--')).toBe(true);
  });
});

/* ---------------------------------------------------------------------------
 * apply.ts
 * ------------------------------------------------------------------------- */

describe('applyThemeToDocument', () => {
  function makeFakeDocument() {
    const attrs = new Map<string, string>();
    const styles: { id: string; textContent: string; setAttribute(name: string, value: string): void }[] = [];
    return {
      attrs,
      styleEls: styles,
      documentElement: {
        setAttribute(name: string, value: string) {
          attrs.set(name, value);
        },
        getAttribute(name: string) {
          return attrs.get(name) ?? null;
        },
        style: { colorScheme: '' },
      },
      head: {
        appendChild(el: { id: string; textContent: string; setAttribute(name: string, value: string): void }) {
          styles.push(el);
        },
      },
      getElementById(id: string) {
        return styles.find((s) => s.id === id) ?? null;
      },
      createElement(tag: string) {
        return {
          id: '',
          textContent: '',
          tag,
          setAttribute(_name: string, _value: string) {
            /* test stub */
          },
          appendChild(_child: unknown) {
            return _child;
          },
        };
      },
      createTextNode(text: string) {
        return { nodeType: 3, text };
      },
    };
  }

  it('returns false and does not throw when the theme is missing', () => {
    const fakeDoc = makeFakeDocument();
    const result = applyThemeToDocument('missing', 'light', {
      document: fakeDoc as unknown as Document,
      withTransitions: false,
    });
    expect(result).toBe(false);
    expect(fakeDoc.attrs.has('data-theme')).toBe(false);
  });

  it('sets data-theme and data-mode and injects CSS', () => {
    clearThemes();
    seedBuiltInThemes();
    const fakeDoc = makeFakeDocument();
    const result = applyThemeToDocument('default', 'light', {
      document: fakeDoc as unknown as Document,
      withTransitions: false,
    });
    expect(result).toBe(true);
    expect(fakeDoc.attrs.get('data-theme')).toBe('default');
    expect(fakeDoc.attrs.get('data-mode')).toBe('light');
    const tokenStyle = fakeDoc.styleEls.find((s) => s.id === 'qcms-theme');
    expect(tokenStyle).toBeDefined();
    expect(tokenStyle?.textContent).toContain('--color-accent: #18181b');
  });

  it('reuses the existing style element on subsequent calls', () => {
    clearThemes();
    seedBuiltInThemes();
    const fakeDoc = makeFakeDocument();
    applyThemeToDocument('default', 'light', {
      document: fakeDoc as unknown as Document,
      withTransitions: false,
    });
    applyThemeToDocument('dark', 'light', {
      document: fakeDoc as unknown as Document,
      withTransitions: false,
    });
    const tokenStyle = fakeDoc.styleEls.filter((s) => s.id === 'qcms-theme');
    expect(tokenStyle).toHaveLength(1);
    expect(tokenStyle[0]?.textContent).toContain('--color-bg-canvas: #09090b');
  });

  it('is idempotent — re-applying the same args does not mutate DOM', () => {
    clearThemes();
    seedBuiltInThemes();
    const fakeDoc = makeFakeDocument();
    applyThemeToDocument('default', 'light', {
      document: fakeDoc as unknown as Document,
      withTransitions: false,
    });
    const tokenStyle = fakeDoc.styleEls.find((s) => s.id === 'qcms-theme');
    const before = tokenStyle?.textContent;
    applyThemeToDocument('default', 'light', {
      document: fakeDoc as unknown as Document,
      withTransitions: false,
    });
    const after = fakeDoc.styleEls.find((s) => s.id === 'qcms-theme')?.textContent;
    expect(after).toBe(before);
  });

  it('injects a smooth-transition style block by default', () => {
    clearThemes();
    seedBuiltInThemes();
    const fakeDoc = makeFakeDocument();
    applyThemeToDocument('default', 'light', {
      document: fakeDoc as unknown as Document,
    });
    const motionStyle = fakeDoc.styleEls.find((s) => s.id === 'qcms-theme-motion');
    expect(motionStyle).toBeDefined();
    expect(motionStyle?.textContent).toContain('--motion-base');
  });

  it('supports an explicit style element override', () => {
    clearThemes();
    seedBuiltInThemes();
    const fakeDoc = makeFakeDocument();
    const styleEl = {
      id: 'external',
      textContent: '',
      setAttribute(_name: string, _value: string) {
        /* test stub */
      },
    };
    applyThemeToDocument('default', 'light', {
      document: fakeDoc as unknown as Document,
      styleElement: styleEl as unknown as HTMLStyleElement,
      withTransitions: false,
    });
    expect(styleEl.textContent).toContain('--color-accent');
    expect(fakeDoc.styleEls).toHaveLength(0);
  });

  it('buildPrePaintStyleTag returns a complete <style> string', () => {
    clearThemes();
    seedBuiltInThemes();
    const tag = buildPrePaintStyleTag('default', 'light');
    expect(tag).not.toBeNull();
    expect(tag).toContain('<style id="qcms-theme"');
    expect(tag).toContain('--color-accent: #18181b');
  });

  it('buildPrePaintStyleTag returns null for unknown themes', () => {
    expect(buildPrePaintStyleTag('nope')).toBeNull();
  });
});

describe('readAppliedTheme / readAppliedMode', () => {
  it('returns null / light when nothing is set', () => {
    const fakeDoc = {
      documentElement: { getAttribute: () => null },
    };
    expect(readAppliedTheme(fakeDoc as unknown as Document)).toBeNull();
    expect(readAppliedMode(fakeDoc as unknown as Document)).toBe('light');
  });

  it('returns the stored values when present', () => {
    const fakeDoc = {
      documentElement: {
        getAttribute(name: string) {
          if (name === 'data-theme') return 'dark';
          if (name === 'data-mode') return 'dark';
          return null;
        },
      },
    };
    expect(readAppliedTheme(fakeDoc as unknown as Document)).toBe('dark');
    expect(readAppliedMode(fakeDoc as unknown as Document)).toBe('dark');
  });
});

describe('watchSystemColorScheme', () => {
  it('returns a no-op teardown when window.matchMedia is missing', () => {
    const cleanup = watchSystemColorScheme(
      () => ({ themeName: 'default', mode: 'auto' as const }),
      () => true,
    );
    expect(typeof cleanup).toBe('function');
    cleanup(); // should not throw
  });
});
