'use client';

/**
 * ThemePicker — gallery-quality theme selector.
 *
 * A grid of large theme cards, each with a 6-swatch preview,
 * a name, a one-line description, and an active-state badge.
 * Active cards have an accent border + a checkmark.
 *
 * Designed to feel like the theme picker in Linear / Vercel /
 * Stripe Dashboard, not a `<select>`:
 *
 *   - Cards lift on hover (translateY -2px) with shadow elevation.
 *   - Focus uses the always-visible `--color-focus-ring`.
 *   - Layout animates on filter change (filter chips at top).
 *   - Empty / loading states are handled (3 skeleton cards).
 *
 * @packageDocumentation
 */

import { type ThemeDefinition, type ThemeSwatch } from '@q-cms/theme';
import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { cn } from './utils';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/** A filter chip value. `'all'` is the union of every theme. */
export type ThemeFilter = 'all' | 'light' | 'dark';

/** Mode segmented-control value. `'auto'` follows the OS preference. */
export type ModeChoice = 'light' | 'dark' | 'auto';

export interface ThemePickerProps {
  /** Every theme the user can pick from. */
  themes: readonly ThemeDefinition[];
  /** Currently-selected theme name. */
  value: string;
  /** Called when the user picks a different theme. */
  onChange: (name: string) => void;
  /** Currently-selected mode. `'auto'` is supported. */
  mode: ModeChoice;
  /** Called when the user changes the mode. */
  onModeChange: (mode: ModeChoice) => void;
  /**
   * Optional override for the loading state. The picker shows 3
   * skeleton cards while data is loading; pass `isLoading={true}`
   * from the parent to force it.
   */
  isLoading?: boolean;
  /**
   * Optional class for the wrapping element. Useful for the
   * settings page layout.
   */
  className?: string;
  /**
   * `data-testid` for the root. Each card also gets a
   * `data-testid="theme-card"` with `data-theme-name=…` for tests.
   */
  'data-testid'?: string;
}

/* ---------------------------------------------------------------------------
 * Filter chip row
 * ------------------------------------------------------------------------- */

const FILTERS: readonly { value: ThemeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Decide whether a theme "passes" a given filter. A dark-first
 * theme (modeHint === 'dark') passes the dark filter, and
 * vice versa. modeHint === 'any' passes both.
 */
function passesFilter(theme: ThemeDefinition, filter: ThemeFilter): boolean {
  if (filter === 'all') return true;
  if (theme.modeHint === 'any') return true;
  return theme.modeHint === filter;
}

/* ---------------------------------------------------------------------------
 * Swatches
 * ------------------------------------------------------------------------- */

/**
 * The 6-swatch palette that lives at the top of each card. We
 * fall back to a derived set when a theme doesn't declare its own
 * (defensive — every built-in ships one).
 */
function swatchesFor(theme: ThemeDefinition): ThemeSwatch {
  if (theme.swatch) return theme.swatch;
  const t = theme.tokens;
  return {
    bg: t['color-bg-canvas'] ?? '#ffffff',
    surface: t['color-bg-surface'] ?? '#ffffff',
    fg: t['color-fg'] ?? '#000000',
    accent: t['color-accent'] ?? '#888888',
    muted: t['color-fg-muted'] ?? '#666666',
    border: t['color-border'] ?? '#dddddd',
  };
}

/* ---------------------------------------------------------------------------
 * Sub-components
 * ------------------------------------------------------------------------- */

interface CardProps {
  theme: ThemeDefinition;
  isActive: boolean;
  onSelect: () => void;
}

/** A single theme card with swatches, label, and active badge. */
function ThemeCard({ theme, isActive, onSelect }: CardProps): ReactElement {
  const sw = swatchesFor(theme);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      aria-label={`${theme.label} theme — ${theme.description}`}
      onClick={onSelect}
      data-testid="theme-card"
      data-theme-name={theme.name}
      data-active={isActive ? 'true' : undefined}
      className={cn(
        // Layout & base
        'group relative flex flex-col items-stretch gap-3 rounded-xl border bg-white p-3.5 text-left',
        'transition-[transform,box-shadow,border-color] duration-[var(--motion-base)] ease-[var(--ease-out)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        // Hover & active states
        'hover:-translate-y-0.5 hover:shadow-[var(--shadow-3)]',
        isActive
          ? 'border-[var(--color-accent)] shadow-[var(--shadow-2)] ring-1 ring-[var(--color-accent)]'
          : 'border-[var(--color-border)] shadow-[var(--shadow-1)]',
      )}
      style={{
        ['--color-accent' as string]: sw.accent,
        ['--color-fg' as string]: sw.fg,
      }}
    >
      {/* Swatches — 6 rectangles in a row. */}
      <div className="flex h-16 w-full overflow-hidden rounded-lg" aria-hidden="true">
        <div className="flex-1" style={{ background: sw.bg }} />
        <div className="flex-1" style={{ background: sw.surface, borderLeft: `1px solid ${sw.border}` }} />
        <div className="flex-1" style={{ background: sw.fg }} />
        <div className="flex-1" style={{ background: sw.accent }} />
        <div className="flex-1" style={{ background: sw.muted }} />
        <div className="flex-1" style={{ background: sw.border }} />
      </div>

      {/* Title row + active badge. */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="truncate text-sm font-semibold"
              style={{ color: 'var(--color-fg)' }}
            >
              {theme.label}
            </span>
            {theme.badge ? (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                style={{
                  background: 'var(--color-accent-soft)',
                  color: 'var(--color-accent)',
                }}
              >
                {theme.badge}
              </span>
            ) : null}
          </div>
          <p
            className="mt-0.5 line-clamp-2 text-xs"
            style={{ color: 'var(--color-fg-muted)' }}
          >
            {theme.description}
          </p>
        </div>
        {isActive ? (
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: 'var(--color-accent)' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3 w-3"
            >
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        ) : null}
      </div>
    </button>
  );
}

/** Loading skeleton — three blank cards with a soft shimmer. */
function SkeletonCard(): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-3.5"
    >
      <div className="flex h-16 w-full overflow-hidden rounded-lg">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex-1 animate-pulse bg-[var(--color-bg-surface)]"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
      <div className="h-3 w-24 animate-pulse rounded bg-[var(--color-bg-surface)]" />
      <div className="h-2 w-40 animate-pulse rounded bg-[var(--color-bg-surface)]" />
    </div>
  );
}

/** Segmented control for light / dark / auto. */
interface SegmentedProps {
  value: ModeChoice;
  onChange: (next: ModeChoice) => void;
}
function Segmented({ value, onChange }: SegmentedProps): ReactElement {
  const id = useId();
  const options: readonly { value: ModeChoice; label: string; icon: ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm5.66 2.34a1 1 0 010 1.41l-.7.7a1 1 0 11-1.42-1.41l.71-.7a1 1 0 011.41 0zM18 9a1 1 0 010 2h-1a1 1 0 110-2h1zM10 6a4 4 0 100 8 4 4 0 000-8zM3 9a1 1 0 010 2H2a1 1 0 110-2h1zm1.93-4.66a1 1 0 011.41 0l.71.7a1 1 0 11-1.42 1.42l-.7-.71a1 1 0 010-1.41zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-5.07-1.34a1 1 0 011.42 0l.7.71a1 1 0 11-1.41 1.41l-.71-.7a1 1 0 010-1.42zm10.14 0a1 1 0 011.41 1.42l-.7.7a1 1 0 11-1.42-1.41l.71-.71z" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      ),
    },
    {
      value: 'auto',
      label: 'Auto',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm12 0H5v8h10V5z"
            clipRule="evenodd"
          />
          <path d="M7 3a1 1 0 011 1v.5a1 1 0 11-2 0V4a1 1 0 011-1zm5 0a1 1 0 011 1v.5a1 1 0 11-2 0V4a1 1 0 011-1z" />
        </svg>
      ),
    },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Color mode"
      id={id}
      data-testid="mode-segmented"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border p-0.5',
        'border-[var(--color-border)] bg-[var(--color-bg-surface)]',
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            data-testid={`mode-${opt.value}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
              'transition-[background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
              selected
                ? 'bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] shadow-[var(--shadow-1)]'
                : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-surface-raised)] hover:text-[var(--color-fg)]',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Main component
 * ------------------------------------------------------------------------- */

/**
 * Renders a theme gallery. Use inside a `<ThemeProvider>` so
 * `useTheme()` consumers can read the active value.
 *
 * @example
 * ```tsx
 * <ThemePicker
 *   themes={availableThemes}
 *   value={themeName}
 *   onChange={setThemeName}
 *   mode={mode}
 *   onModeChange={setMode}
 * />
 * ```
 */
export function ThemePicker({
  themes,
  value,
  onChange,
  mode,
  onModeChange,
  isLoading = false,
  className,
  'data-testid': testId = 'theme-picker',
}: ThemePickerProps): ReactElement {
  const [filter, setFilter] = useState<ThemeFilter>('all');
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: defer the animation class until the
  // first client render so the cards animate in instead of popping.
  useEffect(() => {
    setMounted(true);
  }, []);

  const filtered = useMemo(() => themes.filter((t) => passesFilter(t, filter)), [themes, filter]);

  return (
    <div
      data-testid={testId}
      className={cn('flex flex-col gap-4', className)}
    >
      {/* Filter chips + segmented control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter themes by mode"
          data-testid="theme-filter"
          className={cn(
            'inline-flex items-center gap-0.5 rounded-lg border p-0.5',
            'border-[var(--color-border)] bg-[var(--color-bg-surface)]',
          )}
        >
          {FILTERS.map((f) => {
            const selected = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(f.value)}
                data-testid={`filter-${f.value}`}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium',
                  'transition-[background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
                  selected
                    ? 'bg-[var(--color-fg)] text-[var(--color-bg-canvas)]'
                    : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <Segmented value={mode} onChange={onModeChange} />
      </div>

      {/* Card grid */}
      <div
        role="radiogroup"
        aria-label="Available themes"
        data-testid="theme-grid"
        className={cn(
          'grid gap-3',
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          // Animate layout changes when the filter swaps.
          mounted && 'transition-[grid-template-rows] duration-[var(--motion-base)] ease-[var(--ease-out)]',
        )}
      >
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filtered.length === 0 ? (
          <div
            className="col-span-full rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm"
            style={{ color: 'var(--color-fg-muted)' }}
            data-testid="theme-empty"
          >
            No themes match the current filter.
          </div>
        ) : (
          filtered.map((t) => (
            <ThemeCard
              key={t.name}
              theme={t}
              isActive={t.name === value}
              onSelect={() => onChange(t.name)}
            />
          ))
        )}
      </div>
    </div>
  );
}
