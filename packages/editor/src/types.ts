/**
 * Editor JSON content types for TipTap / ProseMirror documents.
 *
 * These mirror the TipTap JSONContent shape without depending on
 * @tiptap/core at the type level, so the block system and renderer
 * can remain tree-shakeable and framework-agnostic.
 */

export interface JSONContentMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface JSONContent {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  marks?: JSONContentMark[];
  text?: string;
}

export type AlignmentOption = 'left' | 'center' | 'right';

export type EmbedType = 'youtube' | 'vimeo' | 'twitter';
