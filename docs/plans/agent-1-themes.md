# Subagent 1 — Themes & Design Tokens

**Status:** Delivered (2026-06-05)
**Scope:** `@q-cms/theme` package, `ThemeProvider` in `@q-cms/ui`, admin
settings wiring, public-site theme bootstrap.

## What I built

### 1. `packages/theme/`

A standalone, framework-agnostic theme package.

| File | Purpose |
|------|---------|
| `src/tokens.ts` | `DesignTokens` type (colors, spacing, radius, shadow, typography, layout), `TOKEN_NAMES` tuple, `validateTokens()` helper |
| `src/themes.ts` | `ThemeDefinition` type + 3 built-ins: `default`, `dark`, `newspaper` |
| `src/registry.ts` | `registerTheme`, `getTheme`, `listThemes`, `clearThemes`, `requireTheme`, `seedBuiltInThemes` |
| `src/css.ts` | `themeToCSS(theme, opts?)` — renders `:root { --token: value }` plus optional `[data-mode="dark"]` block; `tokensToInlineStyle()` for previews |
| `src/apply.ts` | `applyThemeToDocument(themeName, mode, opts?)` — sets `data-theme` / `data-mode` on `<html>`, injects a single `<style id="qcms-theme">` block |
| `src/index.ts` | Public re-exports |
| `src/index.test.ts` | 28 unit tests (registry, css, apply) |

The package auto-seeds the built-in themes on first import. Tests run with
`pnpm --filter @q-cms/theme test`.

### 2. `packages/ui/src/theme-provider.tsx`

React bindings for the theme package:

```tsx
import { ThemeProvider, useTheme } from "@q-cms/ui";

<ThemeProvider>
  <App />
</ThemeProvider>
```

- Persists choice to `localStorage.qcms_theme` as `{ theme, mode }`.
- Respects `prefers-color-scheme` on first paint.
- Exposes `theme`, `themeName`, `mode`, `availableThemes`,
  `setThemeName()`, `setMode()`, `cycleTheme()`.

The provider applies the theme to the document via
`applyThemeToDocument()` on every change.

### 3. Admin wiring

- `apps/admin/src/components/Providers.tsx` — wraps the tree in
  `<ThemeProvider>` (inside the existing `QueryClientProvider` →
  `AuthProvider` → `ToastProvider` stack).
- `apps/admin/src/app/(dashboard)/settings/page.tsx` — adds a
  "Theme" card with a select (`data-testid="theme-select"`) and a
  light/dark mode toggle (`role="radiogroup"`).
- `apps/admin/src/app/globals.css` — admin's pre-existing CSS vars
  (`--color-background`, `--color-foreground`, …) are now aliases
  for the new theme tokens, with hard-coded fallbacks so a pre-
  theme paint still works. Dark mode is also driven by
  `[data-mode="dark"]`, not just `.dark`.

### 4. Public site wiring

- `apps/web/public/css/site.css` — token names already matched
  `@q-cms/theme`; I added a `[data-mode="dark"]` block with the
  dark palette values, plus a small dark-mode override for
  `.site-header` (so the sticky header's translucent white
  background becomes translucent charcoal).
- `apps/web/public/js/theme.js` — new bootstrap script. Reads
  `localStorage.qcms_theme` (or falls back to
  `prefers-color-scheme`), injects the matching CSS variables,
  and sets `data-theme` / `data-mode` on `<html>`. Listens for
  the `storage` event so a theme change in the admin tab takes
  effect on the public site too. Exposes a tiny API on
  `window.QCMS_THEME` (`get`, `set`, `list`) for cross-tab
  updates.
- Added `<script src="/js/theme.js"></script>` to all 5 public
  content pages (home, articles list, single article, authors,
  categories) in `<head>` so themes apply before paint.

## Public API (what other agents should consume)

### From `@q-cms/theme` (no React)

```ts
import {
  type DesignTokens,
  type ThemeDefinition,
  BUILT_IN_THEMES,
  listThemes,
  getTheme,
  registerTheme,
  themeToCSS,
  applyThemeToDocument,
} from "@q-cms/theme";
```

- **`themeToCSS(theme, options?)`** — render a theme as a CSS
  string. Use it in build pipelines, e2e fixtures, or
  documentation. Returns `:root { … }` plus
  `[data-mode="dark"] { … }` when the theme defines a dark
  override.
- **`applyThemeToDocument(themeName, mode, options?)`** — runtime
  application. Mutates `document.documentElement` and reuses
  `<style id="qcms-theme">` so toggling never accumulates tags.

### From `@q-cms/ui` (React)

```tsx
import {
  ThemeProvider,
  useTheme,
  type ThemeContextValue,
} from "@q-cms/ui";
```

- **`useTheme()`** returns:
  ```ts
  {
    theme: ThemeDefinition;
    themeName: string;
    mode: "light" | "dark";
    availableThemes: ThemeDefinition[];
    setThemeName: (name: string) => void;
    setMode: (mode: "light" | "dark") => void;
    cycleTheme: () => void;
  }
  ```
- The `ThemeProvider` is the only thing that needs to be at the
  root of a tree; everything else can read it with the hook.

## CSS token contract

The following variable names are part of the **public** contract
between the theme package and any consumer CSS:

```
--color-fg
--color-bg
--color-bg-elevated
--color-fg-muted
--color-border
--color-border-strong
--color-accent
--color-accent-soft
--color-link
--color-link-hover
--color-danger
--color-success
--color-warning
--space-1 … --space-24
--radius-sm --radius-md --radius-lg --radius-full
--shadow-sm --shadow-md --shadow-lg
--font-serif --font-sans --font-mono
--font-size-base --line-height-base --font-size-h1 … --font-size-h3
--max-width --content-width
```

If you add a new token, update `TOKEN_NAMES` in
`packages/theme/src/tokens.ts` and the inline object in
`apps/web/public/js/theme.js` (since the public site is static).

## Built-in themes

- **`default`** — cream `#faf9f7` + ember orange `#c2410c`, the
  pre-existing public-site look. Has a `dark` override.
- **`dark`** — charcoal night mode of `default`. No separate
  dark block (its light tokens are already dark).
- **`newspaper`** — high-contrast, serif-heavy, square corners,
  no shadows. Has a dark variant for night reading.

## Verification

- `pnpm --filter @q-cms/theme test` → 28/28 pass
- `pnpm --filter @q-cms/ui test` → 33/33 pass
- `pnpm test:unit` (root) → 16/17 tasks succeed. The single
  failure (`@q-cms/admin/test/hooks.test.ts > api-client stub`)
  is **pre-existing** and unrelated to themes.
- `scripts/test-theme.mjs` (Playwright) renders every public
  page in every (theme × mode) combo and saves
  `screenshots/theme-*.png` plus a JSON summary.
  Usage: `node scripts/test-theme.mjs` (with the web app on
  `:3002`).

## Coordination notes for the other agents

- **Subagent 2 (templates / page-builder):** the public-site
  HTML structure and `js/templates*` files are yours. I added
  `<script src="/js/theme.js"></script>` to all 5 content pages
  but did not touch the templates JS. If you add a new HTML
  page, include that script tag in the `<head>`.
- **Subagent 3 (visual block editor):** the `Editor/*` components
  are yours; the admin `ThemeProvider` I added sits **above**
  the editor tree, so the editor can read the active theme via
  `useTheme()` and the `applyThemeToDocument` side effect
  handles the CSS variables automatically. No coordination
  blockers.

## Files I created / changed

**Created**
- `packages/theme/package.json`
- `packages/theme/tsconfig.json`
- `packages/theme/vitest.config.ts`
- `packages/theme/src/tokens.ts`
- `packages/theme/src/themes.ts`
- `packages/theme/src/registry.ts`
- `packages/theme/src/css.ts`
- `packages/theme/src/apply.ts`
- `packages/theme/src/index.ts`
- `packages/theme/src/index.test.ts`
- `packages/ui/src/theme-provider.tsx`
- `apps/web/public/js/theme.js`
- `scripts/test-theme.mjs`
- `docs/plans/agent-1-themes.md` (this file)

**Modified**
- `packages/ui/package.json` (added `@q-cms/theme` dep)
- `packages/ui/src/index.ts` (re-export `ThemeProvider`, `useTheme`)
- `packages/ui/src/index.test.ts` (added 2 tests for the new exports)
- `apps/admin/src/components/Providers.tsx` (wrapped in `<ThemeProvider>`)
- `apps/admin/src/app/(dashboard)/settings/page.tsx` (added Theme card)
- `apps/admin/src/app/globals.css` (aliased to theme tokens)
- `apps/web/public/css/site.css` (added dark-mode block + dark header)
- `apps/web/public/index.html` (+ theme.js script)
- `apps/web/public/articles/index.html` (+ theme.js script)
- `apps/web/public/articles/[slug]/index.html` (+ theme.js script)
- `apps/web/public/authors/index.html` (+ theme.js script)
- `apps/web/public/categories/index.html` (+ theme.js script)
- `pnpm-lock.yaml` (workspace symlink for `@q-cms/theme`)

## Out of scope (intentionally untouched)

- `apps/admin/src/components/Editor/*` — Subagent 3
- `apps/admin/src/app/(dashboard)/collections/*` — Subagent 2
- `packages/templates/` and `packages/editor/src/preview.ts` —
  other agents
- `apps/admin/src/lib/stubs/*` — pre-existing typecheck warnings
