'use client';

/**
 * BlockPaletteCard — a single draggable card in the left palette.
 *
 * Visual:
 *   ┌────────────────────────────────────┐
 *   │  ┌─────┐  Hero                     │
 *   │  │ SVG │  content                  │
 *   │  └─────┘                           │
 *   └────────────────────────────────────┘
 *
 * The thumbnail is a tiny inline SVG that hints at the block's
 * structure (text + image for hero, three cards for grid, etc.).
 * Inline SVGs avoid an extra HTTP request per block and let us
 * recolor them via `currentColor`.
 */

import type { BlockSpec } from '@q-cms/templates';
import { cn } from '../../lib/utils.ts';
import { GripVertical } from './icons.tsx';

export interface BlockPaletteCardProps {
  spec: BlockSpec;
  onAdd: (spec: BlockSpec) => void;
  onDragStart: (spec: BlockSpec) => void;
}

export function BlockPaletteCard({ spec, onAdd, onDragStart }: BlockPaletteCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-qcms-block-type', spec.type);
        e.dataTransfer.effectAllowed = 'copy';
        onDragStart(spec);
      }}
      onDragEnd={() => onDragStart(null as unknown as BlockSpec)}
      onClick={() => onAdd(spec)}
      className={cn('pb-palette-card')}
      title={spec.description}
      data-testid={`palette-add-${spec.type}`}
      aria-label={`Add ${spec.label} block`}
    >
      <span
        className="pb-palette-card__thumb"
        aria-hidden="true"
        data-testid={`palette-thumb-${spec.type}`}
      >
        <BlockThumb type={spec.type} />
      </span>
      <span className="pb-palette-card__body">
        <span className="pb-palette-card__label">{spec.label}</span>
        <span className="pb-palette-card__type">{spec.type}</span>
      </span>
      <span className="pb-palette-card__grip" aria-hidden="true">
        <GripVertical size={12} />
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * BlockThumb — minimal, theme-aware SVG glyphs for each block type. Drawn
 * inside a 40×40 viewBox; strokes use `currentColor` and accent fills use
 * `currentColor` with low opacity. Each thumb mirrors the structure of the
 * real block (text bars + image square for hero, three cards for the
 * article grid, etc.) so a designer can tell the blocks apart at a glance.
 * ------------------------------------------------------------------------- */

function BlockThumb({ type }: { type: string }): React.JSX.Element {
  const props = {
    width: 40,
    height: 40,
    viewBox: '0 0 40 40',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (type) {
    case 'hero':
      // Eyebrow + headline + cta-pill on the left, image square on the right.
      return (
        <svg {...props}>
          <rect x="3" y="8" width="20" height="3" rx="1" />
          <rect x="3" y="13" width="16" height="2" rx="0.5" />
          <rect x="3" y="17" width="20" height="2" rx="0.5" />
          <rect x="3" y="22" width="9" height="3.5" rx="1" fill="currentColor" fillOpacity="0.25" stroke="none" />
          <rect x="25" y="6" width="12" height="28" rx="1.5" fill="currentColor" fillOpacity="0.1" />
        </svg>
      );
    case 'articleGrid':
      // Three cover+title cards, plus a "more →" line.
      return (
        <svg {...props}>
          <rect x="3" y="6" width="10" height="13" rx="1" fill="currentColor" fillOpacity="0.15" />
          <rect x="3" y="22" width="7" height="2" rx="0.5" />
          <rect x="15" y="6" width="10" height="13" rx="1" fill="currentColor" fillOpacity="0.15" />
          <rect x="15" y="22" width="7" height="2" rx="0.5" />
          <rect x="27" y="6" width="10" height="13" rx="1" fill="currentColor" fillOpacity="0.15" />
          <rect x="27" y="22" width="7" height="2" rx="0.5" />
          <rect x="3" y="29" width="14" height="2" rx="0.5" />
        </svg>
      );
    case 'articleList':
      // Three rows: tiny thumb + 2 text lines each.
      return (
        <svg {...props}>
          <rect x="3" y="6" width="6" height="6" rx="1" fill="currentColor" fillOpacity="0.15" />
          <rect x="11" y="7" width="22" height="2" rx="0.5" />
          <rect x="11" y="11" width="14" height="1.5" rx="0.5" />
          <rect x="3" y="16" width="6" height="6" rx="1" fill="currentColor" fillOpacity="0.15" />
          <rect x="11" y="17" width="22" height="2" rx="0.5" />
          <rect x="11" y="21" width="14" height="1.5" rx="0.5" />
          <rect x="3" y="26" width="6" height="6" rx="1" fill="currentColor" fillOpacity="0.15" />
          <rect x="11" y="27" width="22" height="2" rx="0.5" />
          <rect x="11" y="31" width="14" height="1.5" rx="0.5" />
        </svg>
      );
    case 'authorCard':
      // Avatar ring + name/meta on the right, all inside a card frame.
      return (
        <svg {...props}>
          <rect x="3" y="6" width="34" height="28" rx="1.5" />
          <circle cx="10" cy="17" r="4" fill="currentColor" fillOpacity="0.2" />
          <rect x="17" y="13" width="16" height="2" rx="0.5" />
          <rect x="17" y="17" width="12" height="1.5" rx="0.5" />
          <rect x="17" y="20.5" width="14" height="1.5" rx="0.5" />
          <rect x="7" y="26" width="26" height="1.5" rx="0.5" />
        </svg>
      );
    case 'authorBio':
      // Large avatar + name/bio/large-frame variant.
      return (
        <svg {...props}>
          <rect x="3" y="6" width="34" height="28" rx="1.5" />
          <circle cx="11" cy="20" r="6" fill="currentColor" fillOpacity="0.2" />
          <rect x="20" y="13" width="14" height="2.5" rx="0.5" />
          <rect x="20" y="17.5" width="14" height="1.5" rx="0.5" />
          <rect x="20" y="20.5" width="10" height="1.5" rx="0.5" />
          <rect x="20" y="24" width="13" height="2" rx="0.5" />
        </svg>
      );
    case 'categoryList':
      // Pill grid: 3 + 2.
      return (
        <svg {...props}>
          <rect x="3" y="7" width="10" height="6" rx="3" fill="currentColor" fillOpacity="0.18" />
          <rect x="15" y="7" width="10" height="6" rx="3" fill="currentColor" fillOpacity="0.18" />
          <rect x="27" y="7" width="10" height="6" rx="3" fill="currentColor" fillOpacity="0.18" />
          <rect x="3" y="17" width="10" height="6" rx="3" />
          <rect x="15" y="17" width="10" height="6" rx="3" />
          <rect x="3" y="27" width="10" height="6" rx="3" />
        </svg>
      );
    case 'richText':
      // Drop-cap block + heading + body lines, two columns.
      return (
        <svg {...props}>
          <rect x="3" y="6" width="5" height="5" rx="0.5" fill="currentColor" fillOpacity="0.25" stroke="none" />
          <rect x="10" y="6" width="22" height="2" rx="0.5" />
          <rect x="10" y="10" width="24" height="1.5" rx="0.5" />
          <rect x="10" y="13" width="20" height="1.5" rx="0.5" />
          <rect x="3" y="20" width="28" height="2" rx="0.5" />
          <rect x="3" y="25" width="32" height="1.5" rx="0.5" />
          <rect x="3" y="29" width="30" height="1.5" rx="0.5" />
          <rect x="3" y="33" width="22" height="1.5" rx="0.5" />
        </svg>
      );
    case 'callToAction':
      // Rounded card with headline + button.
      return (
        <svg {...props}>
          <rect x="2" y="6" width="36" height="28" rx="2" fill="currentColor" fillOpacity="0.1" />
          <rect x="6" y="11" width="20" height="3" rx="0.5" />
          <rect x="6" y="17" width="24" height="1.5" rx="0.5" />
          <rect x="6" y="20" width="18" height="1.5" rx="0.5" />
          <rect x="6" y="26" width="11" height="5" rx="1" fill="currentColor" fillOpacity="0.4" stroke="none" />
        </svg>
      );
    case 'imageBanner':
      // Image with a sun + mountain horizon + caption bar.
      return (
        <svg {...props}>
          <rect x="2" y="6" width="36" height="22" rx="1" fill="currentColor" fillOpacity="0.1" />
          <circle cx="11" cy="14" r="2.5" />
          <path d="M5 24 L13 17 L20 23 L28 18 L34 22" />
          <rect x="2" y="32" width="22" height="2" rx="0.5" />
        </svg>
      );
    case 'featureGrid':
      // 3 columns: small icon + title + 2 body lines each.
      return (
        <svg {...props}>
          <rect x="3" y="6" width="9" height="6" rx="1" fill="currentColor" fillOpacity="0.25" stroke="none" />
          <rect x="15.5" y="6" width="9" height="6" rx="1" fill="currentColor" fillOpacity="0.25" stroke="none" />
          <rect x="28" y="6" width="9" height="6" rx="1" fill="currentColor" fillOpacity="0.25" stroke="none" />
          <rect x="3" y="15" width="9" height="2" rx="0.5" />
          <rect x="15.5" y="15" width="9" height="2" rx="0.5" />
          <rect x="28" y="15" width="9" height="2" rx="0.5" />
          <rect x="3" y="20" width="9" height="1.5" rx="0.5" />
          <rect x="3" y="23" width="6" height="1.5" rx="0.5" />
          <rect x="15.5" y="20" width="9" height="1.5" rx="0.5" />
          <rect x="15.5" y="23" width="6" height="1.5" rx="0.5" />
          <rect x="28" y="20" width="9" height="1.5" rx="0.5" />
          <rect x="28" y="23" width="6" height="1.5" rx="0.5" />
        </svg>
      );
    case 'separator':
      // Three stacked thin lines so a single <line> doesn't look bare
      // at the 28×28 rendered size.
      return (
        <svg {...props}>
          <line x1="3" y1="14" x2="37" y2="14" />
          <line x1="3" y1="20" x2="37" y2="20" />
          <line x1="3" y1="26" x2="37" y2="26" />
        </svg>
      );
    case 'embed':
      // 16:9 box with play triangle + caption bar.
      return (
        <svg {...props}>
          <rect x="3" y="6" width="34" height="22" rx="1.5" fill="currentColor" fillOpacity="0.1" />
          <polygon points="17,13 17,21 25,17" fill="currentColor" stroke="none" />
          <rect x="3" y="31" width="20" height="2" rx="0.5" />
        </svg>
      );
    default:
      // Generic block: outer frame + 3 text bars.
      return (
        <svg {...props}>
          <rect x="6" y="6" width="28" height="28" rx="2" />
          <rect x="12" y="12" width="16" height="2" rx="0.5" />
          <rect x="12" y="18" width="12" height="2" rx="0.5" />
          <rect x="12" y="24" width="8" height="2" rx="0.5" />
        </svg>
      );
  }
}
