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
      <span className="pb-palette-card__thumb" aria-hidden="true">
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
 * inside a 56×56 viewBox; strokes use `currentColor` so the card
 * palette can drive the foreground.
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
      return (
        <svg {...props}>
          <rect x="6" y="9" width="20" height="3" rx="1" />
          <rect x="6" y="15" width="14" height="2" rx="1" />
          <rect x="6" y="20" width="18" height="2" rx="1" />
          <rect x="6" y="26" width="10" height="4" rx="1" />
          <rect x="26" y="6" width="8" height="28" rx="1" />
        </svg>
      );
    case 'articleGrid':
      return (
        <svg {...props}>
          <rect x="5" y="8" width="9" height="14" rx="1" />
          <rect x="16" y="8" width="9" height="14" rx="1" />
          <rect x="27" y="8" width="9" height="14" rx="1" />
          <rect x="5" y="24" width="3" height="1" />
          <rect x="16" y="24" width="3" height="1" />
          <rect x="27" y="24" width="3" height="1" />
        </svg>
      );
    case 'articleList':
      return (
        <svg {...props}>
          <rect x="5" y="8" width="4" height="4" rx="1" />
          <rect x="11" y="9" width="22" height="1.5" rx="0.5" />
          <rect x="11" y="12" width="14" height="1.5" rx="0.5" />
          <rect x="5" y="18" width="4" height="4" rx="1" />
          <rect x="11" y="19" width="22" height="1.5" rx="0.5" />
          <rect x="11" y="22" width="14" height="1.5" rx="0.5" />
          <rect x="5" y="28" width="4" height="4" rx="1" />
          <rect x="11" y="29" width="22" height="1.5" rx="0.5" />
        </svg>
      );
    case 'authorCard':
      return (
        <svg {...props}>
          <circle cx="11" cy="14" r="4" />
          <rect x="17" y="10" width="14" height="1.5" rx="0.5" />
          <rect x="17" y="14" width="10" height="1.5" rx="0.5" />
          <rect x="6" y="22" width="28" height="8" rx="1" />
        </svg>
      );
    case 'authorBio':
      return (
        <svg {...props}>
          <circle cx="11" cy="14" r="5" />
          <rect x="19" y="10" width="14" height="2" rx="0.5" />
          <rect x="19" y="14" width="14" height="1.5" rx="0.5" />
          <rect x="19" y="18" width="10" height="1.5" rx="0.5" />
          <rect x="5" y="25" width="30" height="5" rx="1" />
        </svg>
      );
    case 'categoryList':
      return (
        <svg {...props}>
          <rect x="4" y="9" width="9" height="5" rx="2.5" />
          <rect x="15" y="9" width="9" height="5" rx="2.5" />
          <rect x="26" y="9" width="9" height="5" rx="2.5" />
          <rect x="4" y="18" width="9" height="5" rx="2.5" />
          <rect x="15" y="18" width="9" height="5" rx="2.5" />
          <rect x="26" y="18" width="9" height="5" rx="2.5" />
        </svg>
      );
    case 'richText':
      return (
        <svg {...props}>
          <rect x="6" y="9" width="6" height="6" rx="1" />
          <rect x="14" y="9" width="20" height="1.5" rx="0.5" />
          <rect x="14" y="13" width="16" height="1.5" rx="0.5" />
          <rect x="6" y="20" width="6" height="6" rx="1" />
          <rect x="14" y="20" width="20" height="1.5" rx="0.5" />
          <rect x="14" y="24" width="14" height="1.5" rx="0.5" />
        </svg>
      );
    case 'callToAction':
      return (
        <svg {...props}>
          <rect x="4" y="8" width="32" height="24" rx="2" />
          <rect x="9" y="14" width="14" height="2" rx="0.5" />
          <rect x="9" y="18" width="18" height="1.5" rx="0.5" />
          <rect x="9" y="24" width="10" height="4" rx="1" />
        </svg>
      );
    case 'imageBanner':
      return (
        <svg {...props}>
          <rect x="4" y="10" width="32" height="18" rx="1" />
          <circle cx="14" cy="18" r="3" />
          <path d="M12 26 L18 20 L24 26 L30 22 L34 26" />
        </svg>
      );
    case 'featureGrid':
      return (
        <svg {...props}>
          <rect x="4" y="8" width="9" height="9" rx="1" />
          <rect x="15.5" y="8" width="9" height="9" rx="1" />
          <rect x="27" y="8" width="9" height="9" rx="1" />
          <rect x="4" y="20" width="9" height="3" rx="0.5" />
          <rect x="15.5" y="20" width="9" height="3" rx="0.5" />
          <rect x="27" y="20" width="9" height="3" rx="0.5" />
        </svg>
      );
    case 'separator':
      return (
        <svg {...props}>
          <line x1="4" y1="14" x2="36" y2="14" />
          <line x1="4" y1="20" x2="36" y2="20" />
          <line x1="4" y1="26" x2="36" y2="26" />
        </svg>
      );
    case 'embed':
      return (
        <svg {...props}>
          <rect x="4" y="9" width="32" height="22" rx="1" />
          <polygon points="17,16 17,24 25,20" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
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
