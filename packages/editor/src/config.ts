import { Extension, InputRule, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { RichTextBlock } from './extensions/richtext-block.ts';
import { ImageBlock } from './extensions/image-block.ts';
import { EmbedBlock } from './extensions/embed-block.ts';
import { CodeBlock } from './extensions/code-block.ts';

/**
 * Smart typography input rules — replaces common ASCII patterns with
 * typographic equivalents as the user types.
 *
 * Covers:
 * - Smart quotes: "foo" → “foo”
 * - Em dash: -- → —
 * - Ellipsis: ... → …
 * - Arrows: -> → →, <- → ←
 * - Copyright/TM: (c) → ©, (tm) → ™
 */
const Typography = Extension.create({
  name: 'typography',

  addInputRules() {

    return [
      // Em dash: -- → —
      new InputRule({
        find: /--$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).insertContentAt(range.from, '—').run();
        },
      }),

      // Ellipsis: ... → …
      new InputRule({
        find: /\.{3}$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).insertContentAt(range.from, '…').run();
        },
      }),

      // Right arrow: -> → →
      new InputRule({
        find: /->$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).insertContentAt(range.from, '→').run();
        },
      }),

      // Left arrow: <- → ←
      new InputRule({
        find: /<-$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).insertContentAt(range.from, '←').run();
        },
      }),

      // Copyright: (c) → ©
      new InputRule({
        find: /\(c\)$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).insertContentAt(range.from, '©').run();
        },
      }),

      // Trademark: (tm) → ™
      new InputRule({
        find: /\(tm\)$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).insertContentAt(range.from, '™').run();
        },
      }),

      // Smart double quotes: "foo" → “foo”
      new InputRule({
        find: /"([^"]*)"$/,
        handler: ({ range, chain, match }) => {
          chain()
            .deleteRange({ from: range.from + 1, to: range.to - 1 })
            .insertContentAt(range.from, `\u201C${match[1]}\u201D`)
            .run();
        },
      }),

      // Smart single quotes: 'foo' → ‘foo’
      new InputRule({
        find: /'([^']*)'$/,
        handler: ({ range, chain, match }) => {
          chain()
            .deleteRange({ from: range.from + 1, to: range.to - 1 })
            .insertContentAt(range.from, `\u2018${match[1]}\u2019`)
            .run();
        },
      }),
    ];
  },
});

export interface EditorConfigOptions {
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string;
}

/**
 * Creates a configured set of TipTap extensions for the Q-CMS editor.
 *
 * Includes:
 * - StarterKit (heading, bold, italic, code, lists, blockquote, horizontal rule, etc.)
 * - Image extension
 * - Link extension
 * - Placeholder extension
 * - Typography smart input rules
 * - Custom block extensions (RichTextBlock, ImageBlock, EmbedBlock, CodeBlock)
 *
 * Pass the returned array to `useEditor({ extensions: createEditorConfig() })`.
 */
export function createEditorConfig(
  options: EditorConfigOptions = {},
): Extensions {
  const { placeholder = 'Start writing...' } = options;

  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4],
      },
      codeBlock: false, // use our custom CodeBlock instead
    }),

    Image,

    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),

    Placeholder.configure({
      placeholder,
    }),

    Typography,

    RichTextBlock,
    ImageBlock,
    EmbedBlock,
    CodeBlock,
  ];
}
