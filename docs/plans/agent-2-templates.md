# Subagent 2 — Page templates & visual page builder

**Status:** Delivered (2026-06-05)
**Scope:** `@q-cms/templates` package, admin Templates section with
visual PageBuilder, public-site template engine, API routes for
template CRUD + a public read-only endpoint.

## What I built

### 1. `packages/templates/`

A framework-agnostic, browser-and-server safe package. The persisted
shape is a `TemplateSpec` (versioned, slug-keyed, locale-bound) that
holds an ordered list of `TemplateSection`s. Each section references a
registered `BlockSpec` and a free-form `props` bag.

| File | Purpose |
|------|---------|
| `src/types.ts` | `TemplateSpec`, `TemplateSection`, `BlockSpec`, `RenderContext` |
| `src/registry.ts` | `registerBlockSpec`, `getBlockSpec`, `listBlockSpecs`, `clearBlockSpecs`, `renderBlock` |
| `src/blocks.ts` | 12 built-in block specs (hero, articleGrid, articleList, authorCard, authorBio, categoryList, richText, callToAction, imageBanner, featureGrid, separator, embed), each with a `render(props, ctx) → string` that produces the HTML for the public site. Also ships a tiny Markdown renderer used by `richText`. |
| `src/serialize.ts` | Zod-backed `templateSpecSchema`, `deserializeTemplate` / `safeDeserializeTemplate`, `serializeTemplate`, `createEmptyTemplate`, `touchTemplate` |
| `src/index.ts` | Re-exports + `BUILTIN_BLOCK_TYPES` |
| `src/index.test.ts` | 19 unit tests (registry, render, roundtrip, validation, defaults, touch) |

`pnpm --filter @q-cms/templates test` → 19/19 pass.

### 2. API: `apps/api/src/routes/templates.ts`

Protected CRUD endpoints mounted under the `protectedApp`:

| Method | Path | Notes |
|--------|------|-------|
| GET    | `/api/v1/templates` | Lists all templates (summary view) |
| GET    | `/api/v1/templates/:id` | Returns the full spec |
| POST   | `/api/v1/templates` | Creates a template. Returns 409 on duplicate slug. |
| PATCH  | `/api/v1/templates/:id` | Partial update; 409 on slug collision |
| DELETE | `/api/v1/templates/:id` | 204 on success |

`apps/api/src/routes/public-templates.ts` mounts **publicly** at
`/api/v1/public/templates/:slug`. No auth, returns 404 when the
slug is missing. This is what the static-site template engine calls.

`apps/api/src/lib/stubs/db.ts` — added a `templateRepo` and seeds
`home-default` + `article-default` on first boot. `home-default` ships
with hero + featureGrid + articleGrid + categoryList + callToAction;
`article-default` ships with richText + authorBio + articleGrid.

`pnpm --filter @q-cms/api test:unit` → 44/44 pass (added 10 new
tests in `test/routes/templates.test.ts`).

### 3. Admin: `apps/admin/src/app/(dashboard)/templates/`

| Path | File | Purpose |
|------|------|---------|
| `/templates` | `page.tsx` | List view with table (name, slug, locale, sections, updated, delete), "New template" CTA, links to the builder. |
| `/templates/new` | `new/page.tsx` | Create form: name, slug (auto-derived from name), description. Redirects to the builder on success. |
| `/templates/[id]` | `[id]/page.tsx` | Wraps `<PageBuilder />`. |

`Sidebar.tsx` got a new `Templates` nav item (Lucide `LayoutTemplate`
icon) between Collections and Media.

### 4. Visual page builder: `apps/admin/src/components/PageBuilder/`

A three-column React layout. No drag-and-drop library — Up / Down /
Add / Remove buttons (the spec called for plain React state).

| File | Role |
|------|------|
| `index.tsx` | Top bar (name input, slug chip, save state, Preview button, Save button) + the 3-column body. Local state only; persists via the API client on Save. |
| `BlockPalette.tsx` | Left sidebar. Lists every `listBlockSpecs()` entry, grouped by `spec.category` (content / layout / media / commerce / other), with a Lucide icon. |
| `Canvas.tsx` | Center column. Numbered section cards, up / down / remove controls, JSON prop preview. |
| `BlockEditor.tsx` | Right sidebar. Walks `spec.propSchema.properties` and renders matching inputs (string / number / boolean / enum / array / object / long text). |
| `Preview.tsx` | Modal with an iframe that loads a tiny standalone HTML document and receives the rendered HTML via `postMessage`. Uses the same block-spec registry so what you see is what you get. |

### 5. Public runtime: `apps/web/public/js/template-engine.js`

A zero-dependency vanilla-JS module. On `DOMContentLoaded` it finds
every `<main data-template-root data-template-slug="…">` and:

1. Fetches `/api/v1/public/templates/:slug`.
2. Loads the site settings + entries once (cached on
   `window.__QCMS_SITE_CTX__`).
3. Walks the spec's `sections` and renders each via the same
   block-spec renderers as the package.
4. Replaces the children of the template root with the rendered HTML.
5. Dispatches a `q-cms:template-rendered` `CustomEvent` so per-page
   JS modules can hand off cleanly.

`data-template-skip="true"` opts a page out of rendering — used by
the per-page modules on `/articles/`, `/articles/[slug]/`,
`/authors/`, `/categories/` (they own their own rendering).

### 6. Public pages wired

All five content pages now include `<main … data-template-root
data-template-slug="home-default">` (or `article-default` for
`/articles/[slug]/`) and a `<script src="/js/template-engine.js">`
tag. The home page renders the `home-default` template; the other
four bind the slug but use `data-template-skip="true"` so the per-page
script keeps owning the body.

## Public API of `@q-cms/templates`

```ts
// Types
import type {
  TemplateSpec,
  TemplateSection,
  BlockSpec,
  BlockType,
  RenderContext,
  SectionId,
} from "@q-cms/templates";

// Registry
import {
  registerBlockSpec,
  getBlockSpec,
  listBlockSpecs,
  clearBlockSpecs,
  renderBlock,
  registerBuiltinBlocks,
  BUILTIN_BLOCK_TYPES,
} from "@q-cms/templates";

// Serialization
import {
  templateSpecSchema,
  deserializeTemplate,
  safeDeserializeTemplate,
  serializeTemplate,
  createEmptyTemplate,
  touchTemplate,
} from "@q-cms/templates";
```

`registerBuiltinBlocks()` is idempotent — call once at app boot. Both
the admin PageBuilder and the public template engine call it
independently so neither side needs a bundler.

## API contract for the page builder

- **List** — `GET /api/v1/templates` → JSON:API collection of
  `{ id, slug, name, description, locale, sectionCount, createdAt, updatedAt }`.
- **Get** — `GET /api/v1/templates/:id` → JSON:API resource with
  full `sections[]` and `meta`.
- **Create** — `POST /api/v1/templates` body
  `{ name, slug, description?, locale?, sections?, meta? }` → 201 with the new resource.
- **Update** — `PATCH /api/v1/templates/:id` body is the same shape,
  all keys optional.
- **Delete** — `DELETE /api/v1/templates/:id` → 204.
- **Public** — `GET /api/v1/public/templates/:slug` → JSON:API resource
  with `sections` and `meta`. No auth. Returns 404 when missing; the
  public site silently falls back to its static markup in that case.

## Theme integration with Subagent 1

Subagent 1 owns the CSS variables. The PageBuilder and template
engine set a `data-theme` attribute on the rendered root so the
existing `[data-mode="dark"]` selectors and theme tokens in
`apps/web/public/css/site.css` apply cleanly:

- **`Preview.tsx`** — wraps the rendered output in
  `<div class="template-root" data-theme="…">` (the theme id comes
  from `spec.meta.themeId` and falls back to `default`).
- **`template-engine.js`** — same wrapping for the public site.

The actual variable values come from Subagent 1's
`apps/web/public/js/theme.js` boot script (it sets `data-theme` /
`data-mode` on `<html>`). My code never touches the CSS variables
themselves.

## Verification

- `pnpm --filter @q-cms/templates test:unit` → 19/19 pass
- `pnpm --filter @q-cms/api test:unit` → 44/44 pass (10 new
  template tests)
- `pnpm test:unit` (root) → 16 of 17 tasks succeed. The single
  failure is the **pre-existing** `@q-cms/admin/test/hooks.test.ts`
  stub-token check; not introduced by this change.
- Manual smoke: `GET /api/v1/public/templates/home-default` returns
  the seeded spec; `GET /api/v1/templates` (with `Authorization:
  Bearer …`) returns the summary list; the public home page
  (`http://localhost:3002/`) renders the seeded `home-default`
  template.
- Screenshots added to `screenshots/`:
  - `30-template-list.png` — `/templates` index
  - `31-template-builder.png` — visual PageBuilder with the seeded home template
  - `32-template-preview.png` — preview modal showing the iframe rendering
  - `33-template-public.png` — `http://localhost:3002/` rendered by the template engine

## Files I created / changed

**Created**
- `apps/api/src/routes/templates.ts` (CRUD)
- `apps/api/src/routes/public-templates.ts` (read-only public)
- `apps/api/test/routes/templates.test.ts` (10 tests)
- `apps/admin/src/app/(dashboard)/templates/page.tsx`
- `apps/admin/src/app/(dashboard)/templates/new/page.tsx`
- `apps/admin/src/app/(dashboard)/templates/[id]/page.tsx`
- `apps/admin/src/components/PageBuilder/index.tsx`
- `apps/admin/src/components/PageBuilder/BlockPalette.tsx`
- `apps/admin/src/components/PageBuilder/Canvas.tsx`
- `apps/admin/src/components/PageBuilder/BlockEditor.tsx`
- `apps/admin/src/components/PageBuilder/Preview.tsx`
- `apps/web/public/js/template-engine.js`
- `scripts/screenshot-templates.mjs`
- `docs/plans/agent-2-templates.md` (this file)

**Modified**
- `apps/api/package.json` (+ `@q-cms/templates`)
- `apps/api/src/router.ts` (mounts both routers)
- `apps/api/src/lib/stubs/db.ts` (added `templates` map, `templateRepo`, seed)
- `apps/admin/package.json` (+ `@q-cms/templates`)
- `apps/admin/src/lib/stubs/api-client.ts` (added `templates` + `SdkTemplate` types + demo data)
- `apps/admin/src/components/Sidebar.tsx` (added Templates nav item)
- `apps/web/public/index.html` (data-template binding + script tag)
- `apps/web/public/articles/index.html` (data-template binding + script tag)
- `apps/web/public/articles/[slug]/index.html` (data-template binding + script tag)
- `apps/web/public/authors/index.html` (data-template binding + script tag)
- `apps/web/public/categories/index.html` (data-template binding + script tag)

## Out of scope (intentionally untouched)

- `packages/theme/`, `packages/ui/src/theme-provider.tsx`,
  `apps/admin/src/components/Providers.tsx`,
  `apps/web/public/css/site.css` (colors / theme variables) — Subagent 1
- `apps/admin/src/components/Editor/*`, `packages/editor/` — Subagent 3
- `apps/admin/src/components/Sidebar.tsx` items other than the new
  Templates entry — shared
- `packages/templates/src/*.ts` — extended lightly (no breaking changes
  to public exports)
