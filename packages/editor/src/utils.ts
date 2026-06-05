import type { JSONContent } from './types.ts';

/**
 * Extract a list of metadata items from an entry's `data` payload.
 *
 * The shape of `data` is collection-defined, but most collections
 * store the canonical title/excerpt/cover/tags/SEO under the same
 * keys. This helper walks the payload and returns whatever it can
 * find, so the editor's metadata sidebar can render a uniform
 * "page settings" panel without knowing the collection schema.
 */
export interface ExtractedEntryMetadata {
  title: string;
  slug: string;
  excerpt: string | null;
  coverId: string | null;
  authorId: string | null;
  tags: readonly string[];
  seo: { title: string; description: string };
  /** Extra keys present in `data` that this helper did not know about. */
  extra: Record<string, unknown>;
}

export function extractEntryMetadata(
  data: Record<string, unknown> | null | undefined,
): ExtractedEntryMetadata {
  const d = (data ?? {}) as Record<string, unknown>;
  const titleRaw = d['title'];
  const nameRaw = d['name'];
  const title = typeof titleRaw === 'string' ? titleRaw : typeof nameRaw === 'string' ? nameRaw : '';
  const slugRaw = d['slug'];
  const slug = typeof slugRaw === 'string' ? slugRaw : '';
  const excerptRaw = d['excerpt'];
  const excerpt = typeof excerptRaw === 'string' ? excerptRaw : null;
  const coverRaw = d['coverId'] ?? d['cover'] ?? d['cover_id'];
  const coverId = typeof coverRaw === 'string' ? coverRaw : null;
  const authorRaw = d['authorId'] ?? d['author_id'] ?? d['author'];
  const authorId = typeof authorRaw === 'string' ? authorRaw : null;
  const tagsRaw = d['tags'];
  const tags = Array.isArray(tagsRaw) ? tagsRaw.filter((t): t is string => typeof t === 'string') : [];
  const seoRaw = d['seo'];
  const seo =
    seoRaw && typeof seoRaw === 'object'
      ? (seoRaw as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const seoTitle = typeof seo['title'] === 'string' ? (seo['title'] as string) : '';
  const seoDescription = typeof seo['description'] === 'string' ? (seo['description'] as string) : '';

  // Capture any other top-level keys so callers can display them.
  const known = new Set([
    'title',
    'name',
    'slug',
    'excerpt',
    'coverId',
    'cover',
    'cover_id',
    'authorId',
    'author_id',
    'author',
    'tags',
    'seo',
    'content',
    'body',
  ]);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (!known.has(k)) extra[k] = v;
  }

  return {
    title,
    slug,
    excerpt,
    coverId,
    authorId,
    tags,
    seo: { title: seoTitle, description: seoDescription },
    extra,
  };
}

/**
 * Convert an editor JSON document (or the plain-text stub the dev
 * editor uses) into a stable block-level summary for the editor's
 * outline / metadata sidebar. Walks the tree depth-first, captures
 * the type and a short plain-text label of each top-level block,
 * and a stable id.
 */
export interface BlockSummary {
  id: string;
  type: string;
  label: string;
}

export function summarizeBlocks(json: JSONContent | undefined | null): BlockSummary[] {
  const out: BlockSummary[] = [];
  if (!json || !json.content) return out;
  let counter = 0;
  for (const node of json.content) {
    counter += 1;
    const id =
      typeof node.attrs?.['id'] === 'string' && (node.attrs['id'] as string)
        ? (node.attrs['id'] as string)
        : `b_${counter}`;
    const text: string[] = [];
    collectSummaryText(node, text);
    const label = text.join('').trim().slice(0, 80) || node.type || 'Block';
    out.push({ id, type: node.type ?? 'unknown', label });
  }
  return out;
}

function collectSummaryText(node: JSONContent, out: string[]): void {
  if (node.type === 'text' && typeof node.text === 'string') {
    out.push(node.text);
    return;
  }
  if (node.content) {
    for (const c of node.content) collectSummaryText(c, out);
  }
}

/**
 * Check whether the editor document is effectively empty
 * (no meaningful text content or blocks).
 *
 * An editor with only an empty paragraph is considered empty.
 *
 * @param json - The editor document JSON.
 * @returns `true` if the document has no content.
 */
export function isEditorEmpty(json: JSONContent | undefined | null): boolean {
  if (!json) return true;

  // If it's a doc node, check its content
  const content = json.type === 'doc' ? json.content : [json];

  if (!content || content.length === 0) return true;

  // Check each top-level node
  for (const node of content) {
    // Non-empty text nodes
    if (node.type === 'text' && node.text) return false;

    // Paragraphs / headings with text
    if (isTextBlock(node)) return false;

    // Any other block type with content or attrs is non-empty
    if (node.type && node.type !== 'paragraph') {
      if (node.content && node.content.length > 0) return false;
      if (node.attrs && hasMeaningfulAttrs(node.attrs)) return false;
    }
  }

  return true;
}

/**
 * Count words in the editor document.
 *
 * Splits text content on whitespace boundaries.
 *
 * @param json - The editor document JSON.
 * @returns The total word count.
 */
export function wordCount(json: JSONContent | undefined | null): number {
  if (!json) return 0;

  const texts: string[] = [];
  collectText(json, texts);

  const joined = texts.join(' ');
  if (joined.trim().length === 0) return 0;

  return joined.trim().split(/\s+/).length;
}

// ---- Internal helpers ----

function isTextBlock(node: JSONContent): boolean {
  if (!node.content) return false;

  // A text block is non-empty if any descendant is a text node with text
  for (const child of node.content) {
    if (child.type === 'text' && child.text && child.text.trim().length > 0) {
      return true;
    }
    if (child.content && isTextBlock(child)) return true;
  }
  return false;
}

function hasMeaningfulAttrs(attrs: Record<string, unknown>): boolean {
  for (const value of Object.values(attrs)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'boolean' && !value) continue;
    return true;
  }
  return false;
}

function collectText(node: JSONContent, out: string[]): void {
  if (node.type === 'text' && node.text) {
    out.push(node.text);
  }
  if (node.content) {
    for (const child of node.content) {
      collectText(child, out);
    }
  }
}
