# Subagent 4 — Theme Polish (Themes, Tokens, ThemePicker)

**Status:** Delivered (2026-06-05)
**Scope:** `@q-cms/theme` package, `@q-cms/ui` ThemeProvider + new
`ThemePicker`, admin settings page Theme card, public-site theme
bootstrap, screenshot suite.

## TL;DR

The original v0.1 had a working but utilitarian theme system. This
round is a senior-designer polish pass:

- **5 themes** instead of 3 — added `midnight` (deep violet-blue
  night) and `editorial` (monochrome, near-black, Stripe-Press
  inspired).
- **Semantic three-tier color tokens** — `--color-bg-canvas`,
  `--color-bg-surface`, `--color-bg-surface-raised`,
  `--color-bg-overlay`, `--color-fg-subtle`, `--color-fg-on-accent`,
  `--color-focus-ring`, plus `-hover` and `-soft` variants.
- **Motion tokens** (`--motion-fast/base/slow`, `--ease-out/in/in-out`)
  and a **z-index scale** (`--z-base/dropdown/sticky/overlay/modal/popover/toast`).
- **4-step multi-layer shadow scale** (`--shadow-1…4`) — proper
  key+ambient depth, not `rgba(0,0,0,0.1)`.
- **6-step radius scale** with `radius-none` for sharp-corner
  themes like `newspaper` / `editorial`.
- **`@layer qcms-theme` wrapping** in the generated CSS so the
  cascade is predictable and app code never needs `!important`.
- **Gallery-quality ThemePicker** — 1/2/3-column grid of large
  cards with 6-swatch previews, hover lift, focus ring, active
  badge; filter chips (All/Light/Dark); segmented light/dark/auto
  control; loading skeleton; empty state.
- **Token inspector** (Linear / Radix token-viewer pattern) in the
  settings page; shows every color, every spacing step, every
  radius, every shadow.
- **Live theme preview** in the settings page — a sample article
  header rendered with the active theme's tokens.
- **Reset to defaults** button on the settings page.
- **FOUC-free public-site theme** — `theme.js` rewrites default
  attributes and CSS variables synchronously before paint.
- **Live OS color-scheme tracking** in both the admin provider
  and the public-site script.
- **Cross-tab sync** via the `storage` event (already in v0.1,
  verified working in this pass).
- **Smooth 200ms transitions** on every theme-affected property
  (with inputs explicitly excluded to avoid caret jumps).

## What I built

### 1. `packages/theme/src/tokens.ts` — Semantic three-tier taxonomy

- **Color**: split into 5 sub-trees (`color.bg`, `color.fg`,
  `color.border`, `color.accent`, `color.link`, `color.success`,
  `color.warning`, `color.danger`). Each tree's keys are already
  kebab-case (e.g. `color-bg-canvas`).
- **Spacing**: 8-point grid with `space-0` (0) through `space-48`
  (12rem). Numeric keys stay numeric so the generator can emit
  the right CSS variable name.
- **Radius**: 6 steps including `radius-none` (so square
  themes don't have to use string overrides) and `radius-full`
  (pill).
- **Shadow**: 4 multi-layer elevations. Each step combines a
  tight contact shadow (key light) and a softer drop (ambient
  sky) so cards look lifted, not stamped.
- **Motion**: 3 durations (120/200/320ms) + 3 easing curves.
- **Z-index**: 7-step scale from `z-base` to `z-toast`.
- **Typography**: same as v0.1 (font stacks, type scale).
- **Layout**: `max-width`, `content-width`.

New helpers:

- `flattenTokens(nested)` — turn the nested `NestedTokenShape`
  into a flat `DesignTokens`.
- `mergeNested(base, override)` — recursively merge two
  nested shapes (used for the dark override).
- `mergeWithFallbacks(base, override)` — partial-flat merge that
  inherits missing keys from the base. Used by `applyThemeToDocument`
  so a theme that omits `--shadow-4` still gets a sane value.
- `DEFAULT_TOKENS` — exported default nested shape, used as the
  base for every built-in theme and for tests.

### 2. `packages/theme/src/themes.ts` — 5 themes, swatch previews

- `default` — cream + ember orange (v0.1, refined).
- `dark` — first-class dark theme (not just an override of
  `default`). Tagged `Classic` in the picker.
- `midnight` — deep violet-blue night mode. Tagged `New` in the
  picker.
- `newspaper` — high-contrast serif, square corners, no shadows.
- `editorial` — minimalist, monochrome, near-black accent, very
  subtle shadows. Tagged `Featured` in the picker.

Each theme defines:
- `tokens` — a complete flat `DesignTokens`.
- `dark?` — an optional `DesignTokens` override for dark mode.
- `swatch?` — 6 colors used by the ThemePicker card preview.
- `badge?` — a small pill ("New", "Classic", "Featured") on the
  card.
- `modeHint?` — `'light' | 'dark' | 'any'`. The picker's filter
  chips use this to bucket the themes.

The `build()` helper merges each partial nested shape with the
design defaults, so every theme ends up with the full token set
the registry validates against.

### 3. `packages/theme/src/css.ts` — Layered, labeled output

- Wraps the output in `@layer qcms-theme { … }` by default. App
  CSS can always override theme variables without `!important`,
  and themes layered over one another compose predictably.
- Emits `/* Backgrounds */`, `/* Spacing */`, `/* Shadow */`,
  `/* Motion */`, `/* Z-index */` section comments so the
  generated CSS is human-readable.
- Adds `useLayer` and `skipDark` flags for tests and pre-paint
  paths.

### 4. `packages/theme/src/apply.ts` — Smooth, idempotent, FOUC-free

- `applyThemeToDocument()` is **idempotent** — re-applying with
  the same args does not mutate the existing style tag's text.
- It also injects a `qcms-theme-motion` style block with a
  200ms transition on `*` (excluding form controls) so theme
  swaps feel cinematic but not slow.
- New `buildPrePaintStyleTag()` returns a complete `<style>` tag
  string for inline head injection (no FOUC on the public site).
- New `watchSystemColorScheme()` returns a cleanup function for
  the OS color-scheme media query.

### 5. `packages/ui/src/theme-provider.tsx` — `auto` mode + cross-tab

- Adds a third mode: `'auto'` (default). When `auto` is active,
  the effective mode follows `prefers-color-scheme`, with live
  updates.
- Listens to `storage` events so a theme change in another tab
  takes effect immediately.
- Persists the choice (theme + mode) to `localStorage.qcms_theme`.
- New `reset()` callback — clears localStorage and reverts to
  the default theme in `auto` mode.

### 6. `packages/ui/src/theme-picker.tsx` — Gallery-quality gallery

`ThemePicker` is the centerpiece of the polished settings page.

- **3-column grid on desktop, 2 on tablet, 1 on mobile.**
- **Each card**: 6-swatch preview (bg, surface, fg, accent,
  muted, border), name, optional badge, one-line description.
- **Active card**: accent border, ring, elevation 2 shadow,
  checkmark badge.
- **Hover**: `translateY(-2px)`, shadow elevation 2 → 3,
  200ms ease.
- **Focus**: always-visible focus ring using
  `--color-focus-ring`.
- **Filter chips**: All / Light / Dark, with animated layout
  shift when the filter changes.
- **Segmented control**: Light / Dark / Auto for the mode.
- **Loading state**: 3 skeleton cards with `animate-pulse`.
- **Empty state**: "No themes match the current filter" with a
  dashed border.

Designed to feel like the theme picker in **Linear**, **Vercel**,
or **Stripe Dashboard** — not like a `<select>`.

### 7. `apps/admin/src/components/ThemePicker/`

- **`ThemePreview`** — a small "what this theme looks like"
  panel. Renders a sample article header (eyebrow, title,
  paragraph, two buttons) using the active theme's CSS
  variables. Lives next to the ThemePicker in the settings page.
- **`TokenInspector`** — a Linear / Radix-style token viewer.
  Shows every color (with alpha-safe swatches), every spacing
  step (with a horizontal bar sized to the value), every radius
  (with a square at that radius), every shadow (with a tile at
  that elevation), and the motion tokens.
- **`index.ts`** — public re-exports.

### 8. `apps/admin/src/app/(dashboard)/settings/page.tsx`

The Theme card is now a 2-column layout:

- **Left**: live theme preview (sample article header).
- **Right**: the ThemePicker (gallery of cards + filter chips +
  segmented mode control).

Below the picker:

- A "Reset to defaults" button (clears `localStorage.qcms_theme`,
  applies the default theme in auto mode).
- A collapsible "Token inspector" `<details>` that lists every
  value in the active theme.

### 9. `apps/web/public/js/theme.js` — FOUC-free, live-tracking

Rewrite of the public-site bootstrap. Key changes:

- Runs synchronously in `<head>` — applies `data-theme`,
  `data-mode`, `color-scheme`, and **the canvas background** on
  `<html>` *before* the first paint.
- Wraps the generated CSS in `@layer qcms-theme`.
- Listens to live `prefers-color-scheme` changes (only honored
  when the user is in `auto` mode).
- Cross-tab sync via `storage` event (already in v0.1, verified).
- Exposes a tiny `window.QCMS_THEME` API: `get`, `set`, `list`,
  `cycle`.
- All themes inlined (5 themes × light + dark). The dark block
  in the generated CSS is the active theme's dark variant, or
  the same as light if no dark variant is defined.

### 10. `apps/web/public/css/site.css` — Smooth transitions + hero glow

- Aliases the new semantic tokens (`--color-bg-canvas` → legacy
  `--color-bg`, etc.) so the pre-token CSS keeps working.
- Adds a global `transition` on `html` for `background-color`,
  `color`, `border-color` (200ms ease-out). Excludes inputs and
  contenteditable so caret jumps don't happen.
- Adds a theme-aware `text-shadow` on `.hero h1`: a soft drop
  on light, a gentle glow on dark.

## Public API (what other agents should consume)

### From `@q-cms/theme`

```ts
import {
  // Tokens
  type DesignTokens,
  type NestedTokenShape,
  type TokenName,
  TOKEN_NAMES,
  flattenTokens,
  mergeNested,
  mergeWithFallbacks,
  validateTokens,
  DEFAULT_TOKENS,

  // Themes
  type ThemeDefinition,
  type ThemeSwatch,
  BUILT_IN_THEMES,
  registerTheme,
  getTheme,
  listThemes,
  requireTheme,
  seedBuiltInThemes,
  clearThemes,

  // CSS
  themeToCSS,
  tokensToInlineStyle,
  type ThemeCSSOptions,

  // Apply
  STYLE_ID,
  applyThemeToDocument,
  readAppliedTheme,
  readAppliedMode,
  buildPrePaintStyleTag,
  watchSystemColorScheme,
  type ApplyOptions,
  type Mode,
  type SystemMode,
} from '@q-cms/theme';
```

### From `@q-cms/ui`

```tsx
import {
  ThemeProvider,
  useTheme,
  type ThemeContextValue,
  type ThemeProviderProps,
  ThemePicker,
  type ThemePickerProps,
  type ThemeFilter,
  type ModeChoice,
} from '@q-cms/ui';
```

## CSS token contract (public)

The following CSS variable names are part of the public contract
between `@q-cms/theme` and any consumer CSS. New code should use
the **semantic three-tier** names; legacy names (`--color-bg`,
`--color-bg-elevated`) are aliased at the bottom of `:root` in
both `apps/web/public/css/site.css` and
`apps/admin/src/app/globals.css` for backward compatibility.

```
--color-bg-canvas / --color-bg-surface / --color-bg-surface-raised / --color-bg-overlay
--color-fg / --color-fg-muted / --color-fg-subtle
--color-fg-on-accent / --color-fg-on-success / --color-fg-on-warning / --color-fg-on-danger
--color-border / --color-border-strong / --color-focus-ring
--color-accent / --color-accent-hover / --color-accent-soft
--color-link / --color-link-hover
--color-success / --color-success-soft
--color-warning / --color-warning-soft
--color-danger / --color-danger-soft
--space-0 … --space-48
--radius-none / --radius-sm / --radius-md / --radius-lg / --radius-xl / --radius-full
--shadow-1 / --shadow-2 / --shadow-3 / --shadow-4
--motion-fast / --motion-base / --motion-slow
--ease-out / --ease-in / --ease-in-out
--z-base / --z-dropdown / --z-sticky / --z-overlay / --z-modal / --z-popover / --z-toast
--font-serif / --font-sans / --font-mono
--font-size-base / --line-height-base / --font-size-h1 / --font-size-h2 / --font-size-h3
--max-width / --content-width
```

If you add a new token, update `TOKEN_NAMES` in
`packages/theme/src/tokens.ts`, the inline object in
`apps/web/public/js/theme.js` (since the public site is static),
and the `:root` block in `apps/web/public/css/site.css`.

## Built-in themes

| Name | Description | Has dark | modeHint | Badge |
|------|-------------|----------|----------|-------|
| `default` | Cream + ember orange (v0.1, refined) | yes | any | — |
| `dark` | First-class charcoal night mode | yes (same as light) | dark | Classic |
| `midnight` | Deep violet-blue night mode | yes | dark | New |
| `newspaper` | High-contrast serif, square corners, no shadows | yes | any | — |
| `editorial` | Minimalist, monochrome, near-black accent | yes | any | Featured |

## Verification

- `pnpm --filter @q-cms/theme test` → **46/46** pass (was 28/28 in v0.1).
  New tests cover: token merge with fallbacks, the new
  semantic-tier color tokens, the new motion / z-index / shadow
  tokens, theme `midnight` and `editorial`, swatch previews on
  every theme, `@layer` wrapping, semantic section comments,
  `applyThemeToDocument` idempotency, motion style injection,
  `buildPrePaintStyleTag`, `watchSystemColorScheme`.
- `pnpm --filter @q-cms/ui test` → **37/37** pass.
- `pnpm --filter @q-cms/admin test` → **57/57** pass (6 new
  ThemePicker tests).
- `pnpm test:unit` (root) → **17/17** packages succeed.
- `node scripts/test-theme-fouc.mjs` → **15/15** pass. Verifies
  that `theme.js` applies the stored theme synchronously, the
  `set` API is idempotent, the OS preference is honored, all 5
  themes are listed, and `cycle()` works.
- `scripts/screenshot-theme-picker.mjs` — new script that
  captures 10 settings-page screenshots (50–59) and re-runs the
  full public-site theme sweep (5 pages × 5 themes × 2 modes =
  50 screenshots). Output: `screenshots/50-…png` through
  `screenshots/59-…png`, plus a fresh
  `screenshots/theme-summary.json`.

## Coordination notes for the other agents

- **Subagent 5 (templates / page-builder):** the public-site
  template engine and page-builder UI are unchanged. The new
  semantic token names are available — feel free to use them in
  the block components, or stick with the legacy aliases.
- **Subagent 6 (visual block editor / preview):** the editor
  and preview pane are unchanged. The ThemeProvider still sits
  above the editor tree, so the editor can read the active
  theme via `useTheme()` and `applyThemeToDocument` handles
  CSS variables automatically. No coordination blockers.

## Files I created / changed

**Created**

- `packages/theme/src/index.test.ts` — expanded from 28 to 46
  tests, all passing.
- `packages/ui/src/theme-picker.tsx` — the new component.
- `apps/admin/src/components/ThemePicker/ThemePreview.tsx`
- `apps/admin/src/components/ThemePicker/TokenInspector.tsx`
- `apps/admin/src/components/ThemePicker/index.ts`
- `apps/admin/test/theme-picker.test.tsx` — 6 rendering tests.
- `scripts/screenshot-theme-picker.mjs` — new screenshot suite.
- `scripts/test-theme-fouc.mjs` — FOUC unit test.
- `docs/plans/agent-4-themes-polish.md` — this file.

**Modified**

- `packages/theme/src/tokens.ts` — semantic three-tier
  taxonomy, `flattenTokens`, `mergeNested`, `mergeWithFallbacks`,
  motion + z-index + 4-step shadow tokens, `DEFAULT_TOKENS`
  export.
- `packages/theme/src/themes.ts` — 5 themes with swatches,
  badges, mode hints. `ThemeSwatch` export.
- `packages/theme/src/css.ts` — `@layer` wrapping, section
  comments, `useLayer` / `skipDark` flags, `ThemeCSSOptions`
  export.
- `packages/theme/src/apply.ts` — idempotency, motion style
  injection, `buildPrePaintStyleTag`, `watchSystemColorScheme`,
  `STYLE_ID` export, `SystemMode` type.
- `packages/theme/src/index.ts` — re-export new helpers.
- `packages/ui/src/theme-provider.tsx` — `auto` mode, OS
  color-scheme tracking, `storage` event listener, `reset()`
  callback.
- `packages/ui/src/index.ts` — re-export `ThemePicker`.
- `packages/ui/src/index.test.ts` — added 4 ThemePicker tests.
- `apps/admin/package.json` — added `@q-cms/theme` workspace
  dependency.
- `apps/admin/src/app/(dashboard)/settings/page.tsx` —
  ThemeCard redesigned with 2-column layout, ThemePreview,
  TokenInspector, Reset button.
- `apps/admin/src/app/globals.css` — aliases the new semantic
  tokens, adds a global 200ms transition (excluding inputs).
- `apps/web/public/css/site.css` — aliases the new semantic
  tokens, adds global transition, theme-aware hero text-shadow.
- `apps/web/public/js/theme.js` — full rewrite. 5 themes, FOUC
  prevention, live OS color-scheme tracking, cross-tab sync.
- `scripts/test-theme.mjs` — added `midnight` and `editorial`
  to the sweep, updated to read `--color-bg-canvas`.

## Out of scope (intentionally untouched)

- `apps/admin/src/components/PageBuilder/*` — Subagent 5
- `apps/admin/src/components/Editor/*` — Subagent 6
- `apps/admin/src/app/(dashboard)/preview/*` — Subagent 6
- `apps/admin/src/app/(dashboard)/collections/*` — pre-existing
- `apps/admin/src/app/(dashboard)/templates/*` — Subagent 5
- `apps/web/public/js/template-engine.js` — Subagent 5
- `packages/templates/` — Subagent 5
- `packages/editor/` — Subagent 6
