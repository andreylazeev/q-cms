/**
 * Block definitions for dynamic zones.
 *
 * Core blocks (paragraph, heading, image, code, quote, embed, gallery)
 * are predefined. Custom blocks can be added alongside them via plain objects.
 */

import type { FieldMap } from "./types.ts";

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

/** Schema for a block — just a FieldMap plus optional rendering hint. */
export interface BlockConfig {
  /** Field definitions that shape the block's data. */
  schema: FieldMap;
  /** Optional frontend component path for the renderer. */
  component?: string;
}

/** Map of block names to their definitions. */
export type BlocksMap = Record<string, BlockConfig>;

// ---------------------------------------------------------------------------
// Core blocks
// ---------------------------------------------------------------------------

/** Paragraph block: rich-text content. */
const paragraph: BlockConfig = {
  schema: {
    text: { type: "richtext", required: true },
  },
};

/** Heading block: level + text. */
const heading: BlockConfig = {
  schema: {
    level: { type: "enum", options: ["h1", "h2", "h3", "h4", "h5", "h6"], required: true },
    text: { type: "text", required: true },
  },
};

/** Image block: media reference + optional alt/caption. */
const image: BlockConfig = {
  schema: {
    image: { type: "media", allowedTypes: ["image"], required: true },
    alt: { type: "text" },
    caption: { type: "text" },
  },
};

/** Code block: language + code content. */
const code: BlockConfig = {
  schema: {
    language: { type: "text", required: true },
    code: { type: "text", required: true },
    lineNumbers: { type: "boolean" },
  },
};

/** Quote block: text + optional attribution. */
const quote: BlockConfig = {
  schema: {
    text: { type: "richtext", required: true },
    attribution: { type: "text" },
  },
};

/** Embed block: URL + provider metadata. */
const embed: BlockConfig = {
  schema: {
    url: { type: "url", required: true },
    provider: { type: "text" },
    html: { type: "text" },
    width: { type: "number" },
    height: { type: "number" },
  },
};

/** Gallery block: array of media references. */
const gallery: BlockConfig = {
  schema: {
    images: { type: "repeatable", fields: {
      image: { type: "media", allowedTypes: ["image"], required: true },
      caption: { type: "text" },
    } },
    layout: { type: "enum", options: ["grid", "masonry", "carousel"] },
  },
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Core blocks bundle. Use `...blocks.core` when defining your schema. */
export const core: Readonly<Record<string, BlockConfig>> = Object.freeze({
  paragraph,
  heading,
  image,
  code,
  quote,
  embed,
  gallery,
  Paragraph: paragraph,
  Heading: heading,
  Image: image,
  Code: code,
  Quote: quote,
  Embed: embed,
  Gallery: gallery,
} as const);

/**
 * Core block type — string union of all core block names.
 */
export type CoreBlockName = keyof typeof core;
