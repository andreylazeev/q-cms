/**
 * @q-cms/editor — TipTap-based block editor for Q-CMS.
 *
 * This package provides:
 * - Pre-configured TipTap extensions via `createEditorConfig()`
 * - Custom block node extensions (RichTextBlock, ImageBlock, EmbedBlock, CodeBlock)
 * - A block registration system for extensibility
 * - HTML renderer for converting editor JSON to HTML
 * - Utilities for working with editor content
 *
 * @packageDocumentation
 */

export { createEditorConfig } from './config.ts';
export type { EditorConfigOptions } from './config.ts';

export {
  RichTextBlock,
  ImageBlock,
  EmbedBlock,
  CodeBlock,
} from './extensions/index.ts';

export {
  registerBlock,
  getBlock,
  listBlocks,
  clearBlocks,
} from './blocks.ts';
export type { BlockConfig } from './blocks.ts';

export { renderToHTML, stripHTML } from './renderer.ts';

export { isEditorEmpty, wordCount } from './utils.ts';

export type {
  JSONContent,
  JSONContentMark,
  AlignmentOption,
  EmbedType,
} from './types.ts';
