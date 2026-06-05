# ADR-0005: TipTap as the editor engine

**Status:** Accepted (2026-06-05)
**Deciders:** Eng Lead, Design Lead
**Context:** Pick a rich text editor library for the admin UI.

## Decision

We use **TipTap 2.x** (built on ProseMirror) as the block-based editor engine.

## Context

Requirements:
- Block-based editing (paragraph, heading, image, code, embed, etc.)
- Slash commands
- Markdown-like input
- Custom blocks (developer API)
- Realtime collaboration (multi-user editing)
- Headless (UI is our own)
- TypeScript support
- Long-term maintenance

## Options Considered

### Option A: TipTap (chosen)
- ✅ ProseMirror underneath — battle-tested (Atlassian, NYT, GitHub use it)
- ✅ Headless, fully customizable UI
- ✅ First-class collaboration via Y.js
- ✅ Excellent extension API
- ✅ TypeScript-native
- ✅ Active development, strong community

### Option B: Lexical (Meta)
- ✅ Modern, fast
- ✅ Excellent architecture
- ❌ Smaller ecosystem
- ❌ Less mature collab story
- ❌ Some breaking changes between minor versions

### Option C: Slate
- ✅ Very flexible
- ❌ "Unsupported" since 2020
- ❌ Heavy maintenance burden

### Option D: Quill
- ❌ Legacy architecture
- ❌ No first-class collaboration
- ❌ Limited extensibility

### Option E: Editor.js
- ✅ Block-first by design
- ❌ Not a true WYSIWYG
- ❌ Limited text formatting

## Decision

**TipTap** for the editor. Y.js + Hocuspocus for collab. Backup plan: Lexical is the closest alternative if TipTap ever dies.

## Consequences

- `packages/editor` exports a configured TipTap editor with all custom blocks.
- Admin UI imports it and provides the surrounding UI (toolbar, slash menu).
- Document state stored as ProseMirror JSON in `entries.data.content`.
- Realtime via Y.js CRDTs; Hocuspocus server is a separate process (`apps/collab`).
- We pin TipTap version and review changes carefully before bumping.
