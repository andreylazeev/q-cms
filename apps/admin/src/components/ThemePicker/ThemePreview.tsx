'use client';

/**
 * ThemePreview — a small "what this theme looks like" panel.
 *
 * Renders a static sample (article header + paragraph + button)
 * using the supplied theme's CSS variables. Used in the admin
 * settings page alongside the ThemePicker so the user can see the
 * active theme applied to realistic content, not just abstract
 * swatches.
 *
 * @packageDocumentation
 */

import type { ThemeDefinition } from '@q-cms/theme';
import { useMemo } from 'react';
import type { ReactElement } from 'react';

export interface ThemePreviewProps {
  /** The theme to preview. */
  theme: ThemeDefinition;
  /**
   * The mode to render in. `'dark'` shows the dark variant of the
   * theme (or the light tokens, if no dark override exists).
   */
  mode?: 'light' | 'dark';
  className?: string;
}

export function ThemePreview({
  theme,
  mode = 'light',
  className,
}: ThemePreviewProps): ReactElement {
  // Pick the right token set: dark override if available and
  // requested, otherwise the light tokens. We always have a flat
  // token map to read from.
  const tokens = useMemo(() => {
    if (mode === 'dark' && theme.dark) return theme.dark;
    return theme.tokens;
  }, [theme, mode]);

  // Convert the flat token map into a CSS inline-style payload.
  // We only set the variables the preview actually consumes —
  // anything else stays as the parent's value.
  const consumed = [
    'color-bg-canvas',
    'color-bg-surface',
    'color-bg-surface-raised',
    'color-fg',
    'color-fg-muted',
    'color-fg-subtle',
    'color-fg-on-accent',
    'color-border',
    'color-border-strong',
    'color-accent',
    'color-accent-soft',
    'color-link',
    'color-link-hover',
    'radius-md',
    'radius-lg',
    'radius-sm',
    'shadow-1',
    'shadow-2',
    'shadow-3',
    'font-sans',
    'font-serif',
    'motion-base',
    'ease-out',
  ] as const;

  const style: Record<string, string> = {};
  for (const key of consumed) {
    const v = tokens[key];
    if (typeof v === 'string') style[`--${key}`] = v;
  }

  return (
    <div
      data-testid="theme-preview"
      data-theme-name={theme.name}
      data-mode={mode}
      className={className}
      style={{
        ...style,
        // The preview is its own little viewport — frame it as a
        // surface card with a thin border, so the theme has room
        // to breathe.
        background: `var(--color-bg-canvas)`,
        color: `var(--color-fg)`,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        minHeight: '16rem',
        fontFamily: 'var(--font-sans)',
        transition:
          'background-color var(--motion-base) var(--ease-out), color var(--motion-base) var(--ease-out), border-color var(--motion-base) var(--ease-out)',
      }}
    >
      <p
        style={{
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-accent)',
          margin: 0,
          marginBottom: '0.5rem',
        }}
      >
        Field Notes
      </p>
      <h3
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1.25rem',
          lineHeight: 1.2,
          letterSpacing: '-0.015em',
          margin: 0,
          marginBottom: '0.5rem',
          color: 'var(--color-fg)',
        }}
      >
        Building a calmer CMS, one token at a time.
      </h3>
      <p
        style={{
          fontSize: '0.875rem',
          lineHeight: 1.55,
          color: 'var(--color-fg-muted)',
          margin: 0,
          marginBottom: '0.85rem',
        }}
      >
        A short paragraph rendered in the active theme — link, body, muted copy,
        and a primary action button, all sourced from the same token set.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.45rem 0.8rem',
            fontSize: '0.8rem',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent)',
            color: 'var(--color-fg-on-accent)',
            textDecoration: 'none',
            transition:
              'background-color var(--motion-base) var(--ease-out), color var(--motion-base) var(--ease-out)',
          }}
        >
          Read article
        </a>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.45rem 0.8rem',
            fontSize: '0.8rem',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg-surface)',
            color: 'var(--color-fg)',
            border: '1px solid var(--color-border)',
            textDecoration: 'none',
            transition:
              'background-color var(--motion-base) var(--ease-out), color var(--motion-base) var(--ease-out), border-color var(--motion-base) var(--ease-out)',
          }}
        >
          Bookmark
        </a>
      </div>
    </div>
  );
}
