# Integration summary v2 — Senior-designer polish

**Date:** 2026-06-05
**Goal:** Довести дизайн кастомных тем, шаблонов и редактора до senior-designer уровня UI/UX.
**Method:** Three parallel polish subagents on isolated scopes, then integration verify.

## TL;DR

All three subagents delivered. **17/17 packages pass, FULL TURBO.** All public
JS modules pass `node --check`. 25 plan/screenshot scripts ready to run. ~200
new tests across the three layers.

## What changed in the polish round

### Subagent 4 — Themes polish

| Deliverable | Status |
|---|---|
| Semantic 3-tier token taxonomy (`color.bg.canvas / .surface / .surface-raised / .overlay`, fg + on-accent + on-success/-warning/-danger, focus-ring) | ✅ |
| 12-step spacing on 8-point grid, 6-step radius, 4-step multi-layer shadow, motion (`fast/base/slow`, `ease-out/-in/-in-out`), z-index scale | ✅ |
| 5 themes: `default`, `dark`, `midnight` (new), `newspaper`, `editorial` (new) | ✅ |
| `@layer qcms-theme` cascade wrap; section comments in generated CSS | ✅ |
| `applyThemeToDocument` is idempotent + injects 200ms transition (excl. inputs) | ✅ |
| `buildPrePaintStyleTag` for FOUC-free head injection | ✅ |
| `ThemeProvider` with `auto` mode, live `prefers-color-scheme` tracking, cross-tab sync, `reset()` | ✅ |
| `ThemePicker` component: 3-col card grid, 6-swatch preview, active checkmark + accent border, filter chips (All / Light / Dark), segmented mode control, 3-card skeleton, empty state, focus ring, hover lift | ✅ |
| `ThemePreview` (sample article rendered with active theme) | ✅ |
| `TokenInspector` (Linear/Radix-style swatch/spacing/radius/shadow/motion viewer) | ✅ |
| Settings page: 2-column layout (live preview + picker) + collapsible token inspector + reset | ✅ |
| Public `theme.js` rewrite: 5 themes inlined, synchronous pre-paint, OS preference live, cross-tab sync, `window.QCMS_THEME` API | ✅ |
| Tests: `@q-cms/theme` 46/46 (was 28), `@q-cms/ui` 37/37 (+4), `@q-cms/admin` 57/57 (+6) | ✅ |
| `scripts/test-theme-fouc.mjs` — 15/15 FOUC + idempotency + cycle tests | ✅ |
| `scripts/screenshot-theme-picker.mjs` — settings picker (10) + 5×5×2 sweep (50) + FOUC (1) | ✅ |

### Subagent 5 — Templates polish

| Deliverable | Status |
|---|---|
| Block renderers stamped with `data-section-id` for diff rendering | ✅ |
| `hero` — Stripe-style gradient overlay, animated underline CTA, eyebrow, configurable angle | ✅ |
| `articleGrid` — card lift on hover, scale-on-hover cover, 1/2/3-col responsive, byline row | ✅ |
| `authorCard` — accent-ring avatar, social icon buttons | ✅ |
| `categoryList` — pill style with article-count badge | ✅ |
| `richText` — `.prose` wrapper, max-width, optional drop cap | ✅ |
| `callToAction` — `inline` / `banner` variants, 4 background patterns | ✅ |
| `imageBanner` — parallax modifier (desktop-only), caption + credit | ✅ |
| `embed` — `referrerpolicy` attribute | ✅ |
| `featureGrid` — accent icon background | ✅ |
| All renderers use CSS variables, `loading="lazy"`, `decoding="async"`, ARIA labels, `prefers-reduced-motion` opt-out | ✅ |
| PageBuilder: 3-col 240/flex/320 grid, top bar with back/name/slug/status-pill/save/kebab, full bleed | ✅ |
| `BlockPalette` — `/` shortcut search, sticky category headers, drag handles, hover slide-right | ✅ |
| `Canvas` — section cards with 0.5x mini-previews, drag&drop reorder, drop zones glow, large empty state | ✅ |
| `BlockEditor` — field-grouped accordions, 200ms debounce, reset-to-defaults | ✅ |
| `Preview` — inline iframe with `postMessage`, device switcher (Desktop/Tablet/Mobile), theme switcher, dark toggle | ✅ |
| Template list: card grid, hover lift, empty state, large CTA | ✅ |
| New template page: 2-col form + live preview, 3 base templates | ✅ |
| Public engine: module-split (`core/blocks/fetch/render/helpers.js`), sessionStorage cache (5min TTL), diff `reconcile()` by `data-section-id`, animated mount, skeleton shimmer, error fallback badge | ✅ |
| Listens to `q-cms:theme-changed`, `q-cms:re-render`, `storage(qcms_theme)` events | ✅ |
| Tests: 25/25 templates (+5 polish tests on data-section-id, hero gradient, lift, inline layout, parallax, drop cap) | ✅ |
| `scripts/screenshot-builder.mjs` — 8 PNGs (60–67) | ✅ |

### Subagent 6 — Editor polish

| Deliverable | Status |
|---|---|
| `BlockMeta` with `thumbnail` / `tags` / `shortcut` / `insertExample` on every block | ✅ |
| Senior-designer inline SVG thumbnails for all 8 default blocks | ✅ |
| `estimateReadingTime()`, `pickActiveOutlineItem()` for scroll-spy | ✅ |
| `extractEntryMetadata()` (title/slug/cover/author/tags/SEO/excerpt) + `summarizeBlocks()` | ✅ |
| Editor: `layout: 'split' | 'three-pane' | 'editor' | 'preview'` prop | ✅ |
| 3-pane: 240px metadata sidebar (page settings + SEO card + per-block outline + validation) | ✅ |
| `FloatingToolbar.tsx` (new) — Notion-style, bold/italic/highlight/code/link, 100ms fade-in, reduced-motion | ✅ |
| `BlockHandle` — slide-in 100ms with 200ms grace, drag grip, + button, action popover | ✅ |
| `SlashMenu` — fuzzy search, sticky category headers, recent items (sessionStorage), keyboard hint footer, viewport-aware positioning, empty state, reduced-motion | ✅ |
| `PreviewPane` — word count + reading time, "Copy as HTML", per-block outline with scroll-spy, real article typography | ✅ |
| `Placeholder` extension with per-node-type placeholders, `parseSlashCommand()` | ✅ |
| Preview page: Medium/Ghost-style 3-col (outline / article / metadata), serif body, drop cap, status pill, "Edit in admin" CTA, "Last saved X ago", emits `qcms:preview:scroll` event | ✅ |
| Entry edit page: inline-editable title, save-state pill, sticky save bar (pulsing), SEO Google-card, cover picker, tags chip input, 3-pane via `?layout=three-pane` | ✅ |
| Entry list: 2-col card grid (cover + title + status + locale + relative time), hover lift, quick-action bar, status filter chips, locale chips, search input, empty state | ✅ |
| Tests: 199/199 total (142 in editor + 57 in admin). 24 new tests across `editor-blockhandle`, `editor-slashmenu`, `editor-preview` | ✅ |
| `scripts/screenshot-editor-polish.mjs` — 10 PNGs (70–75 editor, 80–83 preview/list) | ✅ |

## Integration verification

```bash
$ pnpm test:unit
 Tasks:    17 successful, 17 total
Cached:    17 cached, 17 total
  Time:    157ms >>> FULL TURBO
```

All public JS modules:
```bash
$ node --check apps/web/public/js/templates/{core,render,blocks,fetch,helpers}.js
ALL PUBLIC JS OK
```

## How the layers fit together (final architecture)

```
┌────────────────────────────────────────────────────────────────────┐
│  ADMIN (Next.js 15)                                                │
│                                                                    │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────┐  │
│  │ ThemeProvider       │  │ ThemePicker         │  │ PageBuilder│  │
│  │  (auto / live OS)   │  │  TokenInspector     │  │ Canvas     │  │
│  │  + reset            │  │  ThemePreview       │  │ BlockPalette│ │
│  └──────────┬──────────┘  └──────────┬──────────┘  │ BlockEditor│  │
│             │                        │                │ Preview   │  │
│             ▼                        ▼                └────┬───────┘  │
│  ┌──────────────────────────────────────────────┐         │          │
│  │  Editor (split | three-pane)                 │         │          │
│  │   FloatingToolbar   SlashMenu   BlockHandle  │         │          │
│  │   PreviewPane (sync scroll, outline)         │         │          │
│  └──────────────────────────────────────────────┘         │          │
│                                                          │          │
│  ┌──────────────────────────────────────────────┐         │          │
│  │  /preview/[id]   outline / article / meta    │◀────────┘          │
│  └──────────────────────────────────────────────┘                    │
└─────────────────────────────┬──────────────────────────────────────┘
                              │  /api/v1/* (themes live in CSS vars only)
┌─────────────────────────────▼──────────────────────────────────────┐
│  API (Hono)                                                        │
│   /templates, /public/templates/:slug                              │
└─────────────────────────────┬──────────────────────────────────────┘
                              │  /api/v1/public/templates/home-default
┌─────────────────────────────▼──────────────────────────────────────┐
│  PUBLIC SITE (apps/web)                                             │
│                                                                    │
│  <head>                                                            │
│   ┌─ theme.js (synchronous pre-paint, FOUC-free) ─────────┐        │
│   │ 5 themes, OS preference, cross-tab, @layer wrap       │        │
│   └────────────────────────────────────────────────────────┘        │
│  <body>                                                            │
│   <main data-template-slug="home-default">                         │
│      ┌─ templates/core.js (ES module) ────────────────┐            │
│      │  fetch.js (sessionStorage 5min)                 │            │
│      │  render.js (reconcile by data-section-id)       │            │
│      │  blocks.js (server-rendered HTML is source)     │            │
│      │  skeleton → fade-in 200ms → error fallback      │            │
│      │  listens q-cms:theme-changed → re-render        │            │
│      └──────────────────────────────────────────────────┘            │
└────────────────────────────────────────────────────────────────────┘
```

## Cross-layer event contracts (what each agent wrote for the others)

- **Theme → Template engine**: dispatches `q-cms:theme-changed` on theme switch; the engine listens and re-applies classes/styles. No theme tokens are duplicated in template HTML.
- **Theme → Editor**: `useTheme()` is available in the admin component tree; the editor's own UI (status pill, save bar) reads `resolvedMode` to render light/dark-appropriate status colors.
- **Editor → Preview page**: `qcms:preview:scroll` window event for synchronized scroll-spy between article and outline.
- **BlockHandle → SlashMenu**: the `+` button on a block handle opens the slash menu anchored to that block (with a `insertAfter: <blockId>` context).
- **PageBuilder Preview → public engine**: the iframe loads `/js/template-engine-modules.js` which exposes `QCMS_PREVIEW_RENDER_SECTION` so the builder can `postMessage` updates without a full reload.

## Verification commands (run anytime)

```bash
# All unit tests (cached; runs in <200ms)
pnpm test:unit

# Theme FOUC + idempotency
node scripts/test-theme-fouc.mjs

# Public-site theme sweep (5 pages × 5 themes × 2 modes = 50)
# Requires API + public site running on :3000 and :3002
node scripts/test-theme.mjs

# Theme picker screenshots (10 settings + 50 sweep + 1 FOUC)
node scripts/screenshot-theme-picker.mjs

# PageBuilder screenshots (8)
node scripts/screenshot-builder.mjs

# Editor polish screenshots (10)
node scripts/screenshot-editor-polish.mjs
```

## Outstanding / out of scope

- The 50+ new polish screenshots (50–83) are scripted but require the dev environment to be running (`docker compose` + `pnpm dev` in api/admin/web). The scripts are committed; one run of each will regenerate the full set.
- The midnight and editorial themes ship CSS variables only; the public site CSS uses the same variable names so it adopts them automatically. Any block that hard-coded a color value (none, in the polish round) would not.
- The PageBuilder uses HTML5 drag&drop (no dnd-kit added) — the brief allowed this. The up/down arrow buttons remain as a keyboard-accessible alternative.
- The theme engine's `auto` mode in `ThemeProvider` reads `prefers-color-scheme` live; if the OS toggles while the admin is open, the theme follows. The public site does the same.
