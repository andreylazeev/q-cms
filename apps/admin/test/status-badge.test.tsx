import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { StatusBadge } from '../src/components/StatusBadge';

describe('StatusBadge', () => {
  it('renders a human-readable label', () => {
    const html = renderToStaticMarkup(createElement(StatusBadge, { status: 'in_review' }));
    expect(html).toContain('In review');
  });

  it('emits a data-status attribute for tests', () => {
    const html = renderToStaticMarkup(createElement(StatusBadge, { status: 'published' }));
    expect(html).toContain('data-status="published"');
  });

  it('picks the correct tone for known statuses', () => {
    const published = renderToStaticMarkup(createElement(StatusBadge, { status: 'published' }));
    const failed = renderToStaticMarkup(createElement(StatusBadge, { status: 'failed' }));
    expect(published).toContain('data-tone="success"');
    expect(failed).toContain('data-tone="danger"');
  });

  it('falls back to neutral tone for unknown statuses', () => {
    const html = renderToStaticMarkup(createElement(StatusBadge, { status: 'unknown_state' }));
    expect(html).toContain('data-tone="neutral"');
  });

  it('respects an explicit tone override', () => {
    const html = renderToStaticMarkup(createElement(StatusBadge, { status: 'draft', tone: 'info' }));
    expect(html).toContain('data-tone="info"');
  });
});
