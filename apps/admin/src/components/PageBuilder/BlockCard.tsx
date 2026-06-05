'use client';

/**
 * BlockCard — a single block on the canvas.
 *
 * The card replaces the original JSON dump with a structured
 * header + a 0.5× mini preview, so designers can see what they're
 * shipping without switching to the preview tab.
 *
 *   ┌────────────────────────────────────────────┐
 *   │ ⠿  ①  Hero             [↑][↓][⧉][🗑]      │  ← header
 *   │     content                                │
 *   │ ┌──────────────────────────────────────┐   │
 *   │ │        0.5× mini preview             │   │  ← body
 *   │ └──────────────────────────────────────┘   │
 *   │ 6 props configured                    ▸   │  ← footer
 *   └────────────────────────────────────────────┘
 *
 * The card is the only place we render the drag handle, but the
 * whole card is also a drop target so the user can drop a palette
 * block above or below an existing one.
 */

import * as Tooltip from '@radix-ui/react-tooltip';
import type { BlockSpec } from '@q-cms/templates';
import { type ReactNode, useState } from 'react';
import type { SdkTemplateSection } from '../../lib/stubs/api-client.ts';
import { cn } from '../../lib/utils.ts';
import { ChevronDown, ChevronRight, ChevronUp, Copy, Eye, GripVertical, Trash2 } from './icons.tsx';
import { MiniPreview } from './MiniPreview.tsx';

export interface BlockCardProps {
  section: SdkTemplateSection;
  spec: BlockSpec | undefined;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isSelected: boolean;
  isDropTarget: boolean;
  isDragging: boolean;
  /** Number of props that differ from defaults; used in the footer. */
  configuredPropCount: number;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleInline: (id: string) => void;
  isInlineExpanded: boolean;
  children?: ReactNode;
}

export function BlockCard({
  section,
  spec,
  index,
  isFirst,
  isLast,
  isSelected,
  isDropTarget,
  isDragging,
  configuredPropCount,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onToggleInline,
  isInlineExpanded,
  children,
}: BlockCardProps): React.JSX.Element {
  const [dragging, setDragging] = useState(false);
  const label = spec?.label ?? section.type;
  const description = spec?.description ?? '';

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the card is a visual drop target; selection is mirrored on the inner Settings-style button which is keyboard-operable
    <article
      className={cn(
        'pb-block-card',
        isSelected && 'pb-block-card--selected',
        isDropTarget && 'pb-block-card--drop',
        (dragging || isDragging) && 'pb-block-card--dragging',
      )}
      onClick={() => onSelect(section.id)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      data-testid={`canvas-section-${section.id}`}
      data-selected={isSelected}
    >
      <header className="pb-block-card__head">
        <button
          type="button"
          className="pb-block-card__handle"
          aria-label={`Reorder ${label}`}
          title="Drag to reorder"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-qcms-section-id', section.id);
            e.dataTransfer.effectAllowed = 'move';
            setDragging(true);
          }}
          onDragEnd={() => setDragging(false)}
          onClick={(e) => e.stopPropagation()}
          data-testid={`canvas-handle-${section.id}`}
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
        <div className="pb-block-card__meta">
          <span className="pb-block-card__index" aria-hidden="true">
            {index + 1}
          </span>
          <div className="pb-block-card__title-wrap">
            <p className="pb-block-card__label">{label}</p>
            <p className="pb-block-card__type">{description || section.type}</p>
          </div>
        </div>
        <div className="pb-block-card__toolbar" onMouseDown={(e) => e.stopPropagation()}>
          <Tooltip.Provider delayDuration={250}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  onClick={() => onMove(section.id, 'up')}
                  disabled={isFirst}
                  className="pb-icon-btn"
                  aria-label={`Move ${label} up`}
                  data-testid={`canvas-up-${section.id}`}
                >
                  <ChevronUp size={16} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="pb-tooltip" sideOffset={4}>
                  Move up
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  onClick={() => onMove(section.id, 'down')}
                  disabled={isLast}
                  className="pb-icon-btn"
                  aria-label={`Move ${label} down`}
                  data-testid={`canvas-down-${section.id}`}
                >
                  <ChevronDown size={16} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="pb-tooltip" sideOffset={4}>
                  Move down
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  onClick={() => onDuplicate(section.id)}
                  className="pb-icon-btn"
                  aria-label={`Duplicate ${label}`}
                  data-testid={`canvas-duplicate-${section.id}`}
                >
                  <Copy size={16} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="pb-tooltip" sideOffset={4}>
                  Duplicate
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  onClick={() => onSelect(section.id)}
                  className="pb-icon-btn"
                  aria-label={`Edit ${label}`}
                  data-testid={`canvas-edit-${section.id}`}
                >
                  <Eye size={16} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="pb-tooltip" sideOffset={4}>
                  Open in inspector
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  onClick={() => onRemove(section.id)}
                  className="pb-icon-btn pb-icon-btn--danger"
                  aria-label={`Remove ${label}`}
                  data-testid={`canvas-remove-${section.id}`}
                >
                  <Trash2 size={16} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="pb-tooltip" sideOffset={4}>
                  Remove
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      </header>
      <div className="pb-block-card__body">
        <MiniPreview section={section} />
      </div>
      <footer className="pb-block-card__foot">
        <button
          type="button"
          className="pb-block-card__expand"
          onClick={(e) => {
            e.stopPropagation();
            onToggleInline(section.id);
          }}
          aria-expanded={isInlineExpanded}
          data-testid={`canvas-expand-${section.id}`}
        >
          <span className="pb-block-card__props-count">
            {configuredPropCount} {configuredPropCount === 1 ? 'prop' : 'props'} configured
          </span>
          {isInlineExpanded ? (
            <ChevronDown size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
        </button>
      </footer>
      {isInlineExpanded ? (
        <div className="pb-block-card__inline" data-testid={`canvas-inline-${section.id}`}>
          {children}
        </div>
      ) : null}
    </article>
  );
}
