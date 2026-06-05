import { Node, type CommandProps } from '@tiptap/core';
import type { EmbedType } from '../types.ts';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embedBlock: {
      setEmbedBlock: (attrs: { url: string; type?: EmbedType }) => ReturnType;
    };
  }
}

/**
 * EmbedBlock — a node for embedded content (YouTube, Vimeo, Twitter, etc.).
 *
 * Attributes:
 * - url: the embed URL
 * - type: the provider type ('youtube' | 'vimeo' | 'twitter')
 * - html: pre-rendered oEmbed HTML (optional, for server-side rendering)
 *
 * Renders as a responsive container with an iframe or blockquote for Twitter.
 */
export const EmbedBlock = Node.create({
  name: 'embedBlock',

  group: 'block',

  atom: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      url: {
        default: '',
      },
      type: {
        default: 'youtube' satisfies EmbedType,
        parseHTML: (element) =>
          (element.getAttribute('data-embed-type') as EmbedType) || 'youtube',
        renderHTML: (attributes) => ({
          'data-embed-type': attributes['type'],
        }),
      },
      html: {
        default: '',
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="embed-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { url, type, html } = node.attrs as {
      url: string;
      type: EmbedType;
      html: string;
    };

    const containerStyle =
      'position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%';

    // If server-side HTML is provided (from oEmbed), use it directly.
    if (html) {
      return [
        'div',
        {
          'data-type': 'embed-block',
          'data-url': url,
          'data-embed-type': type,
          ...HTMLAttributes,
        },
        ['div', { style: containerStyle }, ['div', {}, html]],
      ];
    }

    // Build embed URL for known providers.
    let embedHtml = '';
    if (type === 'youtube') {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        embedHtml = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
      }
    } else if (type === 'vimeo') {
      const videoId = extractVimeoId(url);
      if (videoId) {
        embedHtml = `<iframe width="560" height="315" src="https://player.vimeo.com/video/${videoId}" frameborder="0" allowfullscreen></iframe>`;
      }
    }

    return [
      'div',
      {
        'data-type': 'embed-block',
        'data-url': url,
        'data-embed-type': type,
        ...HTMLAttributes,
      },
      ['div', { style: containerStyle }, ['div', {}, embedHtml]],
    ];
  },

  addCommands() {
    return {
      setEmbedBlock:
        (attrs: { url: string; type?: EmbedType }) =>
        ({ commands }: CommandProps) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              url: attrs.url,
              type: attrs.type ?? detectEmbedType(attrs.url),
              html: '',
            },
          }),
    };
  },
});

// ---- URL extraction helpers ----

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  return match?.[1] ?? null;
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match?.[1] ?? null;
}

function detectEmbedType(url: string): EmbedType {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/vimeo\.com/.test(url)) return 'vimeo';
  if (/twitter\.com|x\.com/.test(url)) return 'twitter';
  return 'youtube';
}
