'use client';

/**
 * Canvas — center column of the visual page builder.
 *
 * Hosts the ordered list of `BlockCard` sections and handles two
 * drag sources:
 *   1. Reorder — drag a section handle and drop on a sibling
 *   2. Insert — drag a palette card and drop on a section or on
 *      the empty drop zone at the end
 *
 * The Canvas is purely presentational — it receives `sections` and
 * emits `CanvasDragEvent` callbacks. The parent owns the spec
 * list and the actual mutation.
 */

import type { BlockSpec } from '@q-cms/templates';
import { getBlockSpec } from '@q-cms/templates';
import { useState, type ReactNode } from 'react';
import type { SdkTemplateSection } from '../../lib/stubs/api-client.ts';
import { BlockCard } from './BlockCard.tsx';
import { DeviceFrame } from './DeviceFrame.tsx';
import { type Device } from './DeviceSwitcher.tsx';
import { LayoutTemplate } from './icons.tsx';

export type CanvasDragEvent =
  | { kind: 'palette-add'; spec: BlockSpec; position: number }
  | { kind: 'reorder'; fromId: string; toId: string };

export interface CanvasProps {
  sections: ReadonlyArray<SdkTemplateSection>;
  selectedId: string | null;
  /** Active device frame; used to constrain the canvas. */
  device: Device;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDrop: (ev: CanvasDragEvent) => void;
  /** Per-section inline editor (expanded body) content, keyed by section id. */
  renderInline?: (id: string) => ReactNode;
  /** Set of section ids whose inline body is currently expanded. */
  expandedIds?: ReadonlySet<string>;
  onToggleInline?: (id: string) => void;
}

function countConfiguredProps(
  section: SdkTemplateSection,
  defaults: Record<string, unknown> | undefined,
): number {
  if (!defaults) return Object.keys(section.props ?? {}).length;
  const props = section.props ?? {};
  let n = 0;
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === '') continue;
    if (JSON.stringify(v) === JSON.stringify(defaults[k])) continue;
    n += 1;
  }
  return n;
}

export function Canvas({
  sections,
  selectedId,
  device,
  onSelect,
  onMove,
  onRemove,
  onDuplicate,
  onDrop,
  renderInline,
  expandedIds,
  onToggleInline,
}: CanvasProps): React.JSX.Element {
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function handleDragOver(ev: React.DragEvent, id: string | null): void {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  }

  function handleDropOnSection(ev: React.DragEvent, toId: string): void {
    ev.preventDefault();
    const fromSectionId = ev.dataTransfer.getData('application/x-qcms-section-id');
    const paletteType = ev.dataTransfer.getData('application/x-qcms-block-type');
    setDragOverId(null);
    if (fromSectionId) {
      onDrop({ kind: 'reorder', fromId: fromSectionId, toId });
    } else if (paletteType) {
      const spec = window.QCMS_BLOCK_REGISTRY?.get(paletteType);
      if (spec) {
        const idx = sections.findIndex((s) => s.id === toId);
        onDrop({ kind: 'palette-add', spec, position: idx === -1 ? sections.length : idx + 1 });
      }
    }
  }

  function handleDropOnEmpty(ev: React.DragEvent): void {
    ev.preventDefault();
    setDragOverId(null);
    const fromSectionId = ev.dataTransfer.getData('application/x-qcms-section-id');
    const paletteType = ev.dataTransfer.getData('application/x-qcms-block-type');
    if (fromSectionId) {
      onDrop({ kind: 'reorder', fromId: fromSectionId, toId: sections.at(-1)?.id ?? '' });
    } else if (paletteType) {
      const spec = window.QCMS_BLOCK_REGISTRY?.get(paletteType);
      if (spec) onDrop({ kind: 'palette-add', spec, position: sections.length });
    }
  }

  if (sections.length === 0) {
    return (
      <div className="pb-canvas-wrap" data-testid="page-builder-canvas">
        <DeviceFrame device={device} className="pb-canvas-device">
          <div
            className={`pb-canvas pb-canvas--empty ${dragOverId === null ? '' : 'pb-canvas--hot'}`}
            onDragOver={(e) => handleDragOver(e, null)}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => {
              e.preventDefault();
              handleDropOnEmpty(e);
            }}
          >
            <div className="pb-canvas__empty">
              <div className="pb-canvas__empty-art" aria-hidden="true">
                <LayoutTemplate size={48} />
              </div>
              <h3 className="pb-canvas__empty-title">Drag a block from the left →</h3>
              <p className="pb-canvas__empty-hint">Or click any card in the palette to add your first section.</p>
            </div>
          </div>
        </DeviceFrame>
      </div>
    );
  }

  return (
    <div className="pb-canvas-wrap" data-testid="page-builder-canvas">
      <DeviceFrame device={device} className="pb-canvas-device">
        <div className="pb-canvas">
          {sections.map((section, index) => {
            const spec = getBlockSpec(section.type);
            const isFirst = index === 0;
            const isLast = index === sections.length - 1;
            const isSelected = section.id === selectedId;
            const isDropTarget = dragOverId === section.id;
            const configured = countConfiguredProps(section, spec?.defaultProps);
            const isExpanded = expandedIds?.has(section.id) ?? false;
            return (
              <div
                key={section.id}
                onDragOver={(e) => handleDragOver(e, section.id)}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => handleDropOnSection(e, section.id)}
                className={isDropTarget ? 'pb-canvas__drop-slot pb-canvas__drop-slot--hot' : 'pb-canvas__drop-slot'}
              >
                <BlockCard
                  section={section}
                  spec={spec}
                  index={index}
                  isFirst={isFirst}
                  isLast={isLast}
                  isSelected={isSelected}
                  isDropTarget={false}
                  isDragging={false}
                  configuredPropCount={configured}
                  onSelect={onSelect}
                  onMove={onMove}
                  onDuplicate={onDuplicate}
                  onRemove={onRemove}
                  onToggleInline={(id) => onToggleInline?.(id)}
                  isInlineExpanded={isExpanded}
                >
                  {renderInline?.(section.id)}
                </BlockCard>
              </div>
            );
          })}
        </div>
      </DeviceFrame>
    </div>
  );
}

declare global {
  interface Window {
    QCMS_BLOCK_REGISTRY?: Map<string, BlockSpec>;
  }
}
