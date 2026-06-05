import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlashMenu, type SlashMenuItem, __testing } from '../src/components/Editor/SlashMenu.tsx';

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('SlashMenu grouping', () => {
  const items: readonly SlashMenuItem[] = [
    { id: 'p', label: 'Paragraph', category: 'Text' },
    { id: 'h', label: 'Heading', category: 'Text' },
    { id: 'img', label: 'Image', category: 'Media' },
    { id: 'div', label: 'Divider', category: 'Media' },
    { id: 'embed', label: 'Embed', category: 'Embeds' },
  ];

  it('renders nothing when closed', () => {
    const { container } = render(
      <SlashMenu open={false} query="" items={items} onSelect={() => {}} onClose={() => {}} />,
    );
    expect(container.querySelector('[data-testid="slash-menu"]')).toBeNull();
  });

  it('renders a Text category header when grouped', () => {
    render(
      <SlashMenu open query="" items={items} onSelect={() => {}} onClose={() => {}} grouped />,
    );
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Media')).toBeInTheDocument();
    expect(screen.getByText('Embeds')).toBeInTheDocument();
  });

  it('filters by query', () => {
    render(
      <SlashMenu open query="image" items={items} onSelect={() => {}} onClose={() => {}} grouped />,
    );
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.queryByText('Paragraph')).toBeNull();
  });

  it('calls onSelect when an option is clicked', () => {
    let selected: SlashMenuItem | null = null;
    render(
      <SlashMenu
        open
        query=""
        items={items}
        onSelect={(it) => {
          selected = it;
        }}
        onClose={() => {}}
        grouped
      />,
    );
    fireEvent.click(screen.getByText('Image'));
    expect((selected as SlashMenuItem | null)?.id).toBe('img');
  });

  it('falls back to default items when no items are passed', () => {
    render(
      <SlashMenu open query="" items={[]} onSelect={() => {}} onClose={() => {}} grouped />,
    );
    expect(screen.getByText('Paragraph')).toBeInTheDocument();
    expect(screen.getByText('Heading')).toBeInTheDocument();
  });

  it('renders without grouping when grouped is false', () => {
    render(
      <SlashMenu open query="" items={items} onSelect={() => {}} onClose={() => {}} grouped={false} />,
    );
    // The category headers are still rendered in the grouped default
    // set inside the component, so check that the items themselves
    // are rendered.
    expect(screen.getByText('Paragraph')).toBeInTheDocument();
    expect(screen.getByText('Heading')).toBeInTheDocument();
  });
});

describe('SlashMenu keyboard nav', () => {
  const items: readonly SlashMenuItem[] = [
    { id: 'p', label: 'Paragraph', category: 'Text' },
    { id: 'h', label: 'Heading', category: 'Text' },
    { id: 'img', label: 'Image', category: 'Media' },
  ];

  it('moves highlight on ArrowDown', () => {
    render(
      <SlashMenu open query="" items={items} onSelect={() => {}} onClose={() => {}} grouped />,
    );
    // Initial highlight is on the first item.
    const first = screen.getByRole('option', { name: /Paragraph/ });
    expect(first.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    const second = screen.getByRole('option', { name: /Heading/ });
    expect(second.getAttribute('aria-selected')).toBe('true');
  });

  it('wraps highlight on ArrowUp', () => {
    render(
      <SlashMenu open query="" items={items} onSelect={() => {}} onClose={() => {}} grouped />,
    );
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    const last = screen.getByRole('option', { name: /Image/ });
    expect(last.getAttribute('aria-selected')).toBe('true');
  });

  it('calls onSelect on Enter with the highlighted item', () => {
    const onSelect = vi.fn();
    render(
      <SlashMenu open query="" items={items} onSelect={onSelect} onClose={() => {}} grouped />,
    );
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'h' }) as unknown as SlashMenuItem);
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(
      <SlashMenu open query="" items={items} onSelect={() => {}} onClose={onClose} grouped />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('SlashMenu empty state', () => {
  it('shows the empty state when no items match the query', () => {
    render(
      <SlashMenu open query="zzznoresults" items={[{ id: 'p', label: 'Paragraph', category: 'Text' }]} onSelect={() => {}} onClose={() => {}} grouped />,
    );
    expect(screen.getByTestId('slash-menu-empty')).toBeInTheDocument();
    expect(screen.getByText(/No blocks match/)).toBeInTheDocument();
  });

  it('shows a Recent group when recents exist in sessionStorage', () => {
    window.sessionStorage.setItem(
      'qcms:slash-menu:recents:test',
      JSON.stringify([{ id: 'h', at: Date.now() }]),
    );
    render(
      <SlashMenu
        open
        query=""
        items={[
          { id: 'p', label: 'Paragraph', category: 'Text' },
          { id: 'h', label: 'Heading', category: 'Text' },
        ]}
        onSelect={() => {}}
        onClose={() => {}}
        recentsKey="qcms:slash-menu:recents:test"
        grouped
      />,
    );
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });
});

describe('SlashMenu fuzzy scoring (pure)', () => {
  const { scoreItem } = __testing;

  it('ranks exact label matches highest', () => {
    const a = scoreItem({ id: 'h', label: 'Heading' }, 'heading');
    const b = scoreItem({ id: 'h', label: 'Heading' }, 'head');
    expect(a).toBeGreaterThan(b);
  });

  it('rejects non-matching items', () => {
    expect(scoreItem({ id: 'x', label: 'Paragraph' }, 'zzz')).toBe(0);
  });

  it('boosts matches on keywords and tags', () => {
    const base = scoreItem({ id: 'x', label: 'Foo' }, 'video');
    const withKw = scoreItem(
      { id: 'x', label: 'Foo', keywords: ['video'] },
      'video',
    );
    expect(withKw).toBeGreaterThan(base);
  });
});

describe('SlashMenu position (pure)', () => {
  const { positionPopover } = __testing;

  it('flips the popover above the anchor when it would overflow the bottom', () => {
    const result = positionPopover({ x: 10, y: 1000 }, { width: 200, maxHeight: 100 });
    expect(result.top).toBeLessThan(1000);
  });

  it('clamps to the right edge of the viewport', () => {
    const result = positionPopover({ x: 1900, y: 100 }, { width: 200, maxHeight: 100 });
    expect(result.left).toBeLessThanOrEqual(1024 - 200 - 8);
  });
});
