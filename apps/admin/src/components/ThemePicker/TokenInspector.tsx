'use client';

/**
 * TokenInspector — a Linear / Radix-style token viewer.
 *
 * A read-only grid of every meaningful token in the active theme:
 * colors, spacing steps, radii, shadows, motion, type sizes. The
 * idea: a designer (or a curious developer) can hover any cell and
 * see the exact value, the resolved CSS, and the variable name.
 *
 * Not editable — the registry is the source of truth.
 *
 * @packageDocumentation
 */

import type { DesignTokens, ThemeDefinition } from '@q-cms/theme';
import type { ReactElement } from 'react';
import { useMemo } from 'react';

export interface TokenInspectorProps {
  /** The theme whose tokens we want to inspect. */
  theme: ThemeDefinition;
  /**
   * The mode to render in. `'dark'` shows the dark variant of the
   * theme (or the light tokens, if no dark override exists).
   */
  mode?: 'light' | 'dark';
  className?: string;
}

/* ---------------------------------------------------------------------------
 * Token groupings — every entry is `(label, key)` so the inspector
 * can render in a stable, designer-friendly order.
 * ------------------------------------------------------------------------- */

interface ColorEntry {
  label: string;
  key: keyof DesignTokens;
}

const COLOR_GROUPS: readonly { title: string; items: readonly ColorEntry[] }[] = [
  {
    title: 'Backgrounds',
    items: [
      { label: 'canvas', key: 'color-bg-canvas' },
      { label: 'surface', key: 'color-bg-surface' },
      { label: 'surface-raised', key: 'color-bg-surface-raised' },
      { label: 'overlay', key: 'color-bg-overlay' },
    ],
  },
  {
    title: 'Foreground',
    items: [
      { label: 'fg', key: 'color-fg' },
      { label: 'fg-muted', key: 'color-fg-muted' },
      { label: 'fg-subtle', key: 'color-fg-subtle' },
      { label: 'fg-on-accent', key: 'color-fg-on-accent' },
    ],
  },
  {
    title: 'Borders',
    items: [
      { label: 'border', key: 'color-border' },
      { label: 'border-strong', key: 'color-border-strong' },
      { label: 'focus-ring', key: 'color-focus-ring' },
    ],
  },
  {
    title: 'Brand',
    items: [
      { label: 'accent', key: 'color-accent' },
      { label: 'accent-hover', key: 'color-accent-hover' },
      { label: 'accent-soft', key: 'color-accent-soft' },
      { label: 'link', key: 'color-link' },
      { label: 'link-hover', key: 'color-link-hover' },
    ],
  },
  {
    title: 'Status',
    items: [
      { label: 'success', key: 'color-success' },
      { label: 'success-soft', key: 'color-success-soft' },
      { label: 'warning', key: 'color-warning' },
      { label: 'warning-soft', key: 'color-warning-soft' },
      { label: 'danger', key: 'color-danger' },
      { label: 'danger-soft', key: 'color-danger-soft' },
    ],
  },
];

const SPACING_KEYS: readonly { label: string; key: keyof DesignTokens }[] = [
  { label: '0', key: 'space-0' },
  { label: '1', key: 'space-1' },
  { label: '2', key: 'space-2' },
  { label: '3', key: 'space-3' },
  { label: '4', key: 'space-4' },
  { label: '6', key: 'space-6' },
  { label: '8', key: 'space-8' },
  { label: '12', key: 'space-12' },
  { label: '16', key: 'space-16' },
  { label: '24', key: 'space-24' },
  { label: '32', key: 'space-32' },
  { label: '48', key: 'space-48' },
];

const RADIUS_KEYS: readonly { label: string; key: keyof DesignTokens }[] = [
  { label: 'none', key: 'radius-none' },
  { label: 'sm', key: 'radius-sm' },
  { label: 'md', key: 'radius-md' },
  { label: 'lg', key: 'radius-lg' },
  { label: 'xl', key: 'radius-xl' },
  { label: 'full', key: 'radius-full' },
];

const SHADOW_KEYS: readonly { label: string; key: keyof DesignTokens }[] = [
  { label: '1', key: 'shadow-1' },
  { label: '2', key: 'shadow-2' },
  { label: '3', key: 'shadow-3' },
  { label: '4', key: 'shadow-4' },
];

const MOTION_KEYS: readonly { label: string; key: keyof DesignTokens }[] = [
  { label: 'fast', key: 'motion-fast' },
  { label: 'base', key: 'motion-base' },
  { label: 'slow', key: 'motion-slow' },
  { label: 'ease-out', key: 'ease-out' },
  { label: 'ease-in', key: 'ease-in' },
  { label: 'ease-in-out', key: 'ease-in-out' },
];

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function tokensFor(theme: ThemeDefinition, mode: 'light' | 'dark'): DesignTokens {
  if (mode === 'dark' && theme.dark) return theme.dark;
  return theme.tokens;
}

/** True when a value is a transparent / rgba token. */
function isAlphaColor(value: string): boolean {
  return /rgba?\(|hsla?\(/.test(value);
}

/* ---------------------------------------------------------------------------
 * Sub-blocks
 * ------------------------------------------------------------------------- */

function ColorSwatch({
  label,
  value,
  index,
}: {
  label: string;
  value: string;
  index: number;
}): ReactElement {
  // Use a checkered background for alpha colors so the swatch
  // doesn't disappear on the parent's surface.
  const isAlpha = isAlphaColor(value);
  const swatchStyle: React.CSSProperties = isAlpha
    ? {
        backgroundColor: value,
        backgroundImage:
          'linear-gradient(45deg, rgba(0,0,0,0.05) 25%, transparent 25%), linear-gradient(-45deg, rgba(0,0,0,0.05) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.05) 75%), linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.05) 75%)',
        backgroundSize: '8px 8px',
        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
      }
    : { backgroundColor: value };
  return (
    <div
      data-token-index={index}
      title={`--${label}: ${value}`}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}
    >
      <div
        style={{
          width: '100%',
          height: '1.75rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          ...swatchStyle,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.25rem' }}>
        <code
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--color-fg-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </code>
        <code
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            color: 'var(--color-fg-subtle)',
            whiteSpace: 'nowrap',
          }}
        >
          {value.length > 9 ? `${value.slice(0, 9)}…` : value}
        </code>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactElement;
}): ReactElement {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        padding: '0.85rem',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <h4
        style={{
          margin: 0,
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-fg-muted)',
        }}
      >
        {title}
      </h4>
      {children}
    </section>
  );
}

function ValueCell({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div
      title={`--${label}: ${value}`}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}
    >
      <code
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--color-fg-muted)',
        }}
      >
        {label}
      </code>
      <code
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          color: 'var(--color-fg)',
        }}
      >
        {value}
      </code>
    </div>
  );
}

function SpacingBlock({ value }: { value: string }): ReactElement {
  // Render a small horizontal bar sized to the value so the
  // designer can eyeball the scale.
  return (
    <div
      style={{
        height: '0.4rem',
        width: value,
        maxWidth: '100%',
        background: 'var(--color-accent)',
        borderRadius: 'var(--radius-sm)',
        minWidth: '0.25rem',
      }}
    />
  );
}

function RadiusBlock({ value }: { value: string }): ReactElement {
  return (
    <div
      style={{
        width: '1.5rem',
        height: '1.5rem',
        background: 'var(--color-accent-soft)',
        border: '1px solid var(--color-accent)',
        borderRadius: value,
      }}
    />
  );
}

function ShadowBlock({ value }: { value: string }): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '2.25rem',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: value,
      }}
    />
  );
}

/* ---------------------------------------------------------------------------
 * Main component
 * ------------------------------------------------------------------------- */

export function TokenInspector({
  theme,
  mode = 'light',
  className,
}: TokenInspectorProps): ReactElement {
  const tokens = useMemo(() => tokensFor(theme, mode), [theme, mode]);

  return (
    <div
      data-testid="token-inspector"
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
    >
      {/* Colors */}
      {COLOR_GROUPS.map((group) => (
        <Section key={group.title} title={group.title}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(7.5rem, 1fr))',
              gap: '0.55rem',
            }}
          >
            {group.items.map((item, i) => {
              const v = tokens[item.key];
              if (typeof v !== 'string') return null;
              return (
                <ColorSwatch
                  key={item.key}
                  label={item.label}
                  value={v}
                  index={i}
                />
              );
            })}
          </div>
        </Section>
      ))}

      {/* Spacing */}
      <Section title="Spacing">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(5rem, 1fr))',
            gap: '0.5rem',
            alignItems: 'end',
          }}
        >
          {SPACING_KEYS.map((item) => {
            const v = tokens[item.key];
            if (typeof v !== 'string') return null;
            return (
              <div
                key={item.key}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}
              >
                <SpacingBlock value={v} />
                <ValueCell label={item.label} value={v} />
              </div>
            );
          })}
        </div>
      </Section>

      {/* Radius */}
      <Section title="Radius">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(4rem, 1fr))',
            gap: '0.55rem',
            alignItems: 'end',
          }}
        >
          {RADIUS_KEYS.map((item) => {
            const v = tokens[item.key];
            if (typeof v !== 'string') return null;
            return (
              <div
                key={item.key}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}
              >
                <RadiusBlock value={v} />
                <ValueCell label={item.label} value={v} />
              </div>
            );
          })}
        </div>
      </Section>

      {/* Shadow */}
      <Section title="Shadow">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(8rem, 1fr))',
            gap: '0.6rem',
          }}
        >
          {SHADOW_KEYS.map((item) => {
            const v = tokens[item.key];
            if (typeof v !== 'string') return null;
            return (
              <div
                key={item.key}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}
              >
                <ShadowBlock value={v} />
                <ValueCell label={item.label} value={v} />
              </div>
            );
          })}
        </div>
      </Section>

      {/* Motion */}
      <Section title="Motion">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(7rem, 1fr))',
            gap: '0.55rem',
          }}
        >
          {MOTION_KEYS.map((item) => {
            const v = tokens[item.key];
            if (typeof v !== 'string') return null;
            return (
              <ValueCell key={item.key} label={item.label} value={v} />
            );
          })}
        </div>
      </Section>
    </div>
  );
}
