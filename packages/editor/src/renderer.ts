import type { JSONContent } from './types.ts';

/**
 * Render TipTap editor JSON to an HTML string.
 *
 * Handles all default node types from StarterKit plus custom
 * Q-CMS blocks (richTextBlock, imageBlock, embedBlock, codeBlock).
 *
 * @param json - The editor document JSON (ProseMirror/TipTap format).
 * @returns An HTML string representation of the document.
 *
 * @example
 * ```ts
 * const html = renderToHTML({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] });
 * // '<p>Hello</p>'
 * ```
 */
export function renderToHTML(json: JSONContent | undefined | null): string {
  if (!json) return '';
  return renderNode(json);
}

/**
 * Strip HTML tags from a string, returning plain text.
 *
 * Useful for generating excerpts, search-index text, or
 * plain-text representations of rich content.
 *
 * @param html - The HTML string to strip.
 * @returns Plain text with all tags removed.
 */
export function stripHTML(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCodePoint(Number(dec)))
    .trim();
}

// ---- Internal render helpers ----


function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderAttrs(attrs?: Record<string, unknown>): string {
  if (!attrs || Object.keys(attrs).length === 0) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'boolean') {
      if (value) parts.push(key);
    } else {
      parts.push(`${key}="${escapeAttr(String(value))}"`);
    }
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function renderInlineNode(node: JSONContent): string {
  if (node.type === 'text') {
    const text = (node.text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Apply marks (bold, italic, code, link, strike, etc.)
    let result = text;
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case 'bold':
            result = `<strong>${result}</strong>`;
            break;
          case 'italic':
            result = `<em>${result}</em>`;
            break;
          case 'code':
            result = `<code>${result}</code>`;
            break;
          case 'strike':
            result = `<s>${result}</s>`;
            break;
          case 'underline':
            result = `<u>${result}</u>`;
            break;
          case 'link': {
            const href = escapeAttr(String(mark.attrs?.href ?? ''));
            const target = mark.attrs?.target ? ` target="${escapeAttr(String(mark.attrs.target))}"` : '';
            const rel = mark.attrs?.rel ? ` rel="${escapeAttr(String(mark.attrs.rel))}"` : '';
            result = `<a href="${href}"${target}${rel}>${result}</a>`;
            break;
          }
          // Other marks render as spans with data attributes for extensibility
          default:
            result = `<span data-mark="${escapeAttr(mark.type)}">${result}</span>`;
        }
      }
    }
    return result;
  }

  // Inline nodes like hardBreak
  if (node.type === 'hardBreak') return '<br>';

  return '';
}

function renderNode(node: JSONContent): string {
  if (!node || !node.type) {
    // Fragment-like: just render content
    if (node.content) return node.content.map(renderNode).join('');
    return '';
  }

  const children = node.content ? node.content.map(renderNode).join('') : '';
  const inlineContent = node.content
    ? node.content.map(renderInlineNode).join('')
    : '';

  switch (node.type) {
    case 'doc':
      return children;

    case 'paragraph':
      return `<p>${inlineContent}</p>`;

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      const hLevel = Math.min(Math.max(level, 1), 6);
      return `<h${hLevel}>${inlineContent}</h${hLevel}>`;
    }

    case 'text':
      return renderInlineNode(node);

    case 'blockquote':
      return `<blockquote>${children || inlineContent}</blockquote>`;

    case 'bulletList':
      return `<ul>${children}</ul>`;

    case 'orderedList': {
      const start = (node.attrs?.start as number) ?? 1;
      const startAttr = start !== 1 ? ` start="${start}"` : '';
      return `<ol${startAttr}>${children}</ol>`;
    }

    case 'listItem':
      return `<li>${children || inlineContent}</li>`;

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) || '';
      const classAttr = lang ? ` class="language-${escapeAttr(lang)}"` : '';
      const langAttr = lang ? ` data-language="${escapeAttr(lang)}"` : '';
      return `<pre${langAttr}><code${classAttr}>${inlineContent}</code></pre>`;
    }

    case 'horizontalRule':
      return '<hr>';

    case 'hardBreak':
      return '<br>';

    case 'image': {
      const src = escapeAttr(String(node.attrs?.src ?? ''));
      const alt = escapeAttr(String(node.attrs?.alt ?? ''));
      const title = node.attrs?.title
        ? ` title="${escapeAttr(String(node.attrs.title))}"`
        : '';
      return `<img src="${src}" alt="${alt}"${title}>`;
    }

    // Custom Q-CMS blocks
    case 'richTextBlock':
      return `<div data-type="rich-text-block">${children || inlineContent}</div>`;

    case 'imageBlock': {
      const src = escapeAttr(String(node.attrs?.src ?? ''));
      const alt = escapeAttr(String(node.attrs?.alt ?? ''));
      const caption = String(node.attrs?.caption ?? '');
      const alignment = String(node.attrs?.alignment ?? 'left');
      const figcaption = caption ? `<figcaption>${escapeAttr(caption)}</figcaption>` : '';
      return `<figure data-type="image-block" style="text-align:${escapeAttr(alignment)}"><img src="${src}" alt="${alt}">${figcaption}</figure>`;
    }

    case 'embedBlock': {
      const url = escapeAttr(String(node.attrs?.url ?? ''));
      const embedType = escapeAttr(String(node.attrs?.type ?? ''));
      return `<div data-type="embed-block" data-url="${url}" data-embed-type="${embedType}"></div>`;
    }

    default:
      // Unknown nodes: render as div with data-type and attrs
      return `<div data-type="${escapeAttr(node.type)}"${renderAttrs(node.attrs)}>${children || inlineContent}</div>`;
  }
}
