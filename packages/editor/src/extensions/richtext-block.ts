import { Node } from '@tiptap/core';

/**
 * RichTextBlock — a wrapper node that groups rich-text content blocks
 * (paragraphs, headings, lists, etc.) into a single logical block.
 *
 * This serves as the primary content container for articles and allows
 * the editor to treat a sequence of rich-text nodes as one unit for
 * drag-and-drop, selection, and block-level operations.
 */
export const RichTextBlock = Node.create({
  name: 'richTextBlock',

  group: 'block',

  content: 'block+',

  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="rich-text-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-type': 'rich-text-block', ...HTMLAttributes }, 0];
  },
});
