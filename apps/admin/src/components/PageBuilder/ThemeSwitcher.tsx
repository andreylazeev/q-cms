'use client';

/**
 * ThemeSwitcher — 5-swatch dropdown that picks the active theme for
 * the public-site preview. The dropdown itself is a tiny native
 * `<select>`; the swatches render as colored boxes inside each
 * `<option>` via CSS `::before` (the `style` attribute on each
 * option sets the swatch color).
 *
 * Kept as a native control because (a) we don't need a full Radix
 * menu here, and (b) the theme metadata is small enough that a
 * plain list is more discoverable than a nested menu.
 */

import { cn } from '../../lib/utils.ts';

export type ThemeId = 'default' | 'midnight' | 'paper' | 'newspaper' | 'high-contrast';

export const THEME_OPTIONS: ReadonlyArray<{ id: ThemeId; label: string; swatch: string }> = [
  { id: 'default', label: 'Default', swatch: '#f7f7f6' },
  { id: 'midnight', label: 'Midnight', swatch: '#0a0a0a' },
  { id: 'paper', label: 'Paper', swatch: '#f4f4f2' },
  { id: 'newspaper', label: 'Newspaper', swatch: '#efece4' },
  { id: 'high-contrast', label: 'High contrast', swatch: '#ffffff' },
];

export interface ThemeSwitcherProps {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
  className?: string;
}

export function ThemeSwitcher({ value, onChange, className }: ThemeSwitcherProps): React.JSX.Element {
  return (
    <div className={cn('pb-theme-switcher', className)} data-testid="theme-switcher">
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            'pb-theme-switcher__swatch',
            value === opt.id && 'pb-theme-switcher__swatch--active',
          )}
          title={opt.label}
          aria-label={opt.label}
          aria-pressed={value === opt.id}
          data-testid={`theme-${opt.id}`}
          style={{ background: opt.swatch }}
        />
      ))}
    </div>
  );
}
