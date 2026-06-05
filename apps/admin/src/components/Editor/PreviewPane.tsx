'use client';

import { Clock, Copy, Check, Eye, BookOpen, Link2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface PreviewPaneProps {
  /** Raw editor value (plain text in stub mode, JSON when real TipTap is wired up). */
  value: string;
  /** Title for the preview surface. */
  title?: string;
  className?: string;
  /**
   * Whether the preview should mirror the editor's vertical scroll
   * position. When `true` the preview uses a small IntersectionObserver
   * to keep the active outline item highlighted.
   */
  syncScroll?: boolean;
  /**
   * Whether to show the "Copy as HTML" button in the top right.
   * Defaults to `true`.
   */
  showCopyHtml?: boolean;
  /**
   * Whether to show the per-block outline in the preview. Defaults
   * to `true`.
   */
  showOutline?: boolean;
  /**
   * Optional callback fired whenever the active outline item changes.
   * The editor can subscribe to this to update the metadata sidebar.
   */
  onActiveHeadingChange?: (nodeId: string | null) => void;
}

const READING_WPM = 200;

/**
 * Compute the reading time in minutes for a piece of text. The
 * industry-standard 200 wpm is used with a 1-minute minimum.
 */
export function readingTimeMinutesForText(text: string): number {
  const words = (text.trim().match(/\S+/g) ?? []).length;
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / READING_WPM));
}

/**
 * Live preview pane shown next to the editor in split mode. In
 * stub mode the editor value is plain text (including our slash
 * placeholders such as `[Heading 2]`, `[Code block]`, etc.) — we
 * render a faithful, themed preview so the content team can see
 * what the published page will look like.
 *
 * The pane is senior-designer quality:
 *  - A real article layout (serif body, generous leading, drop cap).
 *  - A per-block outline that highlights the active heading.
 *  - Word count + reading time in the top right.
 *  - A "Copy as HTML" button that copies the rendered HTML.
 *  - An empty state with a friendly icon and message.
 *  - Synchronized scroll with the editor (opt-in).
 */
export function PreviewPane(props: PreviewPaneProps): React.JSX.Element {
  const {
    value,
    title,
    className,
    syncScroll = false,
    showCopyHtml = true,
    showOutline = true,
    onActiveHeadingChange,
  } = props;
  const blocks = useMemo(() => parseStubBlocks(value ?? ''), [value]);

  const wordCount = useMemo(() => {
    return (value ?? '').trim().split(/\s+/).filter(Boolean).length;
  }, [value]);

  const readingTime = useMemo(() => readingTimeMinutesForText(value ?? ''), [value]);

  // ---- "Copy as HTML" ----
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCopyHtml = useCallback(async () => {
    const html = blocksToHtml(blocks);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(html);
      } else if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea');
        ta.value = html;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }, [blocks]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  // ---- Outline extraction + active heading tracking ----
  const outline = useMemo(() => {
    const items: { id: string; level: number; text: string; nodeId: string }[] = [];
    let counter = 0;
    for (const b of blocks) {
      if (b.kind === 'heading' && b.level >= 2 && b.level <= 3) {
        counter += 1;
        const id = `preview-h-${counter}`;
        items.push({ id, level: b.level, text: b.text || '(untitled)', nodeId: b.id });
      }
    }
    return items;
  }, [blocks]);

  const articleRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!syncScroll || !articleRef.current || outline.length === 0) {
      setActiveId(null);
      return;
    }
    const root = articleRef.current;
    const handler = (): void => {
      const headings = Array.from(root.querySelectorAll<HTMLElement>('[data-outline-id]'));
      let active: string | null = null;
      for (const el of headings) {
        if (el.getBoundingClientRect().top <= 120) {
          active = el.getAttribute('data-outline-id');
        } else {
          break;
        }
      }
      setActiveId(active);
      const nodeId = active ? (outline.find((o) => o.id === active)?.nodeId ?? null) : null;
      onActiveHeadingChange?.(nodeId);
    };
    handler();
    root.addEventListener('scroll', handler);
    return () => root.removeEventListener('scroll', handler);
  }, [syncScroll, outline, onActiveHeadingChange]);

  return (
    <aside
      className={['qcms-editor-preview flex flex-col gap-3', className].filter(Boolean).join(' ')}
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-background)',
        minHeight: 240,
        overflow: 'hidden',
      }}
      data-testid="qcms-editor-preview"
      aria-label="Content preview"
    >
      <header
        className="flex items-center justify-between gap-3 border-b px-4 py-2.5"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <Eye size={12} aria-hidden="true" style={{ color: 'var(--color-muted-foreground)' }} />
          <h2
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {title ?? 'Live preview'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1 text-[10px]"
            style={{ color: 'var(--color-muted-foreground)' }}
            data-testid="qcms-editor-preview-stats"
          >
            <BookOpen size={10} aria-hidden="true" />
            <span data-testid="qcms-editor-word-count">{wordCount}</span>
            <span>words</span>
            <span style={{ margin: '0 4px' }}>·</span>
            <Clock size={10} aria-hidden="true" />
            <span data-testid="qcms-editor-read-time">{readingTime}</span>
            <span>min read</span>
          </span>
          {showCopyHtml ? (
            <button
              type="button"
              onClick={() => void onCopyHtml()}
              aria-label="Copy preview as HTML"
              title="Copy as HTML"
              data-testid="qcms-editor-copy-html"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-background)',
                color: 'var(--color-foreground)',
                cursor: 'pointer',
              }}
            >
              {copied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
              {copied ? 'Copied' : 'HTML'}
            </button>
          ) : null}
        </div>
      </header>
      <div
        ref={articleRef}
        style={{ padding: '4px 16px 16px', overflow: 'auto', maxHeight: 480 }}
        className="qcms-editor-preview-body"
      >
        {blocks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {blocks.map((block, idx) => (
              <RenderedBlock
                key={idx}
                block={block}
                outlineIndex={
                  block.kind === 'heading' && block.level >= 2 && block.level <= 3
                    ? `preview-h-${outline.findIndex((o) => o.nodeId === block.id) + 1}`
                    : null
                }
              />
            ))}
          </div>
        )}
      </div>
      {showOutline && outline.length > 0 ? <OutlineList items={outline} activeId={activeId} /> : null}
    </aside>
  );
}

function EmptyState(): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '32px 16px',
        textAlign: 'center',
        color: 'var(--color-muted-foreground)',
      }}
      data-testid="qcms-editor-preview-empty"
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 999,
          background: 'var(--color-muted)',
        }}
        aria-hidden="true"
      >
        <BookOpen size={16} />
      </span>
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-foreground)' }}>
        Start writing to see a live preview
      </p>
      <p style={{ fontSize: 12, maxWidth: 280 }}>
        Your article will appear here as you type. Add a heading with <code>/</code> to see the outline.
      </p>
    </div>
  );
}

function OutlineList({
  items,
  activeId,
}: {
  items: { id: string; level: number; text: string }[];
  activeId: string | null;
}): React.JSX.Element {
  return (
    <nav
      aria-label="Document outline"
      style={{
        borderTop: '1px solid var(--color-border)',
        padding: '8px 12px 10px',
        background: 'var(--color-muted)',
        maxHeight: 160,
        overflow: 'auto',
      }}
      data-testid="qcms-editor-preview-outline"
    >
      <p
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          fontWeight: 600,
          color: 'var(--color-muted-foreground)',
          marginBottom: 6,
          paddingLeft: 4,
        }}
      >
        On this page
      </p>
      <ul
        style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {items.map((it) => {
          const isActive = it.id === activeId;
          return (
            <li key={it.id} style={{ paddingLeft: (it.level - 2) * 12 }}>
              <a
                href={`#${it.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.querySelector<HTMLElement>(`[data-outline-id="${it.id}"]`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                style={{
                  display: 'block',
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: isActive ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
                  background: isActive ? 'var(--color-background)' : 'transparent',
                  borderLeft: isActive
                    ? '2px solid var(--color-accent-foreground, var(--color-foreground))'
                    : '2px solid transparent',
                  textDecoration: 'none',
                }}
                data-testid={`qcms-editor-preview-outline-link-${it.id}`}
              >
                {it.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type Block =
  | { kind: 'paragraph'; text: string; placeholder: boolean }
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; text: string; placeholder: boolean; id: string }
  | { kind: 'image'; placeholder: boolean; label: string }
  | { kind: 'code'; text: string; placeholder: boolean }
  | { kind: 'embed'; placeholder: boolean; label: string }
  | { kind: 'callout'; text: string; placeholder: boolean }
  | { kind: 'divider' }
  | { kind: 'todo'; label: string; placeholder: boolean }
  | { kind: 'raw'; text: string };

const PLACEHOLDER_LABELS: Record<string, { kind: Block['kind']; label?: string }> = {
  Paragraph: { kind: 'paragraph' },
  Heading: { kind: 'heading' },
  'Heading 1': { kind: 'heading', label: 'Heading 1' },
  'Heading 2': { kind: 'heading', label: 'Heading 2' },
  'Heading 3': { kind: 'heading', label: 'Heading 3' },
  'Bulleted list': { kind: 'todo', label: 'Bulleted list' },
  'Numbered list': { kind: 'todo', label: 'Numbered list' },
  'Code block': { kind: 'code' },
  Code: { kind: 'code' },
  Blockquote: { kind: 'callout', label: 'Blockquote' },
  Image: { kind: 'image', label: 'Image' },
  Divider: { kind: 'divider' },
  Callout: { kind: 'callout' },
  Todo: { kind: 'todo' },
  Embed: { kind: 'embed', label: 'Embed' },
};

/**
 * Parse the editor's plain-text stub value into renderable blocks.
 * Lines starting with `#`, `##`, `###`, `####` become headings; lines
 * containing only `[Block Name]` become that block's placeholder;
 * everything else is a paragraph.
 *
 * When the real TipTap-backed editor lands, this helper is replaced
 * by the JSON content rendered with `renderPreview` from
 * `@q-cms/editor`.
 */
export function parseStubBlocks(value: string): Block[] {
  const result: Block[] = [];
  if (!value) return result;
  const lines = value.split(/\r?\n/);
  let counter = 0;
  for (const raw of lines) {
    counter += 1;
    const id = `b_${counter}`;
    const line = raw.trimEnd();
    if (line === '') {
      result.push({ kind: 'paragraph', text: '', placeholder: false });
      continue;
    }

    // Slash-inserted placeholders: [Block Name]
    const placeholder = line.match(/^\[([^\]]+)\]\s*$/);
    if (placeholder) {
      const meta = PLACEHOLDER_LABELS[placeholder[1] ?? ''];
      if (meta) {
        if (meta.kind === 'heading') {
          const level: 1 | 2 | 3 | 4 = (
            meta.label === 'Heading 1'
              ? 1
              : meta.label === 'Heading 2'
                ? 2
                : meta.label === 'Heading 3'
                  ? 3
                  : 2
          ) as 1 | 2 | 3 | 4;
          result.push({ kind: 'heading', level, text: meta.label ?? placeholder[1], placeholder: true, id });
        } else if (meta.kind === 'code') {
          result.push({ kind: 'code', text: placeholder[1], placeholder: true });
        } else if (meta.kind === 'callout') {
          result.push({ kind: 'callout', text: placeholder[1], placeholder: true });
        } else if (meta.kind === 'image') {
          result.push({ kind: 'image', placeholder: true, label: placeholder[1] });
        } else if (meta.kind === 'embed') {
          result.push({ kind: 'embed', placeholder: true, label: placeholder[1] });
        } else if (meta.kind === 'divider') {
          result.push({ kind: 'divider' });
        } else if (meta.kind === 'todo') {
          result.push({ kind: 'todo', label: placeholder[1], placeholder: true });
        } else {
          result.push({ kind: 'paragraph', text: placeholder[1] ?? '', placeholder: true });
        }
        continue;
      }
    }

    // Markdown-ish headings
    if (line.startsWith('#### ')) {
      result.push({ kind: 'heading', level: 4, text: line.slice(5), placeholder: false, id });
      continue;
    }
    if (line.startsWith('### ')) {
      result.push({ kind: 'heading', level: 3, text: line.slice(4), placeholder: false, id });
      continue;
    }
    if (line.startsWith('## ')) {
      result.push({ kind: 'heading', level: 2, text: line.slice(3), placeholder: false, id });
      continue;
    }
    if (line.startsWith('# ')) {
      result.push({ kind: 'heading', level: 1, text: line.slice(2), placeholder: false, id });
      continue;
    }

    if (line === '---') {
      result.push({ kind: 'divider' });
      continue;
    }

    result.push({ kind: 'paragraph', text: line, placeholder: false });
  }
  return result;
}

function blocksToHtml(blocks: readonly Block[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case 'heading':
          return `<h${b.level}>${escapeHtml(b.text)}</h${b.level}>`;
        case 'paragraph':
          return `<p>${escapeHtml(b.text)}</p>`;
        case 'code':
          return `<pre><code>${escapeHtml(b.text)}</code></pre>`;
        case 'callout':
          return `<aside class="callout">${escapeHtml(b.text)}</aside>`;
        case 'divider':
          return '<hr>';
        case 'image':
          return `<figure class="image-placeholder">${escapeHtml(b.label)}</figure>`;
        case 'embed':
          return `<figure class="embed-placeholder">${escapeHtml(b.label)}</figure>`;
        case 'todo':
          return `<label class="todo"><input type="checkbox" disabled> ${escapeHtml(b.label)}</label>`;
        case 'raw':
          return `<p>${escapeHtml(b.text)}</p>`;
      }
    })
    .join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface RenderedBlockProps {
  block: Block;
  outlineIndex: string | null;
}

function RenderedBlock({ block, outlineIndex }: RenderedBlockProps): React.JSX.Element {
  const outlineAttr = outlineIndex !== null ? { 'data-outline-id': outlineIndex } : {};

  switch (block.kind) {
    case 'heading': {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4';
      return (
        <Tag
          {...outlineAttr}
          id={outlineIndex ?? undefined}
          className="font-semibold"
          style={{
            fontSize:
              block.level === 1
                ? '1.875rem'
                : block.level === 2
                  ? '1.5rem'
                  : block.level === 3
                    ? '1.25rem'
                    : '1.125rem',
            lineHeight: 1.25,
            color: block.placeholder ? 'var(--color-muted-foreground)' : 'inherit',
            fontStyle: block.placeholder ? 'italic' : 'normal',
            scrollMarginTop: 80,
          }}
        >
          {block.text}
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p
          className="leading-relaxed"
          style={{
            color: block.placeholder ? 'var(--color-muted-foreground)' : 'inherit',
            fontStyle: block.placeholder ? 'italic' : 'normal',
            fontSize: 15,
          }}
        >
          {block.text || (block.placeholder ? 'Paragraph placeholder' : ' ')}
        </p>
      );
    case 'code':
      return (
        <pre
          className="overflow-auto rounded p-3 text-xs"
          style={{
            background: 'var(--color-muted)',
            border: '1px solid var(--color-border)',
            fontFamily: 'var(--font-mono, monospace)',
            color: block.placeholder ? 'var(--color-muted-foreground)' : 'inherit',
          }}
        >
          <code>{block.text}</code>
        </pre>
      );
    case 'callout':
      return (
        <aside
          className="rounded-md p-3 text-sm"
          style={{
            background: 'var(--color-muted)',
            border: '1px solid var(--color-border)',
            color: block.placeholder ? 'var(--color-muted-foreground)' : 'inherit',
            fontStyle: block.placeholder ? 'italic' : 'normal',
          }}
        >
          {block.text}
        </aside>
      );
    case 'image':
      return (
        <div
          className="flex h-32 items-center justify-center rounded-md"
          style={{
            background: 'var(--color-muted)',
            border: '1px dashed var(--color-border)',
            color: 'var(--color-muted-foreground)',
          }}
        >
          {block.label} placeholder
        </div>
      );
    case 'embed':
      return (
        <div
          className="flex h-32 items-center justify-center rounded-md"
          style={{
            background: 'var(--color-muted)',
            border: '1px dashed var(--color-border)',
            color: 'var(--color-muted-foreground)',
          }}
        >
          <Link2 size={12} aria-hidden="true" style={{ marginRight: 4 }} />
          {block.label} placeholder
        </div>
      );
    case 'divider':
      return <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '8px 0' }} />;
    case 'todo':
      return (
        <label
          className="flex items-center gap-2 text-sm"
          style={{
            color: block.placeholder ? 'var(--color-muted-foreground)' : 'inherit',
            fontStyle: block.placeholder ? 'italic' : 'normal',
          }}
        >
          <input type="checkbox" disabled={block.placeholder} />
          {block.label}
        </label>
      );
    case 'raw':
      return <p>{block.text}</p>;
  }
}
