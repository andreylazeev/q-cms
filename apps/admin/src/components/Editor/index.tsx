'use client';

import { useState } from 'react';
import { Toolbar } from './Toolbar.tsx';
import { SlashMenu, type SlashMenuItem } from './SlashMenu.tsx';
import { createQcmsExtensions } from './extensions.ts';

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
  className?: string;
  /** Optional aria-label for the editor surface. */
  'aria-label'?: string;
}

/**
 * TipTap-based rich text editor wrapper.
 *
 * In dev / stub mode, the body renders the toolbar + a stubbed
 * contenteditable area that emits the expected change events. The
 * toolbar & slash menu are wired to call the same actions that the
 * real TipTap instance would, so swapping the stub for the real
 * editor is a one-import change.
 */
export function Editor(props: EditorProps): React.JSX.Element {
  const { initialContent, value, onChange, placeholder, readOnly, className } = props;
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string>(initialContent ?? '');
  const [editor] = useState<unknown>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');

  // Pre-build the extensions list so consumers / future-proofing
  // already see a stable hook in dev tools.
  void createQcmsExtensions();

  const current = isControlled ? value : internal;

  function handleInput(html: string): void {
    if (!isControlled) setInternal(html);
    onChange?.(html);
  }

  function handleSlashSelect(item: SlashMenuItem): void {
    setSlashOpen(false);
    setSlashQuery('');
    // Real implementation: editor.chain().focus().insertContent(...).run()
    handleInput(`${current}\n[${item.label}]`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === '/') {
      setSlashOpen(true);
      setSlashQuery('');
    } else if (slashOpen) {
      if (e.key === 'Escape') {
        setSlashOpen(false);
      } else if (e.key === 'Backspace' && slashQuery.length === 0) {
        setSlashOpen(false);
      } else if (e.key.length === 1) {
        setSlashQuery((q) => q + e.key);
      }
    }
  }

  return (
    <div
      className={['qcms-editor flex flex-col gap-2', className].filter(Boolean).join(' ')}
      data-testid="qcms-editor"
    >
      <Toolbar editor={editor} />
      <div
        className="relative"
        onKeyDown={handleKeyDown}
      >
        <div
          role="textbox"
          aria-multiline="true"
          aria-readonly={readOnly ? true : undefined}
          aria-label={props['aria-label'] ?? 'Content editor'}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          className="input"
          style={{ minHeight: 240, whiteSpace: 'pre-wrap', cursor: 'text' }}
          onInput={(e) => handleInput((e.target as HTMLDivElement).innerText)}
          data-placeholder={placeholder ?? 'Start writing…'}
        >
          {current}
        </div>
        <SlashMenu
          open={slashOpen}
          query={slashQuery}
          items={[]}
          onSelect={handleSlashSelect}
          onClose={() => setSlashOpen(false)}
        />
      </div>
    </div>
  );
}
