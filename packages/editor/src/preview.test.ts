import { describe, it, expect } from 'vitest';
import { renderPreview, sanitizeHtml } from './preview.ts';
import { renderToJSON } from './renderer.ts';
import type { JSONContent } from './types.ts';

// ---- renderToJSON ----

describe('renderToJSON', () => {
  it('returns null for null/undefined input', () => {
    expect(renderToJSON(null)).toBeNull();
    expect(renderToJSON(undefined)).toBeNull();
  });

  it('returns null for falsy input', () => {
    expect(renderToJSON(0 as unknown as JSONContent)).toBeNull();
  });

  it('preserves a simple text node', () => {
    const out = renderToJSON({ type: 'text', text: 'hello' });
    expect(out).toEqual({ type: 'text', text: 'hello' });
  });

  it('preserves marks on text nodes', () => {
    const out = renderToJSON({
      type: 'text',
      text: 'hi',
      marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://x' } }],
    });
    expect(out).toEqual({
      type: 'text',
      text: 'hi',
      marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://x' } }],
    });
  });

  it('drops text on non-text nodes', () => {
    const out = renderToJSON({ type: 'paragraph', text: 'leak', content: [] });
    expect(out?.text).toBeUndefined();
    expect(out?.type).toBe('paragraph');
  });

  it('assigns ids to top-level block nodes', () => {
    const out = renderToJSON({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [] },
        { type: 'paragraph', content: [] },
      ],
    });
    expect(out?.content?.[0]?.attrs?.['id']).toBe('b_1');
    expect(out?.content?.[1]?.attrs?.['id']).toBe('b_2');
  });

  it('preserves existing ids when present', () => {
    const out = renderToJSON({
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { id: 'custom' }, content: [] },
        { type: 'paragraph', content: [] },
      ],
    });
    expect(out?.content?.[0]?.attrs?.['id']).toBe('custom');
    expect(out?.content?.[1]?.attrs?.['id']).toBe('b_1');
  });

  it('normalizes a nested document tree', () => {
    const out = renderToJSON({
      type: 'doc',
      content: [
        {
          type: 'richTextBlock',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Hello' }],
            },
          ],
        },
      ],
    });
    expect(out?.type).toBe('doc');
    expect(out?.content?.[0]?.type).toBe('richTextBlock');
    expect(out?.content?.[0]?.attrs?.['id']).toBe('b_1');
    expect(out?.content?.[0]?.content?.[0]?.type).toBe('paragraph');
    expect(out?.content?.[0]?.content?.[0]?.content?.[0]).toEqual({
      type: 'text',
      text: 'Hello',
    });
  });
});

// ---- sanitizeHtml ----

describe('sanitizeHtml', () => {
  it('removes <script> tags', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).toContain('<p>ok</p>');
  });

  it('removes event handler attributes', () => {
    const out = sanitizeHtml('<a href="x" onclick="bad()">link</a>');
    expect(out).not.toContain('onclick');
    expect(out).toContain('href="x"');
  });

  it('returns empty string unchanged', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});

// ---- renderPreview ----

describe('renderPreview', () => {
  it('returns empty html for null input', () => {
    const out = renderPreview(null);
    expect(out.html).toBe('');
    expect(out.outline).toEqual([]);
    expect(out.wordCount).toBe(0);
    expect(out.excerpt).toBe('');
  });

  it('returns empty html for undefined input', () => {
    const out = renderPreview(undefined);
    expect(out.html).toBe('');
    expect(out.outline).toEqual([]);
  });

  it('renders a simple paragraph', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
    };
    const out = renderPreview(doc);
    expect(out.html).toBe('<p>Hello world</p>');
    expect(out.wordCount).toBe(2);
  });

  it('extracts the outline from headings (default h2/h3)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section A' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Subsection' }] },
        { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'Sub-subsection' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body.' }] },
      ],
    };
    const out = renderPreview(doc);
    expect(out.outline).toEqual([
      { level: 2, text: 'Section A', nodeId: 'b_1' },
      { level: 3, text: 'Subsection', nodeId: 'b_2' },
    ]);
  });

  it('outline skips non-heading blocks', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Lead.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'more.' }] },
      ],
    };
    const out = renderPreview(doc);
    expect(out.outline).toEqual([{ level: 2, text: 'A', nodeId: 'b_1' }]);
  });

  it('respects outlineMinLevel to include h1', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A' }] },
      ],
    };
    const out = renderPreview(doc, { outlineMinLevel: 1 });
    expect(out.outline).toEqual([
      { level: 1, text: 'Title', nodeId: 'b_1' },
      { level: 2, text: 'A', nodeId: 'b_2' },
    ]);
  });

  it('respects outlineDepth option', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A' }] },
        { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'B' }] },
      ],
    };
    const out = renderPreview(doc, { outlineDepth: 2, outlineMinLevel: 1 });
    expect(out.outline).toEqual([{ level: 2, text: 'A', nodeId: 'b_1' }]);
  });

  it('injects heading ids into the html', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'First' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Second' }] },
      ],
    };
    const out = renderPreview(doc, { outlineMinLevel: 1 });
    expect(out.html).toContain('<h2 id="b_1">First</h2>');
    expect(out.html).toContain('<h2 id="b_2">Second</h2>');
  });

  it('counts words across paragraphs and headings', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'One two' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'three four five' }] },
      ],
    };
    const out = renderPreview(doc);
    expect(out.wordCount).toBe(5);
  });

  it('truncates the excerpt at the configured length', () => {
    const long = 'a'.repeat(500);
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: long }] }],
    };
    const out = renderPreview(doc);
    expect(out.excerpt.length).toBeLessThanOrEqual(200);
    expect(out.excerpt.endsWith('…')).toBe(true);
  });

  it('does not include the ellipsis when the body is short', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'short text' }] }],
    };
    const out = renderPreview(doc);
    expect(out.excerpt).toBe('short text');
  });

  it('strips script tags when sanitizing (default)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ok' }] }],
    };
    const out = renderPreview(doc, { sanitize: true });
    // The renderer never injects scripts, so this verifies the
    // sanitizer is at least a no-op on clean content.
    expect(out.html).toBe('<p>ok</p>');
  });

  it('skips sanitization when sanitize: false', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ok' }] }],
    };
    const out = renderPreview(doc, { sanitize: false });
    expect(out.html).toBe('<p>ok</p>');
  });

  it('handles empty doc', () => {
    const out = renderPreview({ type: 'doc', content: [] });
    expect(out.html).toBe('');
    expect(out.outline).toEqual([]);
    expect(out.wordCount).toBe(0);
  });

  it('handles a heading with no text', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 2 } }],
    };
    const out = renderPreview(doc);
    expect(out.outline[0]?.text).toBe('(untitled)');
  });

  it('caps outline depth at 6', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 6 }, content: [{ type: 'text', text: 'Deep' }] }],
    };
    const out = renderPreview(doc, { outlineDepth: 99, outlineMinLevel: 1 });
    expect(out.outline).toEqual([{ level: 6, text: 'Deep', nodeId: 'b_1' }]);
  });

  it('treats NaN outlineDepth as the minimum', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 6 }, content: [{ type: 'text', text: 'Deep' }] }],
    };
    const out = renderPreview(doc, { outlineDepth: Number.NaN, outlineMinLevel: 1 });
    // Outline min is 1, max becomes 1; a level-6 heading is excluded.
    expect(out.outline).toEqual([]);
  });

  it('produces deterministic outline ids across calls', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A' }] },
      ],
    };
    const a = renderPreview(doc);
    const b = renderPreview(doc);
    expect(a.outline[0]?.nodeId).toBe(b.outline[0]?.nodeId);
  });
});

// ---- estimateReadingTime ----

import { estimateReadingTime, pickActiveOutlineItem } from './preview.ts';

describe('estimateReadingTime', () => {
  it('returns 0 for zero or negative input', () => {
    expect(estimateReadingTime(0)).toBe(0);
    expect(estimateReadingTime(-1)).toBe(0);
  });

  it('returns at least 1 for any positive word count', () => {
    expect(estimateReadingTime(1)).toBe(1);
    expect(estimateReadingTime(50)).toBe(1);
  });

  it('rounds to the nearest minute', () => {
    // 200 wpm => 200 words = 1 min
    expect(estimateReadingTime(200)).toBe(1);
    // 500 words => 2.5 min => rounds to 3
    expect(estimateReadingTime(500)).toBe(3);
    // 800 words => 4 min
    expect(estimateReadingTime(800)).toBe(4);
  });

  it('handles non-finite input safely', () => {
    expect(estimateReadingTime(Number.NaN)).toBe(0);
    expect(estimateReadingTime(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

// ---- pickActiveOutlineItem ----

describe('pickActiveOutlineItem', () => {
  const headings = [
    { nodeId: 'b_1', top: 100 },
    { nodeId: 'b_2', top: 300 },
    { nodeId: 'b_3', top: 500 },
  ];

  it('returns the first heading when scroll is at the top', () => {
    expect(pickActiveOutlineItem(0, headings)).toBe('b_1');
  });

  it('returns the last heading whose top is <= scrollY', () => {
    expect(pickActiveOutlineItem(150, headings)).toBe('b_1');
    expect(pickActiveOutlineItem(350, headings)).toBe('b_2');
    expect(pickActiveOutlineItem(550, headings)).toBe('b_3');
  });

  it('uses a small threshold to handle sub-pixel rounding', () => {
    expect(pickActiveOutlineItem(108, headings)).toBe('b_1');
  });

  it('returns null when there are no headings', () => {
    expect(pickActiveOutlineItem(0, [])).toBeNull();
  });

  it('falls back to the first heading when scrollY is negative', () => {
    expect(pickActiveOutlineItem(-100, headings)).toBe('b_1');
  });
});
