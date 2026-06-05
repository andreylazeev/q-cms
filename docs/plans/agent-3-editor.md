# Agent 3 — Editor & live preview

This document describes the new public API of `@q-cms/editor` shipped
by Subagent 3 (block editor + live preview) and what other agents
(Subagent 2 — page templates) can call to render block previews.

## New package surface

The package's public entry point is still `packages/editor/src/index.ts`.
The new exports are summarized below.

### Block registry

`BlockConfig` now accepts three additional optional fields:

| Field           | Purpose                                                                  |
|-----------------|--------------------------------------------------------------------------|
| `category`      | `'Text' \| 'Media' \| 'Lists' \| 'Embeds' \| 'Advanced'` (default `Advanced`) |
| `reactComponent`| A React component for inline UI rendering of a block                     |
| `validate`      | `(attrs) => string \| null` — return an error message or `null` if valid |

Plus the existing `render`, `schema`, and the standard `name` / `label` /
`icon` metadata. `registerBlock(config)` is unchanged at the call site —
existing registrations continue to work because the new fields are
optional.

Two new helpers are exported:

- `registerBuiltinBlocks()` — idempotently registers the built-in
  block set. Call once at app boot.
- `useBlockLibrary()` — returns `{ blocks, groups, byName }` for the
  slash menu / block picker. `groups` is ordered by `BLOCK_CATEGORY_ORDER`.

### Renderers

The renderer API now exposes three functions:

- `renderToHTML(json)` — unchanged. Returns an HTML string. Handles the
  full set of Q-CMS block types plus default StarterKit nodes.
- `renderToJSON(json)` — new. Returns a normalized ProseMirror-compatible
  JSON tree with stable `attrs.id` strings on every block-level node
  (root `doc` excluded). Returns `null` for nullish input.
- `renderPreview(json, opts?)` — new. The single entry point powering
  the in-admin split preview pane, the standalone `/preview/[id]`
  page, and any public web site rendering. Returns:

  ```ts
  interface RenderPreviewResult {
    html: string;                          // sanitized HTML
    outline: readonly OutlineItem[];       // h2/h3 by default
    wordCount: number;                     // spaces between blocks
    excerpt: string;                       // first ~200 chars
  }
  ```

  Options:

  - `sanitize` (default `true`) — strip `<script>` and `on*=` attrs
  - `outlineDepth` (default `3`) — max heading level to include
  - `outlineMinLevel` (default `2`) — skip h1 by default
  - `includeSectionEntries` (default `false`) — reserved

`OutlineItem` is `{ level, text, nodeId }` and the `nodeId` is also
injected as the `id="..."` attribute on the matching heading in the
returned HTML, so templates can deep-link into the outline.

`escapeHTMLText(value)` and `sanitizeHtml(html)` are also re-exported
for callers that need them.

### Validation

`validateDocument(json)` walks the document and runs every block's
`validate` function (when registered). It returns
`BlockValidationIssue[]` where each entry is
`{ blockName, message, nodeId? }`. The `nodeId` is filled in when the
offending block has a string `attrs.id`.

## Contract for the templates package (Subagent 2)

Subagent 2's page template engine should consume the editor package
through the following surface:

```ts
import {
  renderToJSON,
  renderToHTML,
  renderPreview,
  useBlockLibrary,
  type BlockConfig,
  type BlockDescriptor,
  type BlockLibrary,
  type RenderPreviewResult,
  type OutlineItem,
} from '@q-cms/editor';
```

Recommended usage:

- **Block previews** — for each block type the template engine wants
  to render in its template-builder UI, call `useBlockLibrary()` to
  get the descriptor and feed `block.name` + `block.label` +
  `block.category` into the picker.
- **Inline rendering** — call `renderToJSON(entry.data.content)` to
  get a normalized, ids-included tree the template engine can walk
  safely. Templates can index into `node.attrs` knowing `id` is always
  present on every block.
- **HTML fallback** — call `renderToHTML(json)` to get the same HTML
  the public site would render. The renderer escapes untrusted text
  and produces a valid HTML5 string.
- **Live preview with TOC** — call `renderPreview(json, opts)` to get
  the HTML, outline, word count, and excerpt in one call. The outline
  is suitable for a table of contents widget.

## Built-in blocks

The built-in block list covers: `paragraph`, `heading`, `image`,
`code`, `embed`, `callout`, `divider`, `todo`, `richTextBlock`,
`imageBlock`, `embedBlock`, `codeBlock`. They are grouped as:

- **Text** — paragraph, heading, callout
- **Media** — image, divider
- **Lists** — todo, code
- **Embeds** — embed
- **Advanced** — richTextBlock, imageBlock, embedBlock, codeBlock

## Admin integration

The admin editor (`apps/admin/src/components/Editor/index.tsx`) now:

- Uses `useBlockLibrary()` to populate the slash menu, grouped by
  category with sticky category headers.
- Renders a `BlockHandle` on the left of each top-level block with
  duplicate / delete / move-up / move-down actions.
- Renders a `PreviewPane` next to the editor by default; pass
  `splitPreview={false}` to opt out.
- Accepts a `previewHref` prop and renders a "Preview" link in the
  toolbar that opens the standalone preview page in a new tab.

The standalone preview lives at
`apps/admin/src/app/(dashboard)/preview/[id]/page.tsx` and is
collection-agnostic — it walks the candidate collections to resolve
the entry, then renders the body with the same block shape as the
in-admin preview (and will use `renderPreview` once the real
TipTap-backed editor is wired in).

## Screenshots to capture

After running the dev server, capture:

- `screenshots/40-editor-with-preview.png` — the edit page with the
  split preview pane visible.
- `screenshots/41-editor-slash-menu.png` — the slash menu open and
  grouped by category.
- `screenshots/42-preview-page.png` — the standalone preview page
  with the outline / metadata sidebars visible.
