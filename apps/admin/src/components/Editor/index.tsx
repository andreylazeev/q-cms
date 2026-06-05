'use client';

import { ExternalLink, FileText, Hash, Settings2, AlertTriangle, Plus } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  useBlockLibrary,
  type BlockDescriptor,
  type BlockCategory,
  type BlockValidationIssue,
  extractEntryMetadata,
  summarizeBlocks,
  type JSONContent,
} from '@q-cms/editor';
import { Toolbar } from './Toolbar.tsx';
import { SlashMenu, type SlashMenuItem } from './SlashMenu.tsx';
import { BlockHandle, type BlockAction } from './BlockHandle.tsx';
import { PreviewPane } from './PreviewPane.tsx';
import { createQcmsExtensions, parseSlashCommand, runEditorAction } from './extensions.ts';

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
  /**
   * If set, a "Preview" link is shown in the toolbar that opens
   * the standalone preview page in a new tab.
   */
  previewHref?: string;
  /**
   * Editor layout:
   *  - `'split'` (default) — editor + preview side-by-side
   *  - `'three-pane'`     — metadata sidebar / editor / preview
   *  - `'editor'`         — editor only
   *  - `'preview'`        — preview only
   */
  layout?: 'split' | 'three-pane' | 'editor' | 'preview';
  /**
   * The current entry's data payload. When set, the metadata
   * sidebar renders a "Page settings" panel with the entry's
   * title, slug, status, locale, SEO, and cover.
   */
  entryData?: Record<string, unknown> | null;
  /**
   * Block-level validation issues to display in the metadata
   * sidebar. When supplied the sidebar shows a "Block issues"
   * card with each issue's message and a "Jump to block" link.
   */
  validationIssues?: readonly BlockValidationIssue[];
  /**
   * When `true`, the preview pane synchronizes its scroll position
   * with the editor. Defaults to `false`.
   */
  syncPreviewScroll?: boolean;
}

/** Identifiers we use as the top-level block separators. */
interface TopLevelBlock {
  id: string;
  /** Source line (the raw text including any `[Block Name]` placeholder). */
  raw: string;
  /** The block type if this is a slash-inserted placeholder, else `null`. */
  placeholderType: string | null;
  /** Best-effort label for the block handle. */
  label: string;
  /** The block type parsed from the markdown-ish prefix, if any. */
  inferredKind: 'heading' | 'divider' | 'paragraph' | 'placeholder';
}

function describeBlock(raw: string): {
  placeholderType: string | null;
  label: string;
  inferredKind: TopLevelBlock['inferredKind'];
} {
  const placeholder = raw.match(/^\[([^\]]+)\]\s*$/);
  if (placeholder) {
    return {
      placeholderType: placeholder[1] ?? null,
      label: placeholder[1] ?? 'Block',
      inferredKind: 'placeholder',
    };
  }
  if (raw.startsWith('#### '))
    return { placeholderType: null, label: `H4 — ${raw.slice(5).slice(0, 40)}`, inferredKind: 'heading' };
  if (raw.startsWith('### '))
    return { placeholderType: null, label: `H3 — ${raw.slice(4).slice(0, 40)}`, inferredKind: 'heading' };
  if (raw.startsWith('## '))
    return { placeholderType: null, label: `H2 — ${raw.slice(3).slice(0, 40)}`, inferredKind: 'heading' };
  if (raw.startsWith('# '))
    return { placeholderType: null, label: `H1 — ${raw.slice(2).slice(0, 40)}`, inferredKind: 'heading' };
  if (raw === '---') return { placeholderType: 'divider', label: 'Divider', inferredKind: 'divider' };
  if (raw.trim() === '') return { placeholderType: null, label: 'Empty', inferredKind: 'paragraph' };
  return { placeholderType: null, label: raw.slice(0, 40), inferredKind: 'paragraph' };
}

function splitTopLevelBlocks(value: string): TopLevelBlock[] {
  if (!value) return [];
  const lines = value.split('\n');
  return lines.map((raw, idx) => {
    const meta = describeBlock(raw);
    return {
      id: `b_${idx + 1}`,
      raw,
      ...meta,
    };
  });
}

/**
 * TipTap-based rich text editor wrapper.
 *
 * In dev / stub mode, the body renders the toolbar + a stubbed
 * contenteditable area that emits the expected change events. The
 * toolbar & slash menu are wired to call the same actions that the
 * real TipTap instance would, so swapping the stub for the real
 * editor is a one-import change.
 *
 * The editor is split-pane by default but can be switched to a
 * 3-pane layout (metadata sidebar / editor / preview) by passing
 * `layout="three-pane"`. The 3-pane is responsive — the metadata
 * sidebar is hidden below the `lg` breakpoint.
 */
export function Editor(props: EditorProps): React.JSX.Element {
  const {
    initialContent,
    value,
    onChange,
    placeholder,
    readOnly,
    className,
    previewHref,
    layout = 'split',
    entryData = null,
    validationIssues = [],
    syncPreviewScroll = false,
  } = props;
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string>(initialContent ?? '');
  const [editor] = useState<unknown>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashAnchor, setSlashAnchor] = useState<{ x: number; y: number } | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [activePreviewHeading, setActivePreviewHeading] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  // Pre-build the extensions list so consumers / future-proofing
  // already see a stable hook in dev tools.
  void createQcmsExtensions();

  // Pull the slash-menu items from the editor package's block library
  // when available, falling back to a minimal default set so the
  // menu is still useful in environments where the package import
  // is intentionally tree-shaken.
  const library = useBlockLibrarySafe();

  const current = isControlled ? value : internal;
  const blocks = useMemo(() => splitTopLevelBlocks(current ?? ''), [current]);
  const blockSummary = useMemo(() => {
    const json = plainTextToStubJson(current ?? '');
    return summarizeBlocks(json);
  }, [current]);
  const metadata = useMemo(() => extractEntryMetadata(entryData), [entryData]);

  const handleInput = useCallback(
    (next: string): void => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  const insertBlock = useCallback(
    (item: SlashMenuItem): void => {
      if (item.id === '__clear__') {
        setSlashOpen(false);
        setSlashQuery('');
        return;
      }
      setSlashOpen(false);
      setSlashQuery('');
      handleInput(`${current ?? ''}\n[${item.label}]`);
    },
    [current, handleInput],
  );

  const runBlockAction = useCallback(
    (action: BlockAction, nodeId: string): boolean => {
      const idx = blocks.findIndex((b) => b.id === nodeId);
      if (idx === -1) return false;
      const lines = [...blocks.map((b) => b.raw)];
      switch (action) {
        case 'duplicate': {
          lines.splice(idx + 1, 0, lines[idx] ?? '');
          break;
        }
        case 'delete': {
          lines.splice(idx, 1);
          break;
        }
        case 'move-up': {
          if (idx === 0) return false;
          const swap = lines[idx - 1];
          lines[idx - 1] = lines[idx] ?? '';
          lines[idx] = swap ?? '';
          break;
        }
        case 'move-down': {
          if (idx === lines.length - 1) return false;
          const swap = lines[idx + 1];
          lines[idx + 1] = lines[idx] ?? '';
          lines[idx] = swap ?? '';
          break;
        }
      }
      handleInput(lines.join('\n'));
      return true;
    },
    [blocks, handleInput],
  );

  const handleBlockInput = useCallback(
    (nodeId: string, text: string): void => {
      const idx = blocks.findIndex((b) => b.id === nodeId);
      if (idx === -1) return;
      const lines = blocks.map((b) => b.raw);
      lines[idx] = text.replace(/\r\n?/g, '\n');
      handleInput(lines.join('\n'));
    },
    [blocks, handleInput],
  );

  const handleInsertBelow = useCallback((nodeId: string, anchor: { x: number; y: number }) => {
    setFocusedBlockId(nodeId);
    setSlashAnchor(anchor);
    setSlashOpen(true);
    setSlashQuery('');
    // Pre-focus the editor surface so the user can type into the menu.
    surfaceRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === '/') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setSlashAnchor({ x: rect.left + 16, y: rect.bottom });
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

  // ---- Render layout ----
  const showMeta = layout === 'three-pane';
  const showEditor = layout === 'split' || layout === 'three-pane' || layout === 'editor';
  const showPreview = layout === 'split' || layout === 'three-pane' || layout === 'preview';

  const editorSurface = showEditor ? (
    <div className="flex flex-col gap-3" data-testid="qcms-editor-pane">
      <Toolbar editor={editor}>
        {previewHref ? (
          <a
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs"
            style={{ color: 'var(--color-muted-foreground)' }}
            data-testid="editor-preview-link"
          >
            <ExternalLink size={12} aria-hidden="true" /> Preview
          </a>
        ) : null}
      </Toolbar>
      <div
        className="relative flex flex-col gap-2"
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const blockEl = target.closest<HTMLElement>('[data-block-id]');
          if (blockEl) {
            setFocusedBlockId(blockEl.getAttribute('data-block-id'));
          }
        }}
      >
        {/* Per-block handles — slide in on hover/focus. */}
        {blocks.length > 0 ? (
          <div className="flex flex-col gap-2" aria-label="Block handles" data-testid="block-handles">
            {blocks.map((b) => {
              const desc = lookupDescriptor(library.byName, b);
              const label = b.label.length > 32 ? `${b.label.slice(0, 32)}…` : b.label;
              return (
                <div
                  key={b.id}
                  data-block-id={b.id}
                  onFocusCapture={() => setFocusedBlockId(b.id)}
                  style={{
                    position: 'relative',
                    borderRadius: 8,
                    padding: '4px 8px 4px 96px',
                    border: '1px solid transparent',
                    transition: 'background-color 100ms, border-color 100ms',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--color-muted)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <BlockHandle
                    nodeId={b.id}
                    label={label}
                    icon={desc ? <CategoryGlyph category={desc.category} /> : null}
                    thumbnail={desc?.thumbnail}
                    focused={focusedBlockId === b.id}
                    onAction={runBlockAction}
                    onInsertBelow={handleInsertBelow}
                  />
                  <div
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    onInput={(e) => handleBlockInput(b.id, e.currentTarget.textContent ?? '')}
                    style={{
                      minHeight: 24,
                      outline: 'none',
                      fontSize: 15,
                      lineHeight: 1.6,
                    }}
                    data-block-kind={b.inferredKind}
                    data-placeholder={placeholder ?? "Type '/' for blocks"}
                  >
                    {b.raw || ''}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyEditorHint
            onSlash={() => {
              const rect = surfaceRef.current?.getBoundingClientRect();
              setSlashAnchor({ x: (rect?.left ?? 24) + 16, y: rect?.bottom ?? 24 });
              setSlashOpen(true);
              setSlashQuery('');
            }}
          />
        )}
        {/* Hidden surface used to capture key events for the slash menu. */}
        <div
          ref={surfaceRef}
          tabIndex={-1}
          aria-hidden="true"
          onKeyDown={handleKeyDown}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
        />
        <SlashMenu
          open={slashOpen}
          query={slashQuery}
          items={library.menuItems}
          onSelect={insertBlock}
          onClose={() => setSlashOpen(false)}
          {...(slashAnchor ? { anchor: slashAnchor } : {})}
        />
      </div>
    </div>
  ) : null;

  const previewSurface = showPreview ? (
    <PreviewPane
      value={current ?? ''}
      title="Live preview"
      syncScroll={syncPreviewScroll}
      onActiveHeadingChange={setActivePreviewHeading}
    />
  ) : null;

  const metaSurface = showMeta ? (
    <MetadataSidebar
      blocks={blockSummary}
      metadata={metadata}
      issues={validationIssues}
      activeHeadingNodeId={activePreviewHeading}
      onInsertBlock={(anchor) => {
        setSlashAnchor(anchor);
        setSlashOpen(true);
        setSlashQuery('');
      }}
    />
  ) : null;

  return (
    <div
      className={['qcms-editor flex flex-col gap-2', className].filter(Boolean).join(' ')}
      data-testid="qcms-editor"
      data-layout={layout}
    >
      {layout === 'split' || layout === 'three-pane' ? (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns:
              layout === 'three-pane'
                ? 'minmax(0, 240px) minmax(0, 1fr) minmax(0, 1fr)'
                : 'minmax(0, 1fr) minmax(0, 1fr)',
          }}
        >
          {metaSurface}
          {editorSurface}
          {previewSurface}
        </div>
      ) : (
        <div>{editorSurface ?? previewSurface}</div>
      )}
    </div>
  );
}

function lookupDescriptor(
  byName: (name: string) => BlockDescriptor | null,
  b: TopLevelBlock,
): BlockDescriptor | null {
  if (b.placeholderType) {
    return byName(b.placeholderType.toLowerCase().replace(/\s+/g, '')) ?? null;
  }
  if (b.inferredKind === 'heading') return byName('heading');
  if (b.inferredKind === 'divider') return byName('divider');
  return byName('paragraph');
}

function EmptyEditorHint({ onSlash }: { onSlash: () => void }): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '48px 16px',
        textAlign: 'center',
        color: 'var(--color-muted-foreground)',
        border: '1px dashed var(--color-border)',
        borderRadius: 12,
        background: 'var(--color-muted)',
      }}
      data-testid="qcms-editor-empty"
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 999,
          background: 'var(--color-background)',
          border: '1px solid var(--color-border)',
        }}
        aria-hidden="true"
      >
        <Plus size={18} />
      </span>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-foreground)' }}>Start your entry</p>
        <p style={{ fontSize: 12, maxWidth: 320, margin: '4px auto 0' }}>
          Type <code style={{ fontFamily: 'var(--font-mono, monospace)' }}>/</code> to open the block menu, or
          click below to add the first block.
        </p>
      </div>
      <button
        type="button"
        onClick={onSlash}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 6,
          background: 'var(--color-foreground)',
          color: 'var(--color-background)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <Plus size={14} aria-hidden="true" /> Add a block
      </button>
    </div>
  );
}

interface MetadataSidebarProps {
  blocks: ReturnType<typeof summarizeBlocks>;
  metadata: ReturnType<typeof extractEntryMetadata>;
  issues: readonly BlockValidationIssue[];
  activeHeadingNodeId: string | null;
  onInsertBlock: (anchor: { x: number; y: number }) => void;
}

function MetadataSidebar({
  blocks,
  metadata,
  issues,
  activeHeadingNodeId,
}: MetadataSidebarProps): React.JSX.Element {
  return (
    <aside
      className="hidden lg:flex flex-col gap-3"
      style={{ minWidth: 0 }}
      data-testid="qcms-editor-metadata"
    >
      <SidebarCard title="Page settings" icon={<Settings2 size={12} aria-hidden="true" />}>
        <SidebarRow label="Title" value={metadata.title || 'Untitled'} />
        <SidebarRow label="Slug" value={metadata.slug || '—'} mono />
        <SidebarRow label="Cover" value={metadata.coverId ?? '—'} mono />
        {metadata.tags.length > 0 ? <SidebarRow label="Tags" value={metadata.tags.join(', ')} /> : null}
        {metadata.seo.title || metadata.seo.description ? (
          <div
            style={{
              marginTop: 6,
              padding: 8,
              borderRadius: 8,
              background: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                color: 'var(--color-muted-foreground)',
              }}
            >
              SEO preview
            </p>
            <p
              style={{
                fontSize: 13,
                color: '#1a0dab',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: 4,
              }}
            >
              {metadata.seo.title || metadata.title || 'Untitled'}
            </p>
            <p style={{ fontSize: 11, color: '#006621' }}>q-cms.dev › articles › {metadata.slug || '—'}</p>
            <p
              style={{
                fontSize: 11,
                color: 'var(--color-muted-foreground)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                marginTop: 2,
              }}
            >
              {metadata.seo.description ||
                metadata.excerpt ||
                'Add a meta description for better search results.'}
            </p>
          </div>
        ) : null}
      </SidebarCard>

      <SidebarCard title="Outline" icon={<Hash size={12} aria-hidden="true" />}>
        {blocks.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
            Add a heading to see the outline.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {blocks.slice(0, 12).map((b) => {
              const isHeading = b.type === 'heading';
              const isActive = isHeading && b.id === activeHeadingNodeId;
              return (
                <li
                  key={b.id}
                  style={{
                    paddingLeft: isHeading ? 4 : 12,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: isActive ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
                    fontWeight: isHeading ? 500 : 400,
                  }}
                >
                  {isHeading ? (
                    <Hash size={10} aria-hidden="true" />
                  ) : (
                    <FileText size={10} aria-hidden="true" />
                  )}
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {b.label || '(empty)'}
                  </span>
                </li>
              );
            })}
            {blocks.length > 12 ? (
              <li style={{ fontSize: 11, color: 'var(--color-muted-foreground)', paddingLeft: 16 }}>
                +{blocks.length - 12} more
              </li>
            ) : null}
          </ul>
        )}
      </SidebarCard>

      {issues.length > 0 ? (
        <SidebarCard
          title="Block issues"
          icon={<AlertTriangle size={12} aria-hidden="true" />}
          tone="warning"
        >
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {issues.map((iss, idx) => (
              <li
                key={`${iss.blockName}-${iss.nodeId ?? idx}`}
                style={{
                  fontSize: 12,
                  padding: 8,
                  borderRadius: 6,
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.3)',
                }}
              >
                <p style={{ fontWeight: 500, color: 'var(--color-foreground)' }}>{iss.blockName}</p>
                <p style={{ color: 'var(--color-muted-foreground)' }}>{iss.message}</p>
              </li>
            ))}
          </ul>
        </SidebarCard>
      ) : null}
    </aside>
  );
}

function SidebarCard({
  title,
  icon,
  children,
  tone = 'neutral',
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: 'neutral' | 'warning';
}): React.JSX.Element {
  return (
    <section
      style={{
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 12,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
          color: tone === 'warning' ? 'var(--color-warning, #475569)' : 'var(--color-muted-foreground)',
        }}
      >
        {icon}
        <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {title}
        </h3>
      </header>
      <div>{children}</div>
    </section>
  );
}

function SidebarRow({
  label,
  value,
  mono,
}: { label: string; value: string; mono?: boolean }): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 4,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--color-muted-foreground)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          maxWidth: 160,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontFamily: mono ? 'var(--font-mono, monospace)' : 'inherit',
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Returns the block library as slash-menu items, or a small fallback
 * set when the editor package's `useBlockLibrary` is not wired up.
 * The fallback is keyed to look like a BlockDescriptor with a
 * category, so the grouped slash menu still works.
 */
function useBlockLibrarySafe(): {
  menuItems: readonly SlashMenuItem[];
  byName: (name: string) => BlockDescriptor | null;
} {
  let lib: ReturnType<typeof useBlockLibrary> | null = null;
  try {
    lib = useBlockLibrary();
  } catch {
    lib = null;
  }

  const fallback: readonly SlashMenuItem[] = useMemo(
    () => [
      {
        id: 'paragraph',
        label: 'Paragraph',
        description: 'Plain text block',
        category: 'Text',
        keywords: ['text', 'p'],
      },
      {
        id: 'heading',
        label: 'Heading',
        description: 'Section heading',
        category: 'Text',
        keywords: ['title'],
      },
      { id: 'callout', label: 'Callout', description: 'Highlighted info box', category: 'Text' },
      { id: 'image', label: 'Image', description: 'Inline image', category: 'Media', keywords: ['photo'] },
      { id: 'divider', label: 'Divider', description: 'Horizontal rule', category: 'Media' },
      { id: 'todo', label: 'Todo', description: 'Single checklist item', category: 'Lists' },
      { id: 'code', label: 'Code', description: 'Monospace block', category: 'Lists', keywords: ['pre'] },
      {
        id: 'embed',
        label: 'Embed',
        description: 'YouTube / Vimeo / Twitter',
        category: 'Embeds',
        keywords: ['video'],
      },
    ],
    [],
  );

  if (!lib) {
    return { menuItems: fallback, byName: () => null };
  }

  const items: SlashMenuItem[] = lib.blocks.map((b) => {
    const item: SlashMenuItem = {
      id: b.name,
      label: b.label,
      category: b.category,
    };
    if (b.description !== undefined) item.description = b.description;
    if (b.keywords !== undefined) item.keywords = b.keywords;
    if (b.tags !== undefined) item.tags = b.tags;
    if (b.shortcut !== undefined) item.shortcut = b.shortcut;
    if (b.thumbnail !== undefined) item.thumbnail = b.thumbnail;
    return item;
  });
  return { menuItems: items, byName: (name) => lib?.byName(name) ?? null };
}

function CategoryGlyph({ category }: { category: BlockCategory }): React.JSX.Element {
  const symbol: Record<BlockCategory, string> = {
    Text: 'T',
    Media: 'M',
    Lists: 'L',
    Embeds: 'E',
    Advanced: 'A',
  };
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold"
      style={{
        background: 'var(--color-accent)',
        color: 'var(--color-accent-foreground, white)',
      }}
    >
      {symbol[category]}
    </span>
  );
}

// Re-export the toolbar action helper so consumers and tests can
// import it from a single place.
export { runEditorAction, parseSlashCommand, createQcmsExtensions };

// Re-export the SlashMenu / BlockHandle types so consumers don't
// have to dig into the inner modules.
export type { SlashMenuItem, BlockAction, BlockHandle };

/** Convert the editor's plain-text stub value into a JSON doc. */
function plainTextToStubJson(body: string): JSONContent {
  if (!body) return { type: 'doc', content: [] };
  const lines = body.split(/\r?\n/);
  const content: JSONContent[] = [];
  let counter = 0;
  for (const raw of lines) {
    const line = raw.trimEnd();
    counter += 1;
    const id = `b_${counter}`;
    if (line === '') {
      content.push({ type: 'paragraph', attrs: { id }, content: [] });
      continue;
    }
    if (line.startsWith('#### ')) {
      content.push({
        type: 'heading',
        attrs: { id, level: 4 },
        content: [{ type: 'text', text: line.slice(5) }],
      });
      continue;
    }
    if (line.startsWith('### ')) {
      content.push({
        type: 'heading',
        attrs: { id, level: 3 },
        content: [{ type: 'text', text: line.slice(4) }],
      });
      continue;
    }
    if (line.startsWith('## ')) {
      content.push({
        type: 'heading',
        attrs: { id, level: 2 },
        content: [{ type: 'text', text: line.slice(3) }],
      });
      continue;
    }
    if (line.startsWith('# ')) {
      content.push({
        type: 'heading',
        attrs: { id, level: 1 },
        content: [{ type: 'text', text: line.slice(2) }],
      });
      continue;
    }
    if (line === '---') {
      content.push({ type: 'horizontalRule', attrs: { id } });
      continue;
    }
    content.push({ type: 'paragraph', attrs: { id }, content: [{ type: 'text', text: line }] });
  }
  return { type: 'doc', content };
}
