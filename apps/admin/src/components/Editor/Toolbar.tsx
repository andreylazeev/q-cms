'use client';

import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  Highlighter,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { runEditorAction } from './extensions.ts';

export interface ToolbarProps {
  /** Editor instance; `null` is acceptable in stub mode. */
  editor: unknown;
  /** Optional content rendered after the toolbar buttons (e.g. a "Preview" link). */
  children?: ReactNode;
}

interface ToolButton {
  id: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  isActive?: (editor: unknown) => boolean;
  onAction: (editor: unknown) => void;
  /** When true, the button is hidden in the default view and lives in the "More" overflow. */
  overflow?: boolean;
}

type EditorLike = {
  isActive?: (name: string, attrs?: unknown) => boolean;
};

function buildButtons(): readonly ToolButton[] {
  return [
    {
      id: 'bold',
      label: 'Bold',
      icon: <Bold size={15} />,
      shortcut: '⌘B',
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('bold')),
      onAction: (e) => runEditorAction(e, 'bold'),
    },
    {
      id: 'italic',
      label: 'Italic',
      icon: <Italic size={15} />,
      shortcut: '⌘I',
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('italic')),
      onAction: (e) => runEditorAction(e, 'italic'),
    },
    {
      id: 'strike',
      label: 'Strikethrough',
      icon: <Strikethrough size={15} />,
      shortcut: '⌘⇧X',
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('strike')),
      onAction: (e) => runEditorAction(e, 'strike'),
      overflow: true,
    },
    {
      id: 'highlight',
      label: 'Highlight',
      icon: <Highlighter size={15} />,
      shortcut: '⌘⇧H',
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('highlight')),
      onAction: (e) => runEditorAction(e, 'highlight'),
    },
    {
      id: 'code',
      label: 'Inline code',
      icon: <Code size={15} />,
      shortcut: '⌘E',
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('code')),
      onAction: (e) => runEditorAction(e, 'code'),
    },
    {
      id: 'link',
      label: 'Link',
      icon: <LinkIcon size={15} />,
      shortcut: '⌘K',
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('link')),
      onAction: (e) => runEditorAction(e, 'link'),
    },
    { id: 'divider-1', label: '', icon: null, onAction: () => {} },
    {
      id: 'h1',
      label: 'Heading 1',
      icon: <Heading1 size={15} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('heading', { level: 1 })),
      onAction: (e) => runEditorAction(e, 'h1'),
    },
    {
      id: 'h2',
      label: 'Heading 2',
      icon: <Heading2 size={15} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('heading', { level: 2 })),
      onAction: (e) => runEditorAction(e, 'h2'),
    },
    {
      id: 'h3',
      label: 'Heading 3',
      icon: <Heading3 size={15} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('heading', { level: 3 })),
      onAction: (e) => runEditorAction(e, 'h3'),
      overflow: true,
    },
    { id: 'divider-2', label: '', icon: null, onAction: () => {} },
    {
      id: 'ul',
      label: 'Bulleted list',
      icon: <List size={15} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('bulletList')),
      onAction: (e) => runEditorAction(e, 'bulletList'),
    },
    {
      id: 'ol',
      label: 'Numbered list',
      icon: <ListOrdered size={15} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('orderedList')),
      onAction: (e) => runEditorAction(e, 'orderedList'),
    },
    {
      id: 'quote',
      label: 'Blockquote',
      icon: <Quote size={15} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('blockquote')),
      onAction: (e) => runEditorAction(e, 'quote'),
    },
    { id: 'divider-3', label: '', icon: null, onAction: () => {} },
    {
      id: 'image',
      label: 'Image',
      icon: <ImageIcon size={15} />,
      onAction: (e) => runEditorAction(e, 'image'),
    },
    {
      id: 'undo',
      label: 'Undo',
      icon: <Undo2 size={15} />,
      shortcut: '⌘Z',
      onAction: (e) => runEditorAction(e, 'undo'),
      overflow: true,
    },
    {
      id: 'redo',
      label: 'Redo',
      icon: <Redo2 size={15} />,
      shortcut: '⌘⇧Z',
      onAction: (e) => runEditorAction(e, 'redo'),
      overflow: true,
    },
  ];
}

/** Slim, icon-only toolbar. Hidden buttons are reachable via the "More" overflow. */
export function Toolbar({ editor, children }: ToolbarProps): React.JSX.Element {
  const buttons = buildButtons();
  const visible = buttons.filter((b) => !b.overflow);
  const overflow = buttons.filter((b) => b.overflow);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 rounded-md border p-1"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-muted)' }}
      role="toolbar"
      aria-label="Editor formatting"
      data-testid="editor-toolbar"
    >
      {visible.map((b) => {
        if (b.id.startsWith('divider')) {
          return (
            <span
              key={b.id}
              aria-hidden="true"
              style={{ width: 1, height: 18, background: 'var(--color-border)', margin: '0 4px' }}
            />
          );
        }
        const active = editor ? (b.isActive?.(editor) ?? false) : false;
        return (
          <ToolBtn
            key={b.id}
            label={b.label}
            icon={b.icon}
            active={active}
            shortcut={b.shortcut}
            onClick={() => b.onAction(editor)}
          />
        );
      })}
      {overflow.length > 0 ? (
        <div style={{ position: 'relative' }}>
          <ToolBtn
            label="More"
            icon={<span style={{ fontSize: 14, fontWeight: 600 }}>⋯</span>}
            onClick={() => setMoreOpen((o) => !o)}
            hasPopup
            active={moreOpen}
          />
          {moreOpen ? (
            <div
              role="menu"
              aria-label="More formatting"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                zIndex: 40,
                background: 'var(--color-background)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                padding: 4,
                minWidth: 180,
                display: 'flex',
                flexDirection: 'column',
              }}
              data-testid="editor-toolbar-more"
            >
              {overflow.map((b) => {
                const active = editor ? (b.isActive?.(editor) ?? false) : false;
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                      b.onAction(editor);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: active ? 'var(--color-accent)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ display: 'inline-flex', width: 16 }}>{b.icon}</span>
                    <span style={{ flex: 1 }}>{b.label}</span>
                    {b.shortcut ? (
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--color-muted-foreground)',
                          fontFamily: 'var(--font-mono, monospace)',
                        }}
                      >
                        {b.shortcut}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

interface ToolBtnProps {
  label: string;
  icon: ReactNode;
  active?: boolean | undefined;
  shortcut?: string | undefined;
  onClick: () => void;
  hasPopup?: boolean | undefined;
}

function ToolBtn({ label, icon, active, shortcut, onClick, hasPopup }: ToolBtnProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={active}
      aria-haspopup={hasPopup ? 'menu' : undefined}
      onClick={onClick}
      data-testid={`editor-tool-${label.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 28,
        height: 28,
        padding: '0 6px',
        borderRadius: 6,
        border: active
          ? '1px solid var(--color-accent-foreground, var(--color-foreground))'
          : '1px solid transparent',
        background: active ? 'var(--color-accent)' : 'transparent',
        color: 'var(--color-foreground)',
        cursor: 'pointer',
        transition: 'background-color 80ms, border-color 80ms',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-accent)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {icon}
    </button>
  );
}
