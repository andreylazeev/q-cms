/**
 * BlockPalette tests.
 *
 * Verifies the palette lists every built-in block, groups them by
 * category, supports the search filter, and exposes drag start
 * data.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockPalette } from '../BlockPalette.tsx';

describe('BlockPalette', () => {
  it('renders the built-in blocks grouped by category', async () => {
    render(<BlockPalette onAdd={() => {}} />);
    await waitFor(() => {
      // Every built-in block type should appear.
      expect(screen.getByTestId('palette-add-hero')).toBeTruthy();
      expect(screen.getByTestId('palette-add-articleGrid')).toBeTruthy();
      expect(screen.getByTestId('palette-add-callToAction')).toBeTruthy();
    });
    expect(screen.getByTestId('palette-category-content')).toBeTruthy();
  });

  it('filters the list when the user types in the search box', async () => {
    render(<BlockPalette onAdd={() => {}} />);
    await waitFor(() => screen.getByTestId('palette-add-hero'));
    const input = screen.getByTestId('palette-search') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hero' } });
    // hero stays
    expect(screen.getByTestId('palette-add-hero')).toBeTruthy();
    // unrelated blocks should be gone
    expect(screen.queryByTestId('palette-add-callToAction')).toBeNull();
  });

  it('shows an empty state when no blocks match the query', async () => {
    render(<BlockPalette onAdd={() => {}} />);
    await waitFor(() => screen.getByTestId('palette-add-hero'));
    const input = screen.getByTestId('palette-search') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'zzzzzzz' } });
    expect(screen.getByTestId('palette-empty')).toBeTruthy();
  });

  it('invokes onAdd when a card is clicked', async () => {
    let added: string | null = null;
    render(
      <BlockPalette
        onAdd={(spec) => {
          added = spec.type;
        }}
      />,
    );
    await waitFor(() => screen.getByTestId('palette-add-hero'));
    fireEvent.click(screen.getByTestId('palette-add-hero'));
    expect(added).toBe('hero');
  });

  it('renders a thumb for every palette card', async () => {
    render(<BlockPalette onAdd={() => {}} />);
    await waitFor(() => screen.getByTestId('palette-add-hero'));
    // Walk every built-in card and assert a matching `palette-thumb-*` exists.
    const addButtons = await screen.findAllByTestId(/^palette-add-/);
    for (const btn of addButtons) {
      const testId = btn.getAttribute('data-testid') ?? '';
      const type = testId.replace(/^palette-add-/, '');
      expect(type.length).toBeGreaterThan(0);
      expect(screen.getByTestId(`palette-thumb-${type}`)).toBeTruthy();
    }
  });
});
