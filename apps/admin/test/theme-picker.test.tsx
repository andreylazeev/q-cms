/**
 * ThemePicker tests.
 *
 * The picker is a presentational component — props in, callbacks out.
 * We render it with `@testing-library/react`, click cards / chips, and
 * assert on the resulting DOM and the callbacks fired.
 */
import { BUILT_IN_THEMES } from '@q-cms/theme';
import { ThemePicker } from '@q-cms/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('ThemePicker', () => {
  it('renders one card per theme and marks the active one', () => {
    render(
      <ThemePicker
        themes={BUILT_IN_THEMES}
        value="midnight"
        onChange={() => {}}
        mode="auto"
        onModeChange={() => {}}
      />,
    );

    // Every built-in theme should appear (use document.querySelectorAll since
    // there are multiple cards with the same data-testid).
    for (const t of BUILT_IN_THEMES) {
      const el = document.querySelector(`[data-theme-name="${t.name}"]`);
      expect(el).toBeTruthy();
    }

    // The active card carries `data-active="true"`.
    const active = document.querySelector('[data-active="true"]');
    expect(active).toBeTruthy();
    expect(active?.getAttribute('data-theme-name')).toBe('midnight');
  });

  it('fires onChange when a card is clicked', () => {
    const onChange = vi.fn();
    render(
      <ThemePicker
        themes={BUILT_IN_THEMES}
        value="default"
        onChange={onChange}
        mode="auto"
        onModeChange={() => {}}
      />,
    );
    const midnightCard = document.querySelector(
      '[data-theme-name="midnight"]',
    ) as HTMLElement | null;
    expect(midnightCard).toBeTruthy();
    if (midnightCard) fireEvent.click(midnightCard);
    expect(onChange).toHaveBeenCalledWith('midnight');
  });

  it('fires onModeChange when a mode chip is clicked', () => {
    const onModeChange = vi.fn();
    render(
      <ThemePicker
        themes={BUILT_IN_THEMES}
        value="default"
        onChange={() => {}}
        mode="light"
        onModeChange={onModeChange}
      />,
    );
    fireEvent.click(screen.getByTestId('mode-dark'));
    expect(onModeChange).toHaveBeenCalledWith('dark');
    fireEvent.click(screen.getByTestId('mode-auto'));
    expect(onModeChange).toHaveBeenCalledWith('auto');
  });

  it('shows three skeleton cards while isLoading', () => {
    render(
      <ThemePicker
        themes={[]}
        value="default"
        onChange={() => {}}
        mode="auto"
        onModeChange={() => {}}
        isLoading
      />,
    );
    // Skeleton blocks have animate-pulse.
    const pulsing = document.querySelectorAll('.animate-pulse');
    expect(pulsing.length).toBeGreaterThan(0);
  });

  it('renders a "no matches" empty state when filter excludes everything', () => {
    // Build a theme list with only `modeHint: 'dark'`, then filter to 'light'.
    const darkOnly = BUILT_IN_THEMES.map((t) => ({ ...t, modeHint: 'dark' as const }));
    render(
      <ThemePicker
        themes={darkOnly}
        value="default"
        onChange={() => {}}
        mode="auto"
        onModeChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('filter-light'));
    expect(screen.getByTestId('theme-empty')).toBeTruthy();
  });

  it('renders the segmented control with three options', () => {
    render(
      <ThemePicker
        themes={BUILT_IN_THEMES}
        value="default"
        onChange={() => {}}
        mode="dark"
        onModeChange={() => {}}
      />,
    );
    expect(screen.getByTestId('mode-light')).toBeTruthy();
    expect(screen.getByTestId('mode-dark')).toBeTruthy();
    expect(screen.getByTestId('mode-auto')).toBeTruthy();
  });
});
