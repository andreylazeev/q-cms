import { renderToHTML, escapeHTMLText } from './renderer.ts';
import { registerBuiltinBlocks } from './blocks.ts';
import type { JSONContent } from './types.ts';

/**
 * Options for `renderPreview`.
 */
export interface RenderPreviewOptions {
  /**
   * Strip `<script>` and event-handler attributes from the rendered
   * HTML. Defaults to `true`. The renderer never injects script tags
   * itself, but the option is exposed for callers that pass content
   * which might contain hand-written HTML.
   */
  sanitize?: boolean;
  /**
   * Maximum depth of nested headings to include in the outline.
   * Defaults to 3 (headings up to `<h3>` are included). Set higher
   * to include all levels.
   */
  outlineDepth?: number;
  /**
   * Minimum heading level to include in the outline. Defaults to 2,
   * which skips the page title (`<h1>`) and starts the TOC at the
   * first section heading. Set to 1 to include the page title.
   */
  outlineMinLevel?: number;
  /**
   * Whether to include top-level non-heading blocks in the outline
   * as a "section" with a synthetic title. Defaults to `false`.
   */
  includeSectionEntries?: boolean;
}

/**
 * An entry in the document outline (table of contents).
 *
 * `nodeId` is the stable string id assigned by `renderToJSON` (also
 * rendered as `id="..."` on the matching heading element in the
 * returned HTML, so callers can link directly to it).
 */
export interface OutlineItem {
  /** Heading level (1–6) when the entry is a heading. */
  level: number;
  /** Plain-text label of the heading. */
  text: string;
  /** Stable block id assigned by the renderer. */
  nodeId: string;
}

/**
 * Result returned by `renderPreview`.
 */
export interface RenderPreviewResult {
  /** Sanitized HTML string ready to be dropped into the page. */
  html: string;
  /** Extracted outline entries, in document order. */
  outline: readonly OutlineItem[];
  /** Word count across all text content. */
  wordCount: number;
  /** Plain-text excerpt (first ~200 chars) of the body. */
  excerpt: string;
  /** Estimated reading time in minutes (200 wpm). */
  readingTimeMinutes: number;
}

/**
 * Render an editor JSON document for the public preview surface.
 *
 * `renderPreview` is the single entry point that powers:
 *  - the in-admin split preview pane
 *  - the standalone `/preview/[id]` page
 *  - the public web site's content rendering
 *
 * In addition to the HTML it returns a structured outline
 * (table of contents) extracted from the headings, basic
 * stats (word count, excerpt, reading time) used by the preview
 * chrome, and the active outline item computation that drives the
 * "scroll-spy" highlighting in the outline sidebar.
 *
 * The renderer never executes script tags or inlines event handlers.
 * When `sanitize` is left at its default `true` any `<script>`
 * element or `on*` attribute is removed as a defense-in-depth
 * measure.
 *
 * @param json - The editor document JSON.
 * @param opts - Optional rendering options.
 *
 * @example
 * ```ts
 * const { html, outline } = renderPreview({
 *   type: 'doc',
 *   content: [
 *     { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Intro' }] },
 *     { type: 'paragraph', content: [{ type: 'text', text: 'Hello.' }] },
 *   ],
 * });
 * ```
 */
export function renderPreview(
  json: JSONContent | undefined | null,
  opts: RenderPreviewOptions = {},
): RenderPreviewResult {
  // Make sure the built-in block registry is populated so consumers
  // that call renderPreview without first calling registerBuiltinBlocks
  // still get a useful output (e.g. outline labels).
  registerBuiltinBlocks();

  const sanitize = opts.sanitize ?? true;
  const outlineDepth = clamp(opts.outlineDepth ?? 3, 1, 6);
  const outlineMinLevel = clamp(opts.outlineMinLevel ?? 2, 1, 6);

  // Render the document to HTML via the shared renderer.
  let html = renderToHTML(json);

  // Walk the source document to build the outline. We need the
  // normalized ids, so we reconstruct the same id sequence the
  // renderer uses by walking the doc with a counter.
  const ctx = { counter: 0 };
  const outline = extractOutline(json, outlineDepth, outlineMinLevel, ctx);

  // Apply ids to the headings in the rendered HTML. We do this by
  // a simple string replace on the head tags — the renderer emits
  // `<h1>...</h1>` / `<h2>...</h2>` etc. and injects an `id`
  // attribute so anchor links work.
  html = injectHeadingIds(html, outline);

  if (sanitize) {
    html = sanitizeHtml(html);
  }

  const plain = extractPlainText(json);
  const wordCount = countWords(plain);
  return {
    html,
    outline,
    wordCount,
    excerpt: makeExcerpt(plain, 200),
    readingTimeMinutes: estimateReadingTime(wordCount),
  };
}

/**
 * Estimate reading time in minutes for a word count. Uses the
 * industry-standard 200 wpm with a 1-minute minimum so an article
 * always shows ≥ 1 min read.
 */
export function estimateReadingTime(words: number): number {
  if (!Number.isFinite(words) || words <= 0) return 0;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Pick the outline item that should be highlighted given a scroll
 * offset (in pixels) and a list of heading element rects.
 *
 * The algorithm picks the last heading whose `top` is ≤ the scroll
 * offset. If the scroll is at the very top, the first heading is
 * returned. Returns `null` when there are no headings to highlight.
 *
 * The caller is responsible for measuring the heading rects — the
 * function is pure so it is unit-testable.
 */
export function pickActiveOutlineItem(
  scrollY: number,
  headings: ReadonlyArray<{ nodeId: string; top: number }>,
): string | null {
  if (headings.length === 0) return null;
  let active: string | null = null;
  for (const h of headings) {
    if (h.top <= scrollY + 8) {
      active = h.nodeId;
    } else {
      break;
    }
  }
  return active ?? headings[0]?.nodeId ?? null;
}

/**
 * Walk the source document and produce a plain-text representation
 * with single spaces between block boundaries. Used by the preview
 * chrome for word count and excerpt; preferred over stripping HTML
 * (which would join `<h1>One two</h1><p>three four</p>` into
 * `One twothree four`).
 */
function extractPlainText(json: JSONContent | undefined | null): string {
  const parts: string[] = [];
  collectTextWithBoundaries(json ?? undefined, parts);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function collectTextWithBoundaries(node: JSONContent | undefined, out: string[]): void {
  if (!node) return;
  if (node.type === 'text' && typeof node.text === 'string') {
    out.push(node.text);
    return;
  }
  if (node.content && node.content.length > 0) {
    const isBlock = isBlockNode(node);
    if (isBlock && out.length > 0) out.push(' ');
    for (const c of node.content) collectTextWithBoundaries(c, out);
    if (isBlock) out.push(' ');
  }
}

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'listItem',
  'codeBlock',
  'image',
  'imageBlock',
  'embedBlock',
  'richTextBlock',
  'horizontalRule',
  'hardBreak',
]);

function isBlockNode(node: JSONContent): boolean {
  return node.type !== undefined && BLOCK_TYPES.has(node.type);
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(Math.max(n, lo), hi);
}

function collectText(node: JSONContent | undefined, out: string[]): void {
  if (!node) return;
  if (node.type === 'text' && typeof node.text === 'string') {
    out.push(node.text);
    return;
  }
  if (node.content) {
    for (const c of node.content) collectText(c, out);
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

function makeExcerpt(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

interface OutlineCtx {
  counter: number;
}

function extractOutline(
  json: JSONContent | undefined | null,
  maxDepth: number,
  minLevel: number,
  ctx: OutlineCtx,
): OutlineItem[] {
  const outline: OutlineItem[] = [];
  if (!json || !json.content) return outline;
  for (const node of json.content) {
    if (node.type === 'heading') {
      const level = clamp(Number(node.attrs?.['level'] ?? 1), 1, 6);
      if (level >= minLevel && level <= maxDepth) {
        const texts: string[] = [];
        collectText(node, texts);
        ctx.counter += 1;
        outline.push({
          level,
          text: texts.join('').trim() || '(untitled)',
          nodeId:
            typeof node.attrs?.['id'] === 'string' && node.attrs['id']
              ? (node.attrs['id'] as string)
              : `b_${ctx.counter}`,
        });
      }
    }
  }
  return outline;
}

function injectHeadingIds(html: string, outline: readonly OutlineItem[]): string {
  if (outline.length === 0) return html;
  let i = 0;
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_match, level: string, inner: string) => {
    const item = outline[i++];
    if (!item) return `<h${level}>${inner}</h${level}>`;
    return `<h${level} id="${escapeHTMLText(item.nodeId)}">${inner}</h${level}>`;
  });
}

const SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const ON_ATTR_RE = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

/**
 * Strip `<script>` tags and inline event-handler attributes from a
 * rendered HTML string. This is intentionally a small, conservative
 * sanitizer — the renderer already escapes untrusted text, this is
 * a final defense against hand-rolled content sneaking in.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return html;
  return html.replace(SCRIPT_RE, '').replace(ON_ATTR_RE, '');
}
