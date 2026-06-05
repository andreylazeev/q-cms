/**
 * @q-cms/editor — TipTap-based block editor for Q-CMS.
 *
 * This package provides:
 * - Pre-configured TipTap extensions via `createEditorConfig()`
 * - Custom block node extensions (RichTextBlock, ImageBlock, EmbedBlock, CodeBlock)
 * - A block registration system for extensibility (with category,
 *   React component, and validation support)
 * - HTML / JSON / preview renderers
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
  useBlockLibrary,
  registerBuiltinBlocks,
  validateDocument,
  BUILTIN_BLOCKS,
  BLOCK_CATEGORY_ORDER,
} from './blocks.ts';
export type {
  BlockConfig,
  BlockCategory,
  BlockDescriptor,
  BlockLibrary,
  BlockMeta,
  BlockValidationIssue,
  BuiltinBlockName,
} from './blocks.ts';

export { renderToHTML, renderToJSON, stripHTML, escapeHTMLText } from './renderer.ts';

export {
  renderPreview,
  sanitizeHtml,
  estimateReadingTime,
  pickActiveOutlineItem,
} from './preview.ts';
export type { RenderPreviewOptions, RenderPreviewResult, OutlineItem } from './preview.ts';

export {
  isEditorEmpty,
  wordCount,
  extractEntryMetadata,
  summarizeBlocks,
} from './utils.ts';
export type { ExtractedEntryMetadata, BlockSummary } from './utils.ts';

export type {
  JSONContent,
  JSONContentMark,
  AlignmentOption,
  EmbedType,
} from './types.ts';
