'use client';

import { ChevronUp, ChevronDown, Copy, Trash2, MoreHorizontal, Plus, GripVertical } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

export interface BlockHandleProps {
  /** Stable identifier for the block (e.g. `b_1`). */
  nodeId: string;
  /** Human-readable label, shown next to the handle. */
  label: string;
  /** Icon for the block. Optional. */
  icon?: ReactNode | undefined;
  /** Inline SVG thumbnail to render in the handle. */
  thumbnail?: string | undefined;
  /**
   * Callback the editor uses to mutate the document in response to
   * a handle action. Returns `true` if the action was applied.
   */
  onAction: (action: BlockAction, nodeId: string) => boolean | void;
  /**
   * Whether the handle should be visible. When `false` the handle
   * is hidden (used by the editor to wire hover/focus visibility).
   */
  visible?: boolean | undefined;
  /**
   * Called when the `+` button is clicked. The editor uses this to
   * open the slash menu anchored to the block.
   */
  onInsertBelow?: ((nodeId: string, anchor: { x: number; y: number }) => void) | undefined;
  /**
   * Whether this block is currently the focus of the editor (e.g. the
   * caret is on this block). When `true` the handle stays visible
   * even if the user moves the cursor off the row.
   */
  focused?: boolean | undefined;
}

export type BlockAction = 'duplicate' | 'delete' | 'move-up' | 'move-down';

/**
 * Floating handle on the left of each top-level block. The handle is
 * hidden by default and slides in (100 ms) when the parent block is
 * hovered, focused, or when this handle itself is hovered. A 200 ms
 * grace period prevents flicker when the user moves the cursor from
 * the block to the handle.
 *
 * The handle shows a drag grip, a `+` button to insert a new block
 * below, and a `…` popover with quick actions (duplicate, delete,
 * move up, move down).
 */
export function BlockHandle(props: BlockHandleProps): React.JSX.Element {
  const { nodeId, label, icon, thumbnail, onAction, onInsertBelow, visible = true, focused = false } = props;
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  function run(action: BlockAction): void {
    onAction(action, nodeId);
    setOpen(false);
  }

  function scheduleHide(): void {
    if (pinned) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHovered(false), 200);
  }

  function clearHide(): void {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }

  const isShown = visible && (hovered || open || focused);

  return (
    <div
      ref={containerRef}
      className="qcms-block-handle"
      data-testid={`block-handle-${nodeId}`}
      data-visible={isShown ? 'true' : 'false'}
      onMouseEnter={() => {
        clearHide();
        setHovered(true);
      }}
      onMouseLeave={scheduleHide}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        opacity: isShown ? 1 : 0,
        transform: isShown ? 'translateX(0)' : 'translateX(-4px)',
        transition: 'opacity 100ms ease-out, transform 100ms ease-out',
        pointerEvents: isShown ? 'auto' : 'none',
      }}
    >
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .qcms-block-handle { transition: none !important; transform: none !important; }
        }
      `}</style>
      <button
        type="button"
        aria-label="Drag block"
        title="Drag to reorder"
        data-testid={`block-handle-grip-${nodeId}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 24,
          borderRadius: 4,
          background: 'transparent',
          border: 'none',
          color: 'var(--color-muted-foreground)',
          cursor: 'grab',
        }}
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Insert block below"
        title="Insert below"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onInsertBelow?.(nodeId, { x: rect.left, y: rect.bottom });
        }}
        data-testid={`block-handle-plus-${nodeId}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 24,
          borderRadius: 4,
          background: 'transparent',
          border: 'none',
          color: 'var(--color-muted-foreground)',
          cursor: 'pointer',
        }}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
        style={{
          color: 'var(--color-foreground)',
          background: 'var(--color-muted)',
          border: '1px solid var(--color-border)',
        }}
        aria-label={`Block actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setPinned((p) => !p);
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            width: 14,
            height: 14,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {thumbnail ? (
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 14,
                height: 14,
                color: 'var(--color-muted-foreground)',
              }}
              dangerouslySetInnerHTML={{ __html: thumbnail }}
            />
          ) : (
            (icon ?? '◇')
          )}
        </span>
        <span className="font-medium">{label}</span>
        <MoreHorizontal size={12} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={`Actions for ${label}`}
          className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border p-1 text-sm shadow"
          style={{
            background: 'var(--color-background)',
            borderColor: 'var(--color-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          }}
          onMouseEnter={clearHide}
          onMouseLeave={scheduleHide}
        >
          <HandleMenuItem icon={<ChevronUp size={14} />} label="Move up" onClick={() => run('move-up')} />
          <HandleMenuItem
            icon={<ChevronDown size={14} />}
            label="Move down"
            onClick={() => run('move-down')}
          />
          <HandleMenuItem icon={<Copy size={14} />} label="Duplicate" onClick={() => run('duplicate')} />
          <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 2px' }} />
          <HandleMenuItem icon={<Trash2 size={14} />} label="Delete" onClick={() => run('delete')} danger />
        </div>
      ) : null}
    </div>
  );
}

interface HandleMenuItemProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function HandleMenuItem({ icon, label, onClick, danger }: HandleMenuItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left"
      style={{
        color: danger ? 'var(--color-danger, #dc2626)' : 'inherit',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--color-accent)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
      data-testid={`block-handle-action-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
