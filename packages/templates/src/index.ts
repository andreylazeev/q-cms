/**
 * @q-cms/templates — User-defined page templates and visual builder DSL.
 *
 * A template is an ordered list of typed sections. Each section
 * references a registered block spec that knows how to render itself
 * to HTML for the public site.
 *
 * This package is the single source of truth for:
 *   - the template type model (`types.ts`)
 *   - the block registry (`registry.ts`)
 *   - the built-in block specs (`blocks.ts`)
 *   - Zod-backed serialization (`serialize.ts`)
 *
 * The admin app consumes `listBlockSpecs()` to populate the
 * BlockPalette and `renderBlock()` for the live preview iframe.
 * The public site bundles the same block specs and renders them
 * with the template-engine runtime.
 *
 * @packageDocumentation
 */

export type {
  BlockSpec,
  BlockType,
  RenderContext,
  SectionId,
  TemplateArticleRef,
  TemplateAuthorRef,
  TemplateCategoryRef,
  TemplateSection,
  TemplateSpec,
} from './types.ts';

export {
  registerBlockSpec,
  getBlockSpec,
  listBlockSpecs,
  clearBlockSpecs,
  renderBlock,
} from './registry.ts';

export {
  BUILTIN_BLOCK_TYPES,
  registerBuiltinBlocks,
} from './blocks.ts';
export type { BlockSpec as BuiltinBlockSpec } from './blocks.ts';

export {
  templateSpecSchema,
  deserializeTemplate,
  safeDeserializeTemplate,
  serializeTemplate,
  createEmptyTemplate,
  touchTemplate,
} from './serialize.ts';
export type { TemplateSpecInput } from './serialize.ts';
