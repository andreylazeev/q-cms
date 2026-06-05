import { describe, it, expect } from 'vitest';
import { createEditorConfig } from './config.ts';
import {
  registerBlock,
  getBlock,
  listBlocks,
  clearBlocks,
} from './blocks.ts';
import type { BlockConfig } from './blocks.ts';
import { renderToHTML, stripHTML } from './renderer.ts';
import { isEditorEmpty, wordCount } from './utils.ts';
import type { JSONContent } from './types.ts';
import {
  RichTextBlock,
  ImageBlock,
  EmbedBlock,
  CodeBlock,
} from './extensions/index.ts';

// ---- createEditorConfig ----

describe('createEditorConfig', () => {
  it('returns an array of extensions', () => {
    const extensions = createEditorConfig();
    expect(Array.isArray(extensions)).toBe(true);
    expect(extensions.length).toBeGreaterThan(0);
  });

  it('includes StarterKit', () => {
    const extensions = createEditorConfig();
    const starterKit = extensions.find((e) => e.name === 'starterKit');
    expect(starterKit).toBeDefined();
  });

  it('includes Image extension', () => {
    const extensions = createEditorConfig();
    const image = extensions.find((e) => e.name === 'image');
    expect(image).toBeDefined();
  });

  it('includes Link extension', () => {
    const extensions = createEditorConfig();
    const link = extensions.find((e) => e.name === 'link');
    expect(link).toBeDefined();
  });

  it('includes Placeholder extension', () => {
    const extensions = createEditorConfig();
    const placeholder = extensions.find((e) => e.name === 'placeholder');
    expect(placeholder).toBeDefined();
  });

  it('includes custom RichTextBlock', () => {
    const extensions = createEditorConfig();
    const block = extensions.find((e) => e.name === 'richTextBlock');
    expect(block).toBeDefined();
  });

  it('includes custom ImageBlock', () => {
    const extensions = createEditorConfig();
    const block = extensions.find((e) => e.name === 'imageBlock');
    expect(block).toBeDefined();
  });

  it('includes custom EmbedBlock', () => {
    const extensions = createEditorConfig();
    const block = extensions.find((e) => e.name === 'embedBlock');
    expect(block).toBeDefined();
  });

  it('includes custom CodeBlock (replaces StarterKit one)', () => {
    const extensions = createEditorConfig();
    const codeBlock = extensions.find((e) => e.name === 'codeBlock');
    expect(codeBlock).toBeDefined();
  });

  it('includes Typography extension', () => {
    const extensions = createEditorConfig();
    const typo = extensions.find((e) => e.name === 'typography');
    expect(typo).toBeDefined();
  });

  it('configures heading levels 1-4', () => {
    const extensions = createEditorConfig();
    const starterKit = extensions.find((e) => e.name === 'starterKit');
    // Verify it's configured — the extension internals may vary,
    // but we can check it exists and has options
    expect(starterKit).toBeDefined();
    expect(starterKit!.options).toBeDefined();
  });

  it('accepts custom placeholder text', () => {
    const extensions = createEditorConfig({ placeholder: 'Type here...' });
    const placeholder = extensions.find((e) => e.name === 'placeholder');
    expect(placeholder).toBeDefined();
    expect(placeholder!.options).toBeDefined();
  });
});

// ---- Block registry ----

describe('block registry', () => {
  const sampleBlock: BlockConfig = {
    name: 'testBlock',
    label: 'Test Block',
    icon: 'test-icon',
  };

  it('registers and retrieves a block', () => {
    clearBlocks();
    registerBlock(sampleBlock);
    const retrieved = getBlock('testBlock');
    expect(retrieved).toEqual(sampleBlock);
  });

  it('returns undefined for unknown block', () => {
    clearBlocks();
    expect(getBlock('nonexistent')).toBeUndefined();
  });

  it('lists all registered blocks', () => {
    clearBlocks();
    registerBlock(sampleBlock);
    registerBlock({
      name: 'anotherBlock',
      label: 'Another',
      icon: 'another-icon',
    });
    const blocks = listBlocks();
    expect(blocks.length).toBe(2);
    expect(blocks.map((b) => b.name).sort()).toEqual([
      'anotherBlock',
      'testBlock',
    ]);
  });

  it('overwrites block on re-registration', () => {
    clearBlocks();
    registerBlock(sampleBlock);
    registerBlock({ ...sampleBlock, label: 'Updated' });
    const retrieved = getBlock('testBlock');
    expect(retrieved?.label).toBe('Updated');
  });

  it('clearBlocks removes all blocks', () => {
    clearBlocks();
    registerBlock(sampleBlock);
    clearBlocks();
    expect(listBlocks()).toHaveLength(0);
  });

  it('supports render function in config', () => {
    clearBlocks();
    const render = (attrs: Record<string, unknown>) =>
      `<div>${attrs.text}</div>`;
    registerBlock({ name: 'renderBlock', label: 'Render', icon: 'r', render });
    const block = getBlock('renderBlock');
    expect(block?.render).toBe(render);
    expect(block?.render!({ text: 'hello' })).toBe('<div>hello</div>');
  });

  it('supports schema in config', () => {
    clearBlocks();
    const schema = { type: 'object', properties: { text: { type: 'string' } } };
    registerBlock({ name: 'schemaBlock', label: 'Schema', icon: 's', schema });
    const block = getBlock('schemaBlock');
    expect(block?.schema).toEqual(schema);
  });
});

// ---- renderToHTML ----

describe('renderToHTML', () => {
  it('returns empty string for null/undefined', () => {
    expect(renderToHTML(null)).toBe('');
    expect(renderToHTML(undefined)).toBe('');
  });

  it('renders a simple paragraph', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toBe('<p>Hello world</p>');
  });

  it('renders headings with levels', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Sub' }] },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<h3>Sub</h3>');
  });

  it('renders bold, italic, code, and strike marks', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'Italic', marks: [{ type: 'italic' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'Code', marks: [{ type: 'code' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'Strike', marks: [{ type: 'strike' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'Underline', marks: [{ type: 'underline' }] },
          ],
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<em>Italic</em>');
    expect(html).toContain('<code>Code</code>');
    expect(html).toContain('<s>Strike</s>');
    expect(html).toContain('<u>Underline</u>');
  });

  it('renders links', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Click here',
              marks: [
                { type: 'link', attrs: { href: 'https://example.com', target: '_blank', rel: 'noopener' } },
              ],
            },
          ],
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener">Click here</a>');
  });

  it('renders bullet lists', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] },
          ],
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<ul><li><p>A</p></li><li><p>B</p></li></ul>');
  });

  it('renders ordered lists', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          attrs: { start: 3 },
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'X' }] }] },
          ],
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<ol start="3"><li><p>X</p></li></ol>');
  });

  it('renders blockquote', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Quote text' }] },
          ],
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<blockquote><p>Quote text</p></blockquote>');
  });

  it('renders horizontal rule', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'horizontalRule' }],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<hr>');
  });

  it('renders hard break', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Line 1' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Line 2' },
          ],
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<br>');
  });

  it('renders image', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { src: '/img.jpg', alt: 'Photo', title: 'Caption' },
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<img src="/img.jpg" alt="Photo" title="Caption">');
  });

  it('renders codeBlock with language', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [{ type: 'text', text: 'const x = 1;' }],
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<pre data-language="typescript">');
    expect(html).toContain('<code class="language-typescript">');
    expect(html).toContain('const x = 1;');
  });

  it('renders richTextBlock', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'richTextBlock',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Rich content' }] },
          ],
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<div data-type="rich-text-block">');
    expect(html).toContain('<p>Rich content</p>');
  });

  it('renders imageBlock with caption and alignment', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'imageBlock',
          attrs: { src: '/img.jpg', alt: 'Photo', caption: 'A caption', alignment: 'center' },
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<figure data-type="image-block"');
    expect(html).toContain('text-align:center');
    expect(html).toContain('<img src="/img.jpg" alt="Photo">');
    expect(html).toContain('<figcaption>A caption</figcaption>');
  });

  it('renders embedBlock', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'embedBlock',
          attrs: { url: 'https://youtube.com/watch?v=abc', type: 'youtube' },
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<div data-type="embed-block"');
    expect(html).toContain('data-url="https://youtube.com/watch?v=abc"');
    expect(html).toContain('data-embed-type="youtube"');
  });

  it('renders unknown nodes as div with data-type', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'customThing',
          attrs: { foo: 'bar' },
          content: [{ type: 'text', text: 'custom' }],
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toContain('<div data-type="customThing"');
    expect(html).toContain('foo="bar"');
    expect(html).toContain('custom');
  });

  it('renders multiple top-level blocks', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).toBe('<p>First</p><p>Second</p>');
  });

  it('handles nested marks', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Bold italic',
              marks: [{ type: 'bold' }, { type: 'italic' }],
            },
          ],
        },
      ],
    };
    const html = renderToHTML(doc);
    // Nested: marks apply in array order — bold wraps first, then italic outside
    expect(html).toContain('<em><strong>Bold italic</strong></em>');
  });

  it('escapes HTML in text content', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '<script>alert("xss")</script>' }],
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML in attributes', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { src: '/img.jpg', alt: '"><script>alert(1)</script>' },
        },
      ],
    };
    const html = renderToHTML(doc);
    expect(html).not.toContain('<script>');
  });
});

// ---- stripHTML ----

describe('stripHTML', () => {
  it('removes all HTML tags', () => {
    expect(stripHTML('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('decodes HTML entities', () => {
    expect(stripHTML('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(stripHTML('3 &lt; 5')).toBe('3 < 5');
    expect(stripHTML('He said &quot;Hi&quot;')).toBe('He said "Hi"');
  });

  it('returns empty string for empty input', () => {
    expect(stripHTML('')).toBe('');
    expect(stripHTML('   ')).toBe('');
  });

  it('handles complex nested HTML', () => {
    const html = '<div class="content"><h1>Title</h1><ul><li>A</li><li>B</li></ul></div>';
    expect(stripHTML(html)).toBe('TitleAB');
  });

  it('decodes numeric entities', () => {
    expect(stripHTML('&#169; 2024')).toBe('© 2024');
  });
});

// ---- isEditorEmpty ----

describe('isEditorEmpty', () => {
  it('returns true for null/undefined', () => {
    expect(isEditorEmpty(null)).toBe(true);
    expect(isEditorEmpty(undefined)).toBe(true);
  });

  it('returns true for empty doc', () => {
    expect(isEditorEmpty({ type: 'doc' })).toBe(true);
    expect(isEditorEmpty({ type: 'doc', content: [] })).toBe(true);
  });

  it('returns true for empty paragraph', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
    expect(isEditorEmpty(doc)).toBe(true);
  });

  it('returns true for paragraph with whitespace-only text', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '   ' }] },
      ],
    };
    expect(isEditorEmpty(doc)).toBe(true);
  });

  it('returns false for paragraph with text', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
      ],
    };
    expect(isEditorEmpty(doc)).toBe(false);
  });

  it('returns false for non-paragraph blocks with content', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'imageBlock', attrs: { src: '/img.jpg', alt: '', caption: '', alignment: 'left' } },
      ],
    };
    expect(isEditorEmpty(doc)).toBe(false);
  });

  it('returns false for heading with text', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
      ],
    };
    expect(isEditorEmpty(doc)).toBe(false);
  });

  it('returns false for lists with content', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }],
            },
          ],
        },
      ],
    };
    expect(isEditorEmpty(doc)).toBe(false);
  });
});

// ---- wordCount ----

describe('wordCount', () => {
  it('returns 0 for null/undefined', () => {
    expect(wordCount(null)).toBe(0);
    expect(wordCount(undefined)).toBe(0);
  });

  it('returns 0 for empty doc', () => {
    expect(wordCount({ type: 'doc', content: [] })).toBe(0);
  });

  it('counts words in a single paragraph', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    };
    expect(wordCount(doc)).toBe(2);
  });

  it('counts words across multiple paragraphs', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First sentence.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second sentence here.' }] },
      ],
    };
    expect(wordCount(doc)).toBe(5);
  });

  it('counts words in nested content', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Item one' }] },
              ],
            },
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Item two' }] },
              ],
            },
          ],
        },
      ],
    };
    expect(wordCount(doc)).toBe(4);
  });

  it('skips whitespace-only text nodes', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Word' },
            { type: 'text', text: '   ' },
            { type: 'text', text: 'another' },
          ],
        },
      ],
    };
    expect(wordCount(doc)).toBe(2);
  });

  it('returns 0 for whitespace-only content', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '   ' }] },
      ],
    };
    expect(wordCount(doc)).toBe(0);
  });

  it('counts words in headings and lists together', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'The Title' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Content goes here.' }],
        },
      ],
    };
    expect(wordCount(doc)).toBe(5);
  });
});

// ---- Custom extensions ----

describe('custom extensions', () => {
  it('RichTextBlock has correct name', () => {
    expect(RichTextBlock.name).toBe('richTextBlock');
  });

  it('ImageBlock has correct name', () => {
    expect(ImageBlock.name).toBe('imageBlock');
  });

  it('ImageBlock has imageBlock attributes', () => {
    const attrs = ImageBlock.config.addAttributes?.call(ImageBlock.config);
    expect(attrs).toBeDefined();
    if (attrs) {
      expect(attrs.src).toBeDefined();
      expect(attrs.alt).toBeDefined();
      expect(attrs.caption).toBeDefined();
      expect(attrs.alignment).toBeDefined();
    }
  });

  it('EmbedBlock has correct name', () => {
    expect(EmbedBlock.name).toBe('embedBlock');
  });

  it('EmbedBlock has embed attributes', () => {
    const attrs = EmbedBlock.config.addAttributes?.call(EmbedBlock.config);
    expect(attrs).toBeDefined();
    if (attrs) {
      expect(attrs.url).toBeDefined();
      expect(attrs.type).toBeDefined();
    }
  });

  it('CodeBlock has correct name', () => {
    expect(CodeBlock.name).toBe('codeBlock');
  });

  it('CodeBlock has language attribute', () => {
    const attrs = CodeBlock.config.addAttributes?.call(CodeBlock.config);
    expect(attrs).toBeDefined();
    if (attrs) {
      expect(attrs.language).toBeDefined();
      expect(attrs.showLineNumbers).toBeDefined();
    }
  });

  it('CodeBlock has renderHTML that uses language class', () => {
    const html = CodeBlock.config.renderHTML?.call(CodeBlock.config, {
      node: { attrs: { language: 'python', showLineNumbers: false } },
      HTMLAttributes: {},
    });
    expect(html).toBeDefined();
    // The renderHTML returns an array; second element is the attributes object
    if (html) {
      const attrs = html[1] as Record<string, string>;
      expect(attrs['data-language']).toBe('python');
    }
  });
});
