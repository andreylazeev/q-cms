/**
 * In-memory theme registry.
 *
 * The registry is intentionally simple: a `Map<string, ThemeDefinition>`.
 * Consumers can call `registerTheme()` to add custom themes, `getTheme()`
 * to fetch by name, and `listThemes()` to enumerate. `clearThemes()`
 * wipes the registry — useful in tests and for "load custom theme pack"
 * flows in the admin.
 *
 * The module is side-effecting: importing it populates the registry
 * with the built-in themes from `themes.ts`. To opt out, do
 * `clearThemes()` immediately after import.
 *
 * @packageDocumentation
 */

import { BUILT_IN_THEMES } from './themes';
import type { ThemeDefinition } from './themes';
import { validateTokens } from './tokens';

/**
 * Internal store. Module-level so all importers share state, but
 * the public API exposes typed accessors.
 */
const store = new Map<string, ThemeDefinition>();

/** Track whether built-ins have been seeded to avoid double-seeding. */
let seeded = false;

/**
 * Seed the registry with `BUILT_IN_THEMES`. Idempotent.
 */
export function seedBuiltInThemes(): void {
  if (seeded) return;
  for (const theme of BUILT_IN_THEMES) {
    store.set(theme.name, theme);
  }
  seeded = true;
}

// Auto-seed on first import.
seedBuiltInThemes();

/**
 * Register a custom theme. Throws when:
 *   - the theme is missing one or more required tokens
 *   - the theme is missing `name`, `label`, or `tokens`
 *
 * @param theme - The theme definition to add (or replace).
 * @returns The registered theme, for chaining.
 */
export function registerTheme(theme: ThemeDefinition): ThemeDefinition {
  if (!theme || typeof theme !== 'object') {
    throw new TypeError('registerTheme: theme must be an object');
  }
  if (!theme.name || typeof theme.name !== 'string') {
    throw new TypeError('registerTheme: theme.name is required');
  }
  if (!theme.label || typeof theme.label !== 'string') {
    throw new TypeError('registerTheme: theme.label is required');
  }
  if (!theme.tokens || typeof theme.tokens !== 'object') {
    throw new TypeError('registerTheme: theme.tokens is required');
  }
  const missing = validateTokens(theme.tokens);
  if (missing.length > 0) {
    throw new Error(`registerTheme: theme "${theme.name}" is missing tokens: ${missing.join(', ')}`);
  }
  store.set(theme.name, theme);
  return theme;
}

/**
 * Fetch a theme by name. Returns `undefined` if not registered.
 */
export function getTheme(name: string): ThemeDefinition | undefined {
  return store.get(name);
}

/**
 * Enumerate every registered theme. Returned array is a snapshot —
 * mutating it does not affect the registry.
 */
export function listThemes(): ThemeDefinition[] {
  return Array.from(store.values());
}

/**
 * Remove every theme. The next call to `listThemes()` returns `[]`
 * until someone re-registers a theme. Mainly used in tests.
 */
export function clearThemes(): void {
  store.clear();
  seeded = false;
}

/**
 * Look up a theme or throw a descriptive error.
 *
 * @throws Error if the theme is not registered.
 */
export function requireTheme(name: string): ThemeDefinition {
  const theme = store.get(name);
  if (!theme) {
    throw new Error(
      `requireTheme: theme "${name}" is not registered. Available: ${listThemes()
        .map((t) => t.name)
        .join(', ')}`,
    );
  }
  return theme;
}
