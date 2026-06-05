# Agent 6 — Editor & Preview Polish

> Subagent 6 of 4. Scope: `packages/editor/` and `apps/admin/src/components/Editor/` plus the entry list, entry editor, and standalone preview pages.

The goal is senior-designer polish. The previous agent shipped the
skeleton — split preview, slash menu, block handles — and this agent
elevates the editor and preview surfaces to a Notion / Linear / Sanity
Studio level.

---

## 1. Block library upgrade

`packages/editor/src/blocks.ts` now exports a richer `BlockDescriptor`
with optional visual metadata:

- `thumbnail` — an inline SVG string (24×24) shown in the slash menu
- `tags` — search keywords surfaced separately from the legacy
  `keywords` field
- `shortcut` — keyboard shortcut hint, e.g. `H` or `Cmd+Opt+I`
- `insertExample` — a sample `JSONContent` for the slash menu preview

`useBlockLibrary()` (in the same module) still returns the existing
shape, but each `BlockDescriptor` now carries the optional metadata
fields when set. Re-registration is supported, so consumers can
override any of the builtins.

### Built-in blocks

The 8 default blocks (paragraph, heading, callout, image, divider,
todo, code, embed) now ship with:

- An inline SVG thumbnail
- A list of search tags
- A keyboard shortcut hint
- A sample `insertExample` document

`richTextBlock`, `imageBlock`, `embedBlock`, `codeBlock` keep their
existing minimal metadata; they are advanced nodes used in the page
builder, not surfaced as primary slash-menu entries.

---

## 2. Editor overhaul

`apps/admin/src/components/Editor/index.tsx` is a complete rewrite
to give the editor a Notion-like feel.

### Layout

When the editor is in "3-pane" mode (controlled via the new
`layout` prop with the value `'three-pane' | 'editor' | 'preview' | 'split'`):

- Left: 240-px **metadata sidebar** — page settings (slug, status,
  locale, SEO, cover), the entry's per-block outline, and a
  block-validation panel.
- Center: the editor surface (toolbar, slash menu, contenteditable).
- Right: the live preview pane.

When the layout is `'split'` (the default for backward compat),
the editor and preview are side-by-side. When the layout is
`'editor'` or `'preview'` only one is shown.

The split / three-pane is responsive — the metadata sidebar is
hidden below the `lg` breakpoint.

### Floating toolbar

`FloatingToolbar.tsx` (new) shows a Notion-style floating toolbar
above the current text selection. It appears with a 100-200 ms
fade-in and supports bold, italic, code, link, and highlight.

The toolbar is rendered with `position: fixed` and tracks the
selection rect. It is keyboard-accessible (Tab cycles through the
buttons, Escape dismisses).

### Slash menu

`SlashMenu.tsx` was polished:

- **Fuzzy search** — items match against label, category, tags, and
  description. A score is computed so prefix matches outrank
  substring matches.
- **Keyboard nav** — `Up`/`Down` move the highlight, `Enter` selects,
  `Esc` closes. The cursor is kept in view via `scrollIntoView({ block: 'nearest' })`.
- **Sticky category headers** — the active category is highlighted
  when the user scrolls.
- **Empty state** — `"No blocks match 'foo'"` with a
  `Clear search` button that resets the query.
- **Recent items** — the 3 most recently used items (by name) are
  surfaced at the top, based on `sessionStorage`. The list is
  updated on every successful insert.
- **Keyboard hint in the footer** — `↑ ↓ Enter Esc`.
- **Selected item** — the active item has a 2-px left border in
  `--color-accent-foreground`, a subtle background tint, and a
  small `↵` glyph on the right.

### Block handle

`BlockHandle.tsx` is now a **slide-in** control:

- Hidden by default; slides in from the left when the parent block
  is hovered or focused.
- The 6-dot drag handle is rendered as a real grip via SVG.
- A `+` button next to the grip opens the slash menu anchored to
  that block.
- Quick actions (duplicate, delete, move up / move down) are in a
  popover that appears on click.
- A 200-ms grace period prevents flicker when moving from the block
  to the handle.

### Hover / focus states

Every block in the editor surface has:

- A 1-px **focus ring** in `--color-focus-ring` (falls back to
  `--color-ring`).
- A **subtle background tint** on hover (`--color-muted` at 50 %
  opacity), so it's discoverable without being loud.

### Reduced motion

All transitions in the editor and slash menu honour
`@media (prefers-reduced-motion: reduce)`. The hover slide-in
becomes an instant show, and the slash menu fade is disabled.

### Toolbar

`Toolbar.tsx` was slimmed:

- Icon-only buttons with proper `aria-label` and `title` (tooltips).
- Active state is rendered with a colored background
  (`--color-accent`) and a 1-px border in `--color-accent-foreground`.
- A `More` overflow drops the less-used buttons (indent, undo, redo).

### PreviewPane

`PreviewPane.tsx` now:

- Shows **word count + reading time** in the top-right header.
- Has a **Copy as HTML** button that copies the rendered HTML to the
  clipboard.
- Renders an **empty state** with a friendly icon and message
  (`Start writing to see a live preview`).
- Has a **synchronized scroll** mode (toggle in the header): when
  on, the preview pane scrolls to mirror the editor's vertical
  scroll position.
- Renders a **per-block outline** in the top-right that scrolls
  with the article and highlights the heading currently in view.
- Renders a real `article` typography scale — title, subtitle, drop
  cap on the first paragraph, generous leading, support for
  pull-quote (blockquote) styling.

### extensions

`extensions.ts` adds:

- A `Placeholder` config — empty blocks show ghost text
  (`Heading`, `Type / for blocks`, etc.).
- An `Autocomplete` helper that parses the `/` command in the
  editor and exposes a `parseSlashCommand(text)` function for
  consumers to wire into their own popover.

---

## 3. Standalone preview page

`apps/admin/src/app/(dashboard)/preview/[id]/page.tsx` is rebuilt
to feel like a Medium / Ghost preview:

- **Top bar**: large entry title, status pill, "Edit in admin" CTA,
  "Last saved X minutes ago" indicator with a "Refresh" button.
- **3-column layout**:
  - Outline (240 px) — auto-generated from H2/H3, sticky, active
    heading highlighted as the user scrolls.
  - Article (max 720 px, serif) — real typography, drop cap on the
    first paragraph (configurable), pull-quote support.
  - Metadata sidebar (240 px) — cover image preview, author byline,
    read time, locale chip, tags.
- **Article footer** — "Last updated [date]" with a small "Edit"
  link.
- **Empty state** — friendly message with a back link to the
  collection list.

### Events

The preview page dispatches a `qcms:preview:scroll` event on the
`window` whenever the active outline item changes. Subagent 5 can
subscribe to this to sync the public site preview if needed.

---

## 4. Entry editing pages

`apps/admin/src/app/(dashboard)/collections/[slug]/[id]/page.tsx`
and `.../new/page.tsx` are polished.

### Top bar

- Entry title is **inline-editable on click** — click the title
  and it becomes an input with auto-focus and a "blur to save"
  handler.
- Status badge uses the same `StatusBadge` component as the list
  (keeps the visual language consistent with Subagent 4).
- Last-saved indicator with a debounce (1 s) and a "Saved
  2 minutes ago" / "Saving…" / "Unsaved changes" state.

### 3-pane layout (fullscreen)

The page accepts a `layout` URL search param (`?layout=three-pane`)
and shows the same metadata / editor / preview layout as the
editor component.

### Save bar

A sticky bottom bar shows the current save state and a
**Save** button. The autosave indicator pulses gently while saving
(`@keyframes` 1.4 s, infinite).

### Cover image picker

A dropdown that opens a panel showing the existing media (3-col
grid) with a "Upload" placeholder. Selecting a thumbnail closes
the panel and updates the entry's `data.coverId`.

### Tags input

A chip input. Type, hit Enter, a chip appears. Backspace in an
empty input removes the last chip. The input is keyboard-only
accessible.

### SEO preview

Below the SEO fields a Google-card mock is rendered: a blue
link, a green URL, and a 2-line description, all updated live
from `seoTitle` and `seoDescription`.

---

## 5. Entry list

`apps/admin/src/app/(dashboard)/collections/[slug]/page.tsx` was
overhauled from a table to a 2-column card grid:

- Each card: cover thumbnail (or first-letter avatar), title,
  status pill, locale chip, last-updated relative time.
- Hover: the card lifts (translateY(-2px)) and reveals
  quick-action buttons (Edit / Preview / Duplicate / Delete).
- Filter chips at the top: **All / Published / Draft / Archived** and
  per-locale chips. Clicking a chip filters in real-time.
- A search input filters cards in real time (300 ms debounce).
- Empty state: "No entries yet" with a "Create your first" CTA.

The status pill and locale chip use the same `StatusBadge` /
`Chip` components the rest of the admin uses, so the visual
language stays consistent.

---

## 6. Verification

- `pnpm test:unit` passes — all existing tests still green, plus
  the new ones for SlashMenu keyboard nav, BlockHandle visibility,
  preview outline extraction, and metadata extraction.
- New Playwright script: `scripts/screenshot-editor-polish.mjs`
  capturing screenshots 70–75 (editor) and 80–83 (preview / list).

---

## 7. Metadata schema (shared with Subagent 4)

The editor surfaces a single source of truth for the entry's
**save state** (`idle | dirty | saving | saved | error`) and
**status pill** (`draft | in_review | approved | published | archived`).
Subagent 4's theme picker should reuse `StatusBadge` from
`apps/admin/src/components/StatusBadge.tsx` so the same tone
(`neutral | info | success | warning | danger`) is applied across
the admin and the picker.

The 3-pane editor's metadata sidebar uses the same data shape as
the public site's `data` payload, so Subagent 5 can read it
verbatim:

```ts
interface EditorEntryData {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;          // markdown-ish stub in dev
  coverId: string | null;
  authorId: string | null;
  tags: string[];
  seo: { title: string; description: string };
}
```

The `saveState` is communicated as a CSS class on the editor's
root container (`data-save-state="saving"`) and a custom event
`qcms:editor:save` on `window` so the public site can show a
saving indicator if it's embedded in the admin shell.
