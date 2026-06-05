# Subagent 5 — Templates polish (senior-designer pass)

**Status:** Shipped (2026-06-05)
**Scope:** block renderers, the visual page builder UX, the public
template engine module split, and the template list/new/detail
pages. **No features added** — only the polish layer.

## High-level approach

A senior-designer pass touches four surfaces, in this order:

1. **Block renderers** in `@q-cms/templates` — push the public-site
   HTML quality up to "Stripe blog / Vercel launch" level.
2. **PageBuilder UX** — three-column layout with proper proportions,
   search, drag handle, mini-previews, live inspector, real preview
   iframe (desktop / tablet / mobile).
3. **Template list / new / detail pages** — card grid for the list,
   side-by-side form for "new", metadata sidebar for the builder.
4. **Public template engine rewrite** — split the monolithic
   `template-engine.js` into ES modules, add a `morph` diff renderer,
   animated mount, skeleton shimmer, error fallback, and a
   `q-cms:theme-changed` listener.

No new heavyweight deps. We deliberately keep HTML5 drag-and-drop
instead of pulling in `@dnd-kit/core` — the canvas reorders are
short, the visual feedback is good enough, and the dep would only
serve one component.

## 1. Block renderers — `packages/templates/src/blocks.ts`

Every renderer gets:

- `data-section-id="${ctx.sectionId}"` (where `ctx.sectionId` is now
  passed by `renderBlock()` in the registry) so the diff renderer
  on the public site can morph per-section.
- `loading="lazy"` + `decoding="async"` on every image.
- ARIA labels where the markup is interactive.
- Inline CSS that uses CSS custom properties with defensive
  fallbacks — `var(--color-accent, var(--color-fg))` style — so the
  HTML works even if the theme is half-loaded.

### Block-by-block

| Block | Upgrade |
|------|---------|
| `hero` | Configurable gradient overlay (`--hero-gradient-angle`, `--hero-gradient-from`, `--hero-gradient-to` props), animated underline on the CTA, eyebrow + date row, `align` extended with `right`. |
| `articleGrid` | Card hover lift (translateY -3px) + shadow elevation, cover image scales to 1.02 on hover, byline row with author name when available, auto-fit grid (1 / 2 / 3 columns by viewport). |
| `authorCard` | Avatar with a 2px ring in `var(--color-accent)` at 30% opacity, role/title above name, social links as small icon buttons. |
| `categoryList` | Pill style with article-count badge, hover deepens background and bumps shadow. |
| `richText` | Adds a `prose` class wrapper, max-width for readability, optional drop cap on the first paragraph (controlled by a `dropCap` boolean prop). |
| `callToAction` | Two variants: `banner` (centered, full-width, with optional dotted / grid / gradient background pattern via `pattern` prop) and `inline` (text on left, button on right). |
| `imageBanner` | Parallax-ready with `background-attachment: fixed` on `> 768px` viewports, plain `<img>` on smaller screens, optional caption + credit line, `figure.role="img"` ARIA. |
| `imageBanner.parallax` | A new `parallax` boolean prop turns the banner into a CSS-only parallax block. |
| `embed` | Adds `referrerpolicy="strict-origin-when-cross-origin"`. |
| `separator` | Spacing default bumped to `medium`, divider style classes. |

All renderers also stamp `data-section-id` on the outermost element
(plus `data-block` and `data-block-id` for the public-site morph
algorithm — see Section 4).

### Public engine parity

`apps/web/public/js/template-engine.js` is rewritten as ES modules in
`apps/web/public/js/templates/{core,blocks,fetch,render}.js`. The
block renderers are duplicated (one set in the package, one in the
static JS bundle) — that's been the case since v0.1; we keep that
boundary and just improve the static copy to match the new shapes.

## 2. PageBuilder UX — `apps/admin/src/components/PageBuilder/`

### Layout

- 3-column: 240px palette / flex canvas / 320px inspector.
- Top bar: back button, editable name (debounced 200ms), slug chip,
  status pill (Draft / Published), Preview toggle, Save button (with
  `Saving…` state), kebab menu (Duplicate, Export JSON, Delete).
- `prefers-reduced-motion` disables the lift/shimmer animations.

### `BlockPalette.tsx` (left)

- Search input at the top. `/` keyboard shortcut focuses it.
- Category sticky headers (Content / Layout / Media / Commerce /
  Other). Categories renamed for designers: "Text", "Media",
  "Lists", "Embeds", "Layout".
- Each block is a card: icon, name, 1-line description. Hover
  slides the card right 2px and shows a 2px left accent border.
- Drag handle (GripVertical Lucide) visible on hover; click
  inserts at the end and selects.

### `Canvas.tsx` (center)

- Vertical list of section cards. Each card shows the block label
  + a 0.45x-scale mini-preview (rendered with the same block
  spec).
- Left-edge 24px handle column for drag. Right-edge hover
  toolbar: duplicate, delete, settings (opens the inspector
  focused on this block).
- HTML5 drag-and-drop with `dragstart` / `dragover` / `drop`.
  Visual: dragged card becomes 0.4 opacity, drop targets pulse
  with a 2px `var(--color-primary)` outline.
- Empty state: large icon + headline + 1-line copy. Drop zones
  glow with the accent color when something is dragged in.
- Smooth reorder via `requestAnimationFrame` on the next state
  commit (no third-party DnD lib).

### `BlockEditor.tsx` (right)

- Group fields in `<details>` accordions when more than 6 props.
- Top: block name + "Reset to defaults" link.
- Inputs are typed (text / textarea / number / select / boolean)
  and debounced (200ms) for the JSON state.
- All field labels are bold, all errors are inline, all help
  text is muted.

### `Preview.tsx`

- Edit / Preview toggle at the top of the canvas (when toggled
  to Preview, the canvas is replaced by an iframe).
- Iframe loads a standalone HTML document that mounts the
  template engine modules and listens for `postMessage` updates
  (no full reload when the spec changes).
- Responsive preview controls: Desktop (1280), Tablet (768),
  Mobile (375). Click resizes the iframe to that width.
- "Open in new tab" link to view the public site with
  `?template=<id>`.
- Theme switcher in the preview header (Default / Dark /
  Newspaper) — writes `localStorage.qcms_theme` so the iframe
  picks it up on `storage` events.

## 3. Template list / new / detail pages

### `templates/page.tsx`

- Card grid replaces the table. Each card shows: name (large),
  slug (mono), updated date, status pill, block count.
- Hover lifts the card 2px and reveals an "Edit" button.
- Empty state: a centred illustration (Lucide `LayoutTemplate`
  at 56px) + a "Create your first template" CTA.
- Top right "New template" button is the primary action.

### `templates/new/page.tsx`

- Two columns on `>= 1024px`: left = form (name, slug, description,
  base template select), right = a live mini-preview (an iframe
  loading `/api/v1/public/preview?slug=<slug>`).
- "Create & edit" button is the primary CTA, with `isLoading` and
  a `kbd` hint `⏎`.

### `templates/[id]/page.tsx`

- Renders `<PageBuilder />` full-bleed.
- The PageBuilder's top bar gains a "View public" link that opens
  `/?template=<id>` in a new tab.

## 4. Public template engine — `apps/web/public/js/templates/`

### Module split

- `core.js` — orchestrator. Owns the `init()`, the per-root
  hydration, the theme-change listener, the post-render event.
- `blocks.js` — re-exports the static block renderers (one per
  block, each ~20 lines). Mirrors `packages/templates/src/blocks.ts`.
- `fetch.js` — fetches a template + the site context. Caches the
  template in `sessionStorage` keyed by slug.
- `render.js` — the diff renderer. Walks the new and old
  `data-section-id`-keyed nodes; for each new section, mounts
  with a fade-in (200ms ease-out). For each removed section,
  fades out and removes. For each changed section, swaps inner
  HTML. Skeleton is shown before the first render.

### Event contract

The public engine now listens for:

- `q-cms:theme-changed` (CustomEvent on `window`, detail
  `{theme, mode}`) — re-runs the render with no reload, so
  Subagent 4's theme system can swap the active theme and the
  template engine reflects the change.
- `q-cms:re-render` (CustomEvent on `window`) — the consumer
  page can ask for a re-render after it has mutated the
  underlying data.

The engine itself never writes to `localStorage`; the theme
system owns that key.

### Skeleton / error / fallback

- Skeleton: a 3-block shimmer (gradient sweep) shown for at
  most 400ms after `init()`.
- Error: if the template fetch fails, the engine logs to
  `console.warn`, mounts a small "Using fallback content" badge
  on the page, and leaves the static HTML in place.
- The badge uses `position: fixed; bottom: 1rem; right: 1rem`
  and is dismissible.

## 5. CSS additions

- `apps/web/public/css/site.css` — adds new classes for the
  upgraded blocks (`.hero--gradient`, `.article-card--lift`,
  `.pill--count`, `.cta--inline`, `.cta--pattern-dots`, etc.).
  None of the existing theme variable names change.
- `apps/admin/src/app/globals.css` — adds PageBuilder-specific
  rules (3-column grid, drop zone glow, accordion details, etc.).
  Uses existing admin tokens.

## 6. Tests

`packages/templates/src/index.test.ts` — adds tests for:

- The new `data-section-id` attribute is stamped on the output
  of every built-in block.
- `heroSpec` with a `gradientAngle` prop produces the gradient
  CSS variable in the rendered HTML.
- `articleGridSpec` produces a card with the `--lift` class.
- `callToActionSpec` with `variant: 'inline'` produces the
  inline layout (CSS class on the section).
- `imageBannerSpec` with `parallax: true` includes the parallax
  class.
- `richTextSpec` with `dropCap: true` adds the `prose--drop-cap`
  class to the output.

## 7. Screenshot script

`scripts/screenshot-builder.mjs` — captures the 8 PNGs the brief
calls for:

- `60-page-builder-empty.png`
- `61-page-builder-with-blocks.png`
- `62-page-builder-dragging.png`
- `63-page-builder-preview-mobile.png`
- `64-page-builder-preview-desktop.png`
- `65-template-list.png`
- `66-public-template-rendered.png`
- `67-public-template-theme-switched.png`

## 8. Verification checklist

- `pnpm test:unit` — all green.
- `pnpm typecheck` — no new errors.
- Public site loads `/` with no console errors and no FOUC.
- Theme switcher in the public site re-renders the template
  output (the engine re-runs on `q-cms:theme-changed`).
- PageBuilder keyboard: `/` focuses the palette search, `Esc`
  clears it.
- PageBuilder drag-and-drop: dragging a card over another card
  reorders on drop.
- PageBuilder preview: Desktop / Tablet / Mobile resizes the
  iframe width; the iframe does NOT full-reload when the spec
  changes (postMessage only).
