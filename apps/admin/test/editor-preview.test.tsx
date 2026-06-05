import { describe, expect, it } from 'vitest';
import { parseStubBlocks, readingTimeMinutesForText } from '../src/components/Editor/PreviewPane.tsx';
import { render, screen } from '@testing-library/react';
import { PreviewPane } from '../src/components/Editor/PreviewPane.tsx';

describe('parseStubBlocks', () => {
  it('parses an empty value into a single empty paragraph', () => {
    const blocks = parseStubBlocks('');
    expect(blocks).toEqual([]);
  });

  it('parses a plain line as a paragraph', () => {
    const blocks = parseStubBlocks('Hello world');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe('paragraph');
  });

  it('parses markdown-ish headings', () => {
    const blocks = parseStubBlocks('# Title\n## Sub\nBody');
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'heading', 'paragraph']);
  });

  it('parses a slash-inserted placeholder', () => {
    const blocks = parseStubBlocks('[Heading 2]');
    expect(blocks[0]?.kind).toBe('heading');
    if (blocks[0]?.kind === 'heading') {
      expect(blocks[0]?.level).toBe(2);
    }
  });

  it('parses a divider placeholder', () => {
    const blocks = parseStubBlocks('[Divider]');
    expect(blocks[0]?.kind).toBe('divider');
  });

  it('parses a callout placeholder', () => {
    const blocks = parseStubBlocks('[Callout]');
    expect(blocks[0]?.kind).toBe('callout');
  });

  it('parses an image placeholder', () => {
    const blocks = parseStubBlocks('[Image]');
    expect(blocks[0]?.kind).toBe('image');
  });

  it('renders an empty preview state when no content', () => {
    render(<PreviewPane value="" />);
    expect(screen.getByTestId('qcms-editor-preview')).toBeInTheDocument();
    expect(screen.getByTestId('qcms-editor-preview-empty')).toBeInTheDocument();
    expect(screen.getByText(/Start writing to see a live preview/i)).toBeInTheDocument();
  });

  it('renders the title prop', () => {
    render(<PreviewPane value="hi" title="My preview" />);
    expect(screen.getByText('My preview')).toBeInTheDocument();
  });

  it('renders a heading block', () => {
    render(<PreviewPane value="## Subhead" />);
    const preview = screen.getByTestId('qcms-editor-preview');
    expect(preview.textContent).toContain('Subhead');
  });

  it('shows the word count and reading time in the header', () => {
    render(<PreviewPane value="one two three four five" />);
    const stats = screen.getByTestId('qcms-editor-preview-stats');
    expect(stats.textContent).toContain('5');
    expect(stats.textContent).toContain('min read');
  });

  it('renders a "Copy as HTML" button by default', () => {
    render(<PreviewPane value="hello" />);
    expect(screen.getByTestId('qcms-editor-copy-html')).toBeInTheDocument();
  });

  it('hides the "Copy as HTML" button when showCopyHtml is false', () => {
    render(<PreviewPane value="hello" showCopyHtml={false} />);
    expect(screen.queryByTestId('qcms-editor-copy-html')).toBeNull();
  });

  it('extracts an outline from H2/H3 headings', () => {
    render(<PreviewPane value="## A\n### B\n## C" />);
    const outline = screen.getByTestId('qcms-editor-preview-outline');
    expect(outline.textContent).toContain('A');
    expect(outline.textContent).toContain('B');
    expect(outline.textContent).toContain('C');
  });

  it('hides the outline when no headings exist', () => {
    render(<PreviewPane value="just a paragraph" />);
    expect(screen.queryByTestId('qcms-editor-preview-outline')).toBeNull();
  });

  it('exports a readingTime helper', () => {
    // 200 words => 1 min
    expect(readingTimeMinutesForText('x '.repeat(200).trim())).toBe(1);
    // 0 words => 0 min
    expect(readingTimeMinutesForText('')).toBe(0);
  });
});
