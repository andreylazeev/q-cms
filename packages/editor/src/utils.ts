import type { JSONContent } from './types.ts';

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
