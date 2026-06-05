'use client';

import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';
import { runEditorAction } from './extensions.ts';

export interface ToolbarProps {
  /** Editor instance; `null` is acceptable in stub mode. */
  editor: unknown;
}

interface ToolButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive?: (editor: unknown) => boolean;
  onAction: (editor: unknown) => void;
}

type EditorLike = {
  isActive?: (name: string, attrs?: unknown) => boolean;
};

function buildButtons(): readonly ToolButton[] {
  return [
    {
      id: 'bold',
      label: 'Bold',
      icon: <Bold size={16} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('bold')),
      onAction: (e) => runEditorAction(e, 'bold'),
    },
    {
      id: 'italic',
      label: 'Italic',
      icon: <Italic size={16} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('italic')),
      onAction: (e) => runEditorAction(e, 'italic'),
    },
    {
      id: 'strike',
      label: 'Strikethrough',
      icon: <Strikethrough size={16} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('strike')),
      onAction: (e) => runEditorAction(e, 'strike'),
    },
    {
      id: 'h1',
      label: 'Heading 1',
      icon: <Heading1 size={16} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('heading', { level: 1 })),
      onAction: (e) => runEditorAction(e, 'h1'),
    },
    {
      id: 'h2',
      label: 'Heading 2',
      icon: <Heading2 size={16} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('heading', { level: 2 })),
      onAction: (e) => runEditorAction(e, 'h2'),
    },
    {
      id: 'ul',
      label: 'Bulleted list',
      icon: <List size={16} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('bulletList')),
      onAction: (e) => runEditorAction(e, 'bulletList'),
    },
    {
      id: 'ol',
      label: 'Numbered list',
      icon: <ListOrdered size={16} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('orderedList')),
      onAction: (e) => runEditorAction(e, 'orderedList'),
    },
    {
      id: 'quote',
      label: 'Blockquote',
      icon: <Quote size={16} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('blockquote')),
      onAction: (e) => runEditorAction(e, 'blockquote'),
    },
    {
      id: 'code',
      label: 'Code block',
      icon: <Code size={16} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('codeBlock')),
      onAction: (e) => runEditorAction(e, 'code'),
    },
    {
      id: 'link',
      label: 'Link',
      icon: <LinkIcon size={16} />,
      isActive: (e) => Boolean((e as EditorLike | null)?.isActive?.('link')),
      onAction: (e) => runEditorAction(e, 'link'),
    },
    {
      id: 'image',
      label: 'Image',
      icon: <ImageIcon size={16} />,
      onAction: (e) => runEditorAction(e, 'image'),
    },
    {
      id: 'undo',
      label: 'Undo',
      icon: <Undo2 size={16} />,
      onAction: (e) => runEditorAction(e, 'undo'),
    },
    {
      id: 'redo',
      label: 'Redo',
      icon: <Redo2 size={16} />,
      onAction: (e) => runEditorAction(e, 'redo'),
    },
  ];
}

export function Toolbar({ editor }: ToolbarProps): React.JSX.Element {
  const buttons = buildButtons();
  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-md border p-1"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-muted)' }}
      role="toolbar"
      aria-label="Editor formatting"
      data-testid="editor-toolbar"
    >
      {buttons.map((b) => {
        const active = editor ? b.isActive?.(editor) ?? false : false;
        return (
          <button
            key={b.id}
            type="button"
            className="btn btn-ghost"
            style={{
              minWidth: 32,
              padding: '0.25rem 0.5rem',
              background: active ? 'var(--color-accent)' : 'transparent',
            }}
            aria-label={b.label}
            aria-pressed={active}
            title={b.label}
            onClick={() => b.onAction(editor)}
          >
            {b.icon}
          </button>
        );
      })}
    </div>
  );
}
