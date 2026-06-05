'use client';

import { Bold, Italic, Code, Link as LinkIcon, Highlighter } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { runEditorAction } from './extensions.ts';

export interface FloatingToolbarProps {
  /** Editor instance (TipTap-style). `null` is acceptable in stub mode. */
  editor: unknown;
  /** Whether the toolbar should be visible. */
  visible: boolean;
  /** Anchor position (viewport coords) for the toolbar. */
  position: { x: number; y: number };
}

interface ToolAction {
  id: 'bold' | 'italic' | 'code' | 'link' | 'highlight';
  label: string;
  icon: React.ReactNode;
}

const ACTIONS: readonly ToolAction[] = [
  { id: 'bold', label: 'Bold (⌘B)', icon: <Bold size={14} /> },
  { id: 'italic', label: 'Italic (⌘I)', icon: <Italic size={14} /> },
  { id: 'highlight', label: 'Highlight (⌘⇧H)', icon: <Highlighter size={14} /> },
  { id: 'code', label: 'Inline code (⌘E)', icon: <Code size={14} /> },
  { id: 'link', label: 'Link (⌘K)', icon: <LinkIcon size={14} /> },
];

type EditorLike = {
  isActive?: (name: string) => boolean;
};

/**
 * Notion-style floating toolbar that appears above the current
 * text selection. Renders with a 100-200 ms fade-in and is fully
 * keyboard-accessible (Tab through the buttons, Escape to dismiss).
 *
 * The toolbar is positioned at the selection rect. When the
 * selection is empty, the consumer should pass `visible={false}`.
 */
export function FloatingToolbar({ editor, visible, position }: FloatingToolbarProps): React.JSX.Element | null {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      // Defer mount so the fade-in animation runs.
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    }
    setMounted(false);
    return undefined;
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        // The editor itself can decide what Escape means; we just
        // emit a window event so the parent can hide us.
        window.dispatchEvent(new CustomEvent('qcms:floating-toolbar:escape'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!visible) return null;

  const e = editor as EditorLike | null;
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Text formatting"
      data-testid="floating-toolbar"
      style={{
        position: 'fixed',
        zIndex: 55,
        left: clampX(position.x - 120, 8, (typeof window !== 'undefined' ? window.innerWidth : 1024) - 248),
        top: Math.max(8, position.y - 44),
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 4,
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.05)',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(4px)',
        transition: 'opacity 100ms ease-out, transform 100ms ease-out',
      }}
    >
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-testid="floating-toolbar"] { transition: none !important; transform: none !important; opacity: 1 !important; }
        }
      `}</style>
      {ACTIONS.map((a) => {
        const active = Boolean(e?.isActive?.(a.id));
        return (
          <button
            key={a.id}
            type="button"
            aria-label={a.label}
            title={a.label}
            aria-pressed={active}
            onMouseDown={(e) => {
              e.preventDefault();
              runEditorAction(editor, a.id);
            }}
            data-testid={`floating-toolbar-${a.id}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              border: active ? '1px solid var(--color-accent-foreground, var(--color-foreground))' : '1px solid transparent',
              background: active ? 'var(--color-accent)' : 'transparent',
              color: 'var(--color-foreground)',
              cursor: 'pointer',
            }}
          >
            {a.icon}
          </button>
        );
      })}
    </div>
  );
}

function clampX(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(x, max));
}
