import { Node, type CommandProps } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageBlock: {
      setImageBlock: (attrs: { src: string; alt?: string; caption?: string; alignment?: string }) => ReturnType;
    };
  }
}

/**
 * ImageBlock — a custom image node with caption and alignment support.
 *
 * Attributes:
 * - src: image URL (required)
 * - alt: alt text for accessibility
 * - caption: optional caption rendered below the image
 * - alignment: 'left' | 'center' | 'right'
 *
 * Renders as a <figure> with optional <figcaption>.
 */
export const ImageBlock = Node.create({
  name: 'imageBlock',

  group: 'block',

  atom: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: '',
      },
      alt: {
        default: '',
      },
      caption: {
        default: '',
      },
      alignment: {
        default: 'left',
        parseHTML: (element) =>
          (element.getAttribute('data-alignment') as string) || 'left',
        renderHTML: (attributes) => ({
          'data-alignment': attributes['alignment'],
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="image-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { src, alt, caption, alignment } = node.attrs as {
      src: string;
      alt: string;
      caption: string;
      alignment: string;
    };

    const style = `text-align:${alignment}`;

    return [
      'figure',
      { 'data-type': 'image-block', style, ...HTMLAttributes },
      ['img', { src, alt }],
      ...(caption ? [['figcaption', {}, caption]] : []),
    ];
  },

  addCommands() {
    return {
      setImageBlock:
        (attrs: { src: string; alt?: string; caption?: string; alignment?: string }) =>
        ({ commands }: CommandProps) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              src: attrs.src,
              alt: attrs.alt ?? '',
              caption: attrs.caption ?? '',
              alignment: attrs.alignment ?? 'left',
            },
          }),
    };
  },
});
