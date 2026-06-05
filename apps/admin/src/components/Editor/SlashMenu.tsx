'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

export interface SlashMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  keywords?: readonly string[];
}

export interface SlashMenuProps {
  open: boolean;
  query: string;
  items: readonly SlashMenuItem[];
  onSelect: (item: SlashMenuItem) => void;
  onClose: () => void;
  className?: string;
}

const DEFAULT_ITEMS: readonly SlashMenuItem[] = [
  { id: 'paragraph', label: 'Paragraph', description: 'Plain text block', keywords: ['text', 'p'] },
  { id: 'h1', label: 'Heading 1', description: 'Top-level heading', keywords: ['title'] },
  { id: 'h2', label: 'Heading 2', description: 'Subheading', keywords: ['sub'] },
  { id: 'h3', label: 'Heading 3', description: 'Section heading' },
  { id: 'ul', label: 'Bulleted list', description: 'Unordered list', keywords: ['bullet'] },
  { id: 'ol', label: 'Numbered list', description: 'Ordered list' },
  { id: 'code', label: 'Code block', description: 'Monospace block', keywords: ['pre'] },
  { id: 'quote', label: 'Blockquote', description: 'Indented quote' },
  { id: 'image', label: 'Image', description: 'Inline image', keywords: ['photo', 'picture'] },
  { id: 'divider', label: 'Divider', description: 'Horizontal rule' },
  { id: 'callout', label: 'Callout', description: 'Highlighted info box' },
];

export function SlashMenu(props: SlashMenuProps): React.JSX.Element | null {
  const { open, query, onSelect, onClose, className } = props;
  const items = props.items.length > 0 ? props.items : DEFAULT_ITEMS;
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filtered = items.filter((it) => {
    if (!query) return true;
    const haystack = `${it.label} ${(it.keywords ?? []).join(' ')}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => (filtered.length === 0 ? 0 : (h + 1) % filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => (filtered.length === 0 ? 0 : (h - 1 + filtered.length) % filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const choice = filtered[highlight];
        if (choice) onSelect(choice);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, highlight, onSelect, onClose]);

  if (!open) return null;
  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Insert block"
      className={['qcms-slash-menu', className].filter(Boolean).join(' ')}
      style={{
        position: 'absolute',
        zIndex: 50,
        minWidth: 240,
        maxHeight: 280,
        overflowY: 'auto',
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        padding: 4,
      }}
      data-testid="slash-menu"
    >
      {filtered.length === 0 ? (
        <div
          className="px-3 py-2 text-sm"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          No matches
        </div>
      ) : (
        filtered.map((it, idx) => (
          <button
            key={it.id}
            type="button"
            role="option"
            aria-selected={idx === highlight}
            onMouseEnter={() => setHighlight(idx)}
            onClick={() => onSelect(it)}
            className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
            style={{
              background: idx === highlight ? 'var(--color-accent)' : 'transparent',
            }}
          >
            <span aria-hidden="true" className="mt-0.5">
              {it.icon ?? '◆'}
            </span>
            <span className="flex flex-col">
              <span className="font-medium">{it.label}</span>
              {it.description ? (
                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  {it.description}
                </span>
              ) : null}
            </span>
          </button>
        ))
      )}
    </div>
  );
}
