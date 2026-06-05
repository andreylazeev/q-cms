/**
 * Local stub for `@q-cms/editor`. While the real package is built we
 * expose a minimal TipTap-free Editor component that renders plain
 * HTML in a styled `<textarea>`-ish surface.
 *
 * The real editor (TipTap-based) is expected to expose:
 *   - `<Editor />` — controlled rich-text editor
 *   - `<EditorToolbar />` — formatting toolbar
 *   - `<SlashMenu />` — `/`-trigger command menu
 *   - `extensions` — TipTap extension presets
 *
 * This stub keeps the public surface identical so consumers can
 * `import { Editor, EditorToolbar, SlashMenu, extensions }`
 * without code changes once the real package ships.
 */

import { type ReactElement, type ReactNode, useState } from 'react';

export interface EditorProps {
  /** Initial HTML content. */
  initialContent?: string;
  /** Current content (controlled). */
  value?: string;
  /** Called on every change. */
  onChange?: (html: string) => void;
  /** Placeholder text. */
  placeholder?: string;
  /** Disable the editor. */
  readOnly?: boolean;
  /** Additional class names. */
  className?: string;
  /** Aria label for accessibility. */
  'aria-label'?: string;
  /** Aria labelledby id. */
  'aria-labelledby'?: string;
  /** Aria describedby id. */
  'aria-describedby'?: string;
}

/**
 * Stub rich-text editor — falls back to a controlled `<textarea>`
 * styled to look like the editor surface. Replace with the real
 * TipTap-backed `<Editor />` when the package lands.
 */
export function Editor(props: EditorProps): ReactElement {
  const { initialContent, value, onChange, placeholder, readOnly, className } = props;
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string>(initialContent ?? '');
  const current = isControlled ? value : internal;
  const ariaProps: Record<string, string> = {};
  if (props['aria-label']) ariaProps['aria-label'] = props['aria-label'];
  if (props['aria-labelledby']) ariaProps['aria-labelledby'] = props['aria-labelledby'];
  if (props['aria-describedby']) ariaProps['aria-describedby'] = props['aria-describedby'];

  return (
    <div
      className={['qcms-editor', className].filter(Boolean).join(' ')}
      data-testid="qcms-editor"
    >
      <textarea
        className="input"
        style={{ minHeight: 240, fontFamily: 'var(--font-mono)' }}
        placeholder={placeholder ?? 'Start writing…'}
        readOnly={readOnly}
        value={current}
        onChange={(e) => {
          if (!isControlled) setInternal(e.target.value);
          onChange?.(e.target.value);
        }}
        {...ariaProps}
      />
    </div>
  );
}

export interface EditorToolbarProps {
  /** Optional callback to receive the active editor instance. */
  onAction?: (action: string) => void;
  className?: string;
}

export function EditorToolbar(props: EditorToolbarProps): ReactElement {
  const buttons: { label: string; action: string }[] = [
    { label: 'B', action: 'bold' },
    { label: 'I', action: 'italic' },
    { label: 'U', action: 'underline' },
    { label: 'H1', action: 'h1' },
    { label: 'H2', action: 'h2' },
    { label: '•', action: 'bulletList' },
    { label: '1.', action: 'orderedList' },
    { label: '"', action: 'blockquote' },
    { label: '<>', action: 'code' },
    { label: '↶', action: 'undo' },
    { label: '↷', action: 'redo' },
  ];
  return (
    <div
      className={['qcms-editor-toolbar', props.className].filter(Boolean).join(' ')}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        padding: 8,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-muted)',
      }}
      role="toolbar"
      aria-label="Editor formatting"
    >
      {buttons.map((b) => (
        <button
          key={b.action}
          type="button"
          className="btn btn-ghost"
          style={{ minWidth: 32, padding: '0.25rem 0.5rem' }}
          onClick={() => props.onAction?.(b.action)}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

export interface SlashMenuProps {
  open: boolean;
  query: string;
  onSelect: (command: string) => void;
  className?: string;
}

export function SlashMenu(props: SlashMenuProps): ReactElement | null {
  if (!props.open) return null;
  const items = [
    { id: 'paragraph', label: 'Paragraph' },
    { id: 'heading-1', label: 'Heading 1' },
    { id: 'heading-2', label: 'Heading 2' },
    { id: 'bullet-list', label: 'Bulleted list' },
    { id: 'image', label: 'Image' },
    { id: 'code', label: 'Code block' },
  ].filter((it) => it.label.toLowerCase().includes(props.query.toLowerCase()));
  return (
    <div
      className={['qcms-slash-menu', props.className].filter(Boolean).join(' ')}
      role="listbox"
      aria-label="Insert block"
      style={{
        position: 'absolute',
        zIndex: 50,
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        padding: 4,
        minWidth: 180,
      }}
    >
      {items.length === 0 ? (
        <div style={{ padding: 8, color: 'var(--color-muted-foreground)' }}>No results</div>
      ) : (
        items.map((it) => (
          <button
            key={it.id}
            type="button"
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={() => props.onSelect(it.id)}
          >
            {it.label}
          </button>
        ))
      )}
    </div>
  );
}

/** TipTap extension presets — stub returns an empty array. */
export const extensions: readonly unknown[] = Object.freeze([]);
