import type { ComponentType, ReactNode } from 'react';
import type { JSONContent } from './types.ts';

/**
 * Categories used to group blocks in the slash menu and the
 * `useBlockLibrary()` hook. The order is meaningful — it is the order
 * the categories are rendered in the UI.
 */
export type BlockCategory = 'Text' | 'Media' | 'Lists' | 'Embeds' | 'Advanced';

/**
 * The built-in block type names exposed by `@q-cms/editor`.
 *
 * Consumers can register additional custom blocks via `registerBlock`
 * — the union is intentionally open via `string` for any non-builtin
 * name, but listing the builtins here lets TypeScript catch typos
 * in the slash menu / library configuration.
 */
export type BuiltinBlockName =
  | 'paragraph'
  | 'heading'
  | 'image'
  | 'code'
  | 'embed'
  | 'callout'
  | 'divider'
  | 'todo'
  | 'richTextBlock'
  | 'imageBlock'
  | 'embedBlock'
  | 'codeBlock';

/**
 * Configuration for a registered editor block.
 *
 * Blocks are registered by name and provide metadata for the
 * editor UI (label, icon, category), optional custom rendering
 * logic, an optional React component for inline UI rendering, an
 * optional validation function, and a schema definition for
 * validation and form generation.
 */
export interface BlockConfig {
  /** Unique block identifier (e.g. 'imageBlock', 'embedBlock'). */
  name: string;
  /** Human-readable label for the UI. */
  label: string;
  /** Icon identifier (e.g. lucide icon name). */
  icon: string;
  /**
   * Category used to group blocks in the slash menu and the
   * `useBlockLibrary()` hook. Defaults to `'Advanced'` when omitted.
   */
  category?: BlockCategory;
  /** Short description shown beneath the label in the slash menu. */
  description?: string;
  /** Search keywords to help users find the block. */
  keywords?: readonly string[];
  /**
   * Senior-designer metadata (optional).
   * The editor surfaces a tiny SVG thumbnail of the block in the
   * slash menu, surfaces search tags, shows a keyboard shortcut
   * hint, and renders a sample `insertExample` document so users
   * can see what the block looks like before inserting it.
   */
  meta?: BlockMeta;
  /**
   * Optional custom HTML renderer.
   * Receives the node attributes and returns an HTML string.
   * When omitted, the default renderer handles the block.
   */
  render?: (attrs: Record<string, unknown>) => string;
  /**
   * Optional React component for inline UI rendering. When provided
   * the admin editor can mount this component inside its split
   * preview / inline-edit surface for a richer authoring experience.
   *
   * The component receives the editor's `value` (the full document
   * JSON) and the block's local `attrs` plus a stable `nodeId`.
   */
  reactComponent?: ComponentType<{
    value: JSONContent | undefined;
    attrs: Record<string, unknown>;
    nodeId: string;
  }>;
  /**
   * Optional validation function. Return `null` for valid nodes or
   * a short human-readable error message for invalid ones.
   *
   * Used by the editor to flag broken block configurations and by
   * the publish pipeline to refuse publishing invalid entries.
   */
  validate?: (attrs: Record<string, unknown>) => string | null;
  /**
   * Optional JSON Schema for the block's attributes.
   * Used for validation and form generation in the admin UI.
   */
  schema?: Record<string, unknown>;
}

/**
 * Visual / search metadata for a block.
 *
 * Used by the editor's slash menu and metadata sidebar to give a
 * senior-designer-quality preview of each block: a 24×24 SVG
 * thumbnail, search tags (separate from the legacy `keywords`),
 * a keyboard shortcut hint, and a sample document to render in
 * the preview pane when the user is hovering the slash menu item.
 */
export interface BlockMeta {
  /** 24×24 inline SVG string (no XML preamble, no width/height attrs). */
  thumbnail?: string;
  /** Search tags surfaced separately from `keywords` (e.g. ['callout', 'note']). */
  tags?: readonly string[];
  /** Keyboard shortcut hint, e.g. 'H' or 'Cmd+Opt+I'. */
  shortcut?: string;
  /** A sample document that previews the block in the slash menu. */
  insertExample?: JSONContent;
}

const blockRegistry = new Map<string, BlockConfig>();

/**
 * Register a custom block definition.
 *
 * Blocks must have unique names. Re-registering a name
 * overwrites the previous registration.
 *
 * @example
 * ```ts
 * registerBlock({
 *   name: 'calloutBlock',
 *   label: 'Callout',
 *   icon: 'alert-triangle',
 *   category: 'Text',
 *   render: (attrs) => `<div class="callout">${attrs.text}</div>`,
 *   validate: (attrs) => (attrs.text ? null : 'Callout must have text'),
 * });
 * ```
 */
export function registerBlock(config: BlockConfig): void {
  blockRegistry.set(config.name, config);
}

/**
 * Retrieve a registered block by name.
 *
 * @returns The block config, or `undefined` if not found.
 */
export function getBlock(name: string): BlockConfig | undefined {
  return blockRegistry.get(name);
}

/**
 * List all registered blocks.
 *
 * @returns An array of block configs in registration order.
 */
export function listBlocks(): BlockConfig[] {
  return Array.from(blockRegistry.values());
}

/**
 * Clear all registered blocks.
 * Primarily used for testing.
 */
export function clearBlocks(): void {
  blockRegistry.clear();
}

/**
 * Lightweight descriptor returned by `useBlockLibrary()` and used by
 * the slash menu. Contains only the fields needed to render a block
 * picker entry — the heavy React component reference is kept on the
 * underlying `BlockConfig` for callers that need it.
 */
export interface BlockDescriptor {
  name: string;
  label: string;
  icon: string;
  category: BlockCategory;
  description?: string;
  keywords?: readonly string[];
  /** Search tags (kept separate from keywords for richer search). */
  tags?: readonly string[];
  /** Keyboard shortcut hint. */
  shortcut?: string;
  /** Inline SVG thumbnail (24×24). */
  thumbnail?: string;
  /** Sample document the slash menu can render as a preview. */
  insertExample?: JSONContent;
  hasReactComponent: boolean;
}

/**
 * Grouped block list returned by `useBlockLibrary()`.
 *
 * The grouping follows the natural slash-menu order (Text, Media,
 * Lists, Embeds, Advanced) and only includes categories that have
 * at least one block. Each entry carries the descriptor for the
 * block, ready to be rendered in a menu.
 */
export interface BlockLibrary {
  /** All blocks, in the order they should be presented within a category. */
  blocks: readonly BlockDescriptor[];
  /** Blocks grouped by category, in the canonical category order. */
  groups: ReadonlyArray<{
    category: BlockCategory;
    blocks: readonly BlockDescriptor[];
  }>;
  /** Quick lookup by name. */
  byName: (name: string) => BlockDescriptor | undefined;
}

/** The canonical order of block categories. */
export const BLOCK_CATEGORY_ORDER: readonly BlockCategory[] = [
  'Text',
  'Media',
  'Lists',
  'Embeds',
  'Advanced',
] as const;

function toDescriptor(config: BlockConfig): BlockDescriptor {
  const out: BlockDescriptor = {
    name: config.name,
    label: config.label,
    icon: config.icon,
    category: config.category ?? 'Advanced',
    hasReactComponent: Boolean(config.reactComponent),
  };
  if (config.description !== undefined) out.description = config.description;
  if (config.keywords !== undefined) out.keywords = config.keywords;
  if (config.meta?.thumbnail !== undefined) out.thumbnail = config.meta.thumbnail;
  if (config.meta?.tags !== undefined) out.tags = config.meta.tags;
  if (config.meta?.shortcut !== undefined) out.shortcut = config.meta.shortcut;
  if (config.meta?.insertExample !== undefined) out.insertExample = config.meta.insertExample;
  return out;
}

/**
 * Returns the registered blocks grouped by category. The function is
 * pure and does not depend on React; the hook prefix follows the
 * convention used in the rest of the codebase so React callers can
 * `useBlockLibrary()` directly.
 *
 * The returned object is stable for a given registry state — use
 * the descriptor `name` as a React key when iterating.
 *
 * @example
 * ```ts
 * function SlashMenu() {
 *   const library = useBlockLibrary();
 *   return (
 *     <>
 *       {library.groups.map(g => (
 *         <section key={g.category}>
 *           <h3>{g.category}</h3>
 *           {g.blocks.map(b) => <Block key={b.name} descriptor={b} />)}
 *         </section>
 *       ))}
 *     </>
 *   );
 * }
 * ```
 */
export function useBlockLibrary(): BlockLibrary {
  const blocks = listBlocks().map(toDescriptor);
  const byName = new Map<string, BlockDescriptor>(blocks.map((b) => [b.name, b]));

  const groups = BLOCK_CATEGORY_ORDER.map((category) => ({
    category,
    blocks: blocks.filter((b) => b.category === category),
  })).filter((g) => g.blocks.length > 0);

  return {
    blocks,
    groups,
    byName: (name: string) => byName.get(name),
  };
}

/**
 * Validate every block in a document against its registered
 * `validate` function. Returns a list of `{ nodeId?, name, message }`
 * entries. The `nodeId` is filled in when the offending block is a
 * top-level block with a string `attrs.id` — that mirrors the data
 * we render in the admin block handle.
 */
export interface BlockValidationIssue {
  blockName: string;
  message: string;
  nodeId?: string;
}

export function validateDocument(json: JSONContent | undefined | null): BlockValidationIssue[] {
  const issues: BlockValidationIssue[] = [];
  if (!json || !json.content) return issues;
  for (const node of json.content) {
    const config = blockRegistry.get(node.type ?? '');
    if (!config?.validate) continue;
    const message = config.validate(node.attrs ?? {});
    if (message) {
      const nodeId = typeof node.attrs?.['id'] === 'string' ? (node.attrs['id'] as string) : undefined;
      issues.push({
        blockName: config.name,
        message,
        ...(nodeId !== undefined ? { nodeId } : {}),
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Built-in block definitions
// ---------------------------------------------------------------------------

/**
 * Tiny inline SVG thumbnails used in the slash menu and the
 * block-handle. They are 24×24 viewBox strings without XML preamble
 * so they can be inlined straight into the JSX.
 */
const THUMB = {
  paragraph:
    '<rect x="3" y="6" width="18" height="2" rx="1" fill="currentColor"/>' +
    '<rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor"/>' +
    '<rect x="3" y="16" width="12" height="2" rx="1" fill="currentColor"/>',
  heading:
    '<rect x="3" y="4" width="3" height="16" rx="1" fill="currentColor"/>' +
    '<rect x="3" y="4" width="14" height="3" rx="1" fill="currentColor"/>' +
    '<rect x="3" y="10.5" width="11" height="3" rx="1" fill="currentColor"/>' +
    '<rect x="3" y="17" width="8" height="3" rx="1" fill="currentColor"/>',
  callout:
    '<path d="M12 3 L21 8 L21 17 L12 22 L3 17 L3 8 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<rect x="8" y="11" width="8" height="1.5" rx="0.75" fill="currentColor"/>' +
    '<rect x="8" y="14" width="6" height="1.5" rx="0.75" fill="currentColor"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<circle cx="9" cy="10" r="1.5" fill="currentColor"/>' +
    '<path d="M3 17 L9 12 L14 17 L18 13 L21 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  divider: '<rect x="2" y="11" width="20" height="2" rx="1" fill="currentColor"/>',
  todo:
    '<rect x="3" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M6 12 L9 15 L15 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect x="19" y="9" width="2" height="6" rx="1" fill="currentColor" opacity="0.5"/>',
  code:
    '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M9 9 L6 12 L9 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M15 9 L18 12 L15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  embed:
    '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M10 9 L15 12 L10 15 Z" fill="currentColor"/>',
} as const;

/**
 * Built-in slash-menu blocks. Registered by `registerBuiltinBlocks()`
 * — call once at app boot before using `useBlockLibrary()`.
 *
 * Keeping the definitions next to the registry API means downstream
 * consumers can override any of them by re-registering the same name.
 */
export const BUILTIN_BLOCKS: readonly BlockConfig[] = Object.freeze([
  {
    name: 'paragraph',
    label: 'Paragraph',
    icon: 'type',
    category: 'Text',
    description: 'Plain text block — the default body text.',
    keywords: ['text', 'p', 'body', 'sentence'],
    meta: {
      thumbnail: THUMB.paragraph,
      tags: ['text', 'body', 'writing'],
      shortcut: 'P',
      insertExample: {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Start with a clear, simple sentence.' }],
      },
    },
  },
  {
    name: 'heading',
    label: 'Heading',
    icon: 'heading-1',
    category: 'Text',
    description: 'Section heading (h1–h4). Use the outline to navigate.',
    keywords: ['title', 'h1', 'h2', 'h3', 'h4', 'section'],
    meta: {
      thumbnail: THUMB.heading,
      tags: ['title', 'h1', 'h2', 'h3', 'section'],
      shortcut: 'H',
      insertExample: {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'A clear section heading' }],
      },
    },
  },
  {
    name: 'callout',
    label: 'Callout',
    icon: 'alert-triangle',
    category: 'Text',
    description: 'Highlighted info, note, or warning box.',
    keywords: ['note', 'info', 'warning', 'tip', 'aside'],
    meta: {
      thumbnail: THUMB.callout,
      tags: ['note', 'info', 'warning', 'tip', 'aside'],
      shortcut: '>',
      insertExample: {
        type: 'callout',
        attrs: { variant: 'info' },
        content: [{ type: 'text', text: 'Important context the reader should not miss.' }],
      },
    },
    render: (attrs) =>
      `<aside class="callout" data-variant="${String(attrs['variant'] ?? 'info')}">${String(attrs['text'] ?? '')}</aside>`,
    validate: (attrs) =>
      typeof attrs['text'] === 'string' && attrs['text'].trim().length > 0 ? null : 'Callout must have text',
  },
  {
    name: 'image',
    label: 'Image',
    icon: 'image',
    category: 'Media',
    description: 'Inline image with caption and alt text.',
    keywords: ['photo', 'picture', 'img', 'media', 'cover'],
    meta: {
      thumbnail: THUMB.image,
      tags: ['photo', 'picture', 'img', 'media', 'cover'],
      shortcut: 'Cmd+Opt+I',
      insertExample: {
        type: 'image',
        attrs: { src: '/media/cover.jpg', alt: 'A short description for screen readers.' },
      },
    },
  },
  {
    name: 'divider',
    label: 'Divider',
    icon: 'minus',
    category: 'Media',
    description: 'A horizontal rule that separates sections.',
    keywords: ['line', 'separator', 'hr', 'break'],
    meta: {
      thumbnail: THUMB.divider,
      tags: ['line', 'separator', 'hr', 'break'],
      shortcut: '---',
      insertExample: { type: 'horizontalRule' },
    },
  },
  {
    name: 'todo',
    label: 'Todo',
    icon: 'check-square',
    category: 'Lists',
    description: 'A single checklist item with a label.',
    keywords: ['task', 'checkbox', 'checklist', 'todo'],
    meta: {
      thumbnail: THUMB.todo,
      tags: ['task', 'checkbox', 'checklist', 'todo'],
      shortcut: '[]',
      insertExample: {
        type: 'todo',
        attrs: { label: 'A short, actionable item' },
        content: [{ type: 'text', text: 'A short, actionable item' }],
      },
    },
    validate: (attrs) => (typeof attrs['label'] === 'string' ? null : 'Todo must have a label'),
  },
  {
    name: 'code',
    label: 'Code',
    icon: 'code',
    category: 'Lists',
    description: 'Monospace code block with optional language hint.',
    keywords: ['pre', 'snippet', 'code', 'monospace'],
    meta: {
      thumbnail: THUMB.code,
      tags: ['pre', 'snippet', 'code', 'monospace'],
      shortcut: 'Cmd+Opt+C',
      insertExample: {
        type: 'codeBlock',
        attrs: { language: 'typescript' },
        content: [{ type: 'text', text: 'const greeting = "hello";' }],
      },
    },
  },
  {
    name: 'embed',
    label: 'Embed',
    icon: 'video',
    category: 'Embeds',
    description: 'YouTube, Vimeo, or Twitter embed.',
    keywords: ['youtube', 'vimeo', 'twitter', 'video', 'media'],
    meta: {
      thumbnail: THUMB.embed,
      tags: ['youtube', 'vimeo', 'twitter', 'video', 'media'],
      shortcut: '/embed',
      insertExample: {
        type: 'embedBlock',
        attrs: { url: 'https://www.youtube.com/watch?v=…', type: 'youtube' },
      },
    },
  },
  {
    name: 'richTextBlock',
    label: 'Rich text',
    icon: 'layout',
    category: 'Advanced',
    description: 'Grouped rich text container (page-builder).',
    keywords: ['group', 'container'],
  },
  {
    name: 'imageBlock',
    label: 'Image block',
    icon: 'image',
    category: 'Advanced',
    description: 'Image with caption & alignment (page-builder).',
    keywords: ['image', 'figure', 'caption'],
  },
  {
    name: 'embedBlock',
    label: 'Embed block',
    icon: 'video',
    category: 'Advanced',
    description: 'Embed with provider type (page-builder).',
    keywords: ['embed', 'provider'],
  },
  {
    name: 'codeBlock',
    label: 'Code block',
    icon: 'code',
    category: 'Advanced',
    description: 'Code block with language (page-builder).',
    keywords: ['code', 'language', 'syntax'],
  },
]);

/**
 * Register the built-in block definitions. Safe to call multiple
 * times — existing registrations are preserved. Idempotent.
 */
export function registerBuiltinBlocks(): void {
  for (const config of BUILTIN_BLOCKS) {
    if (!blockRegistry.has(config.name)) {
      blockRegistry.set(config.name, config);
    }
  }
}

/** Default placeholder for the optional React node field of blocks. */
export type BlockRenderNode = ReactNode;
