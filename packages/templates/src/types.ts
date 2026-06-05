/**
 * Public types for the page-template DSL.
 *
 * A `TemplateSpec` is the persisted shape of a page template: an
 * ordered list of `TemplateSection` entries. Each section is rendered
 * to HTML by a registered block spec (see `./blocks.ts`).
 *
 * Templates are framework-agnostic — the same spec is consumed by:
 *
 *   - the admin **PageBuilder** (drag, drop, edit, save)
 *   - the API (validation, persistence)
 *   - the public site's **template engine** (render to HTML)
 *
 * @module types
 */

/** Stable id, generated client-side and kept across saves. */
export type SectionId = string;

/**
 * The full set of built-in block types. Custom block types are allowed
 * at runtime (the registry accepts any string) but the visual editor
 * only renders the built-ins.
 */
export type BlockType =
  | 'hero'
  | 'articleGrid'
  | 'articleList'
  | 'authorCard'
  | 'authorBio'
  | 'categoryList'
  | 'richText'
  | 'callToAction'
  | 'imageBanner'
  | 'featureGrid'
  | 'separator'
  | 'embed';

/**
 * A block within a template.
 *
 * `props` are intentionally typed as `Record<string, unknown>` because
 * the per-block prop schema lives in the block registry (so that
 * custom blocks can be added without changing this file). The admin
 * editor and the runtime renderer both consult the registry to know
 * how to validate / display / render each block.
 */
export interface TemplateSection {
  /** Stable id (uuid v4-ish). */
  id: SectionId;
  /** Which registered block to render. */
  type: BlockType | (string & {});
  /** Block-specific props. */
  props: Record<string, unknown>;
  /** Optional nested layout children (used by `featureGrid` etc.). */
  children?: TemplateSection[] | undefined;
}

/**
 * Top-level template spec — the persisted shape.
 */
export interface TemplateSpec {
  /** Schema version. Bump on backwards-incompatible changes. */
  version: 1;
  /** Display name. */
  name: string;
  /** Optional human description. */
  description?: string | undefined;
  /** Slug used to bind templates to public pages. */
  slug: string;
  /** Locale this spec is bound to (default `en`). */
  locale: string;
  /** Ordered list of sections. */
  sections: TemplateSection[];
  /** Free-form metadata (theme id, ab-test bucket, etc.). */
  meta: Record<string, unknown>;
  /** Created / updated timestamps (ISO 8601). */
  createdAt: string;
  updatedAt: string;
}

/**
 * Context passed to block render functions.
 *
 * Carries everything a block might need at render time — locale,
 * current path, helper formatters, and an optional theme id.
 */
export interface RenderContext {
  /** Current locale. */
  locale: string;
  /** Current path (e.g. `/articles/foo`). */
  pathname: string;
  /** Resolved site settings. */
  site: {
    name: string;
    description: string;
    defaultLocale: string;
  };
  /** Active theme id (so blocks can apply the right classes). */
  themeId: string | null;
  /**
   * Stable id of the section currently being rendered. Block renderers
   * stamp it on the outermost element as `data-section-id` so the
   * public-site diff renderer can morph per-section.
   */
  sectionId: string | null;
  /** Escape helper, matches `escapeHtml` in the public bundle. */
  escape: (value: unknown) => string;
  /** Optional pre-fetched data for the page (articles, authors…). */
  data: {
    articles?: ReadonlyArray<TemplateArticleRef>;
    authors?: ReadonlyArray<TemplateAuthorRef>;
    categories?: ReadonlyArray<TemplateCategoryRef>;
  };
}

/** Lightweight reference used by blocks that need entry data. */
export interface TemplateArticleRef {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverId: string | null;
  authorId: string | null;
  publishedAt: string | null;
}

export interface TemplateAuthorRef {
  id: string;
  slug: string;
  name: string;
  bio: string;
  avatarId: string | null;
}

export interface TemplateCategoryRef {
  id: string;
  slug: string;
  name: string;
  description: string;
}

/** A block's serialized runtime spec. */
export interface BlockSpec {
  /** Unique block identifier. */
  type: string;
  /** Human label for the palette / menus. */
  label: string;
  /** Lucide icon name (or another identifier the admin understands). */
  icon: string;
  /** Short description shown as a tooltip. */
  description: string;
  /** Category used to group blocks in the palette. */
  category: 'layout' | 'content' | 'media' | 'commerce' | 'other';
  /** Default props for newly-added sections. */
  defaultProps: Record<string, unknown>;
  /** JSON Schema for `props` (used by the admin form generator). */
  propSchema: Record<string, unknown>;
  /** Render the block to HTML for the **public** site. */
  render: (props: Record<string, unknown>, ctx: RenderContext) => string;
}
