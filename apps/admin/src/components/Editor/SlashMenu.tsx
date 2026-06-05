'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface SlashMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  category?: string;
  keywords?: readonly string[];
  /** Search tags surfaced separately from `keywords`. */
  tags?: readonly string[];
  /** Keyboard shortcut hint (e.g. `H`, `Cmd+Opt+I`). */
  shortcut?: string;
  /** 24×24 inline SVG string rendered as the menu icon. */
  thumbnail?: string;
  /** Last-used timestamp (ms epoch). Used to order the "Recent" section. */
  lastUsedAt?: number;
}

export interface SlashMenuProps {
  open: boolean;
  query: string;
  items: readonly SlashMenuItem[];
  onSelect: (item: SlashMenuItem) => void;
  onClose: () => void;
  className?: string;
  /** Whether to group items under their category headings. */
  grouped?: boolean;
  /** storage key for "recent" items (session-scoped). */
  recentsKey?: string;
  /** Maximum number of recent items shown at the top. */
  recentsLimit?: number;
  /** Anchor position in viewport coordinates. */
  anchor?: { x: number; y: number };
}

const DEFAULT_ITEMS: readonly SlashMenuItem[] = [
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
    keywords: ['title', 'h1', 'h2', 'h3'],
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Highlighted info box',
    category: 'Text',
    keywords: ['note', 'info'],
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Inline image',
    category: 'Media',
    keywords: ['photo', 'picture'],
  },
  { id: 'divider', label: 'Divider', description: 'Horizontal rule', category: 'Media', keywords: ['line'] },
  {
    id: 'todo',
    label: 'Todo',
    description: 'Single checklist item',
    category: 'Lists',
    keywords: ['task', 'check'],
  },
  {
    id: 'code',
    label: 'Code',
    description: 'Monospace block',
    category: 'Lists',
    keywords: ['pre', 'snippet'],
  },
  {
    id: 'embed',
    label: 'Embed',
    description: 'YouTube / Vimeo / Twitter',
    category: 'Embeds',
    keywords: ['youtube', 'vimeo'],
  },
];

/** Canonical category order used to group items. */
const CATEGORY_ORDER = ['Text', 'Media', 'Lists', 'Embeds', 'Advanced'] as const;

interface FlatEntry {
  item: SlashMenuItem;
  flatIndex: number;
}

interface GroupedEntry {
  category: string;
  entries: FlatEntry[];
}

interface Position {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

/**
 * Compute a viewport-aware position for the popover. The popover
 * anchors at `(x, y)` (viewport coordinates) and prefers to render
 * below the anchor. If the popover would overflow the viewport
 * bottom it flips above the anchor. If it would overflow the
 * viewport right it shifts left.
 */
function positionPopover(
  anchor: { x: number; y: number },
  pop: { width: number; maxHeight: number },
): Position {
  const PAD = 8;
  const w = pop.width;
  const h = pop.maxHeight;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  let left = anchor.x;
  let top = anchor.y + 4;
  if (left + w + PAD > vw) left = Math.max(PAD, vw - w - PAD);
  if (top + h + PAD > vh) top = Math.max(PAD, anchor.y - h - 4);
  return { left, top, width: w, maxHeight: Math.min(h, vh - top - PAD) };
}

/**
 * Slash menu — shown when the user types `/` in the editor. Items can
 * be passed in by the editor (preferred) or fall back to a default
 * set so the menu is useful out of the box.
 *
 * When `grouped` is true the menu renders category headers (Text,
 * Media, Lists, Embeds, Advanced) using the same canonical order the
 * block library uses. Keyboard navigation moves through the flat
 * list of entries, not per-group.
 *
 * Recent items (the 3 most-recently used, by `lastUsedAt`) are
 * surfaced at the top in their own "Recent" group. They are
 * persisted to `sessionStorage` under `recentsKey` so the recency
 * list survives a page navigation within the same browser tab.
 */
export function SlashMenu(props: SlashMenuProps): React.JSX.Element | null {
  const {
    open,
    query,
    onSelect,
    onClose,
    className,
    grouped = true,
    recentsKey = 'qcms:slash-menu:recents',
    recentsLimit = 3,
    anchor,
  } = props;
  const items = props.items.length > 0 ? props.items : DEFAULT_ITEMS;
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Position | null>(null);
  const listboxId = useId();

  // ---- Recent items ----
  const recents = useMemo(() => {
    if (typeof window === 'undefined') return [] as SlashMenuItem[];
    try {
      const raw = window.sessionStorage.getItem(recentsKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<{ id: string; at: number }>;
      if (!Array.isArray(parsed)) return [];
      const map = new Map(items.map((it) => [it.id, it] as const));
      return parsed
        .map((r): SlashMenuItem | null => {
          const item = map.get(r.id);
          return item ? { ...item, lastUsedAt: r.at } : null;
        })
        .filter((x): x is SlashMenuItem => x !== null)
        .slice(0, recentsLimit);
    } catch {
      return [];
    }
  }, [recentsKey, recentsLimit, items]);

  // ---- Fuzzy search ----
  const ranked = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items.map((it) => ({ item: it, score: 0 }));
    }
    return items
      .map((it) => ({ item: it, score: scoreItem(it, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [items, query]);

  const { flat, groups } = useMemo(() => {
    const recentEntries: FlatEntry[] =
      recents.length > 0 && !query.trim() ? recents.map((it, idx) => ({ item: it, flatIndex: idx })) : [];
    const recentIds = new Set(recentEntries.map((e) => e.item.id));
    const baseEntries = ranked
      .filter((r) => !recentIds.has(r.item.id))
      .map((r, idx) => ({ item: r.item, flatIndex: recentEntries.length + idx }));

    const flatEntries = [...recentEntries, ...baseEntries];

    if (!grouped) {
      return { flat: flatEntries, groups: null as GroupedEntry[] | null };
    }

    const groupedEntries: GroupedEntry[] = [];
    if (recentEntries.length > 0) {
      groupedEntries.push({ category: 'Recent', entries: recentEntries });
    }

    const buckets = new Map<string, FlatEntry[]>();
    for (const entry of baseEntries) {
      const cat = entry.item.category ?? 'Advanced';
      const arr = buckets.get(cat) ?? [];
      arr.push(entry);
      buckets.set(cat, arr);
    }

    const orderedCats: string[] = [];
    for (const c of CATEGORY_ORDER) {
      if (buckets.has(c)) orderedCats.push(c);
    }
    for (const c of buckets.keys()) {
      if (!orderedCats.includes(c)) orderedCats.push(c);
    }
    for (const cat of orderedCats) {
      const bucket = buckets.get(cat) ?? [];
      groupedEntries.push({ category: cat, entries: bucket });
    }

    return { flat: flatEntries, groups: groupedEntries };
  }, [ranked, recents, query, grouped]);

  // ---- Highlight management ----
  useEffect(() => {
    setHighlight(0);
  }, [query, flat.length]);

  // ---- Keyboard nav ----
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => (flat.length === 0 ? 0 : (h + 1) % flat.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => (flat.length === 0 ? 0 : (h - 1 + flat.length) % flat.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const choice = flat[highlight]?.item;
        if (choice) {
          pushRecent(choice, recentsKey);
          onSelect(choice);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flat, highlight, onSelect, onClose, recentsKey]);

  // ---- Viewport-aware positioning ----
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const anchorPos = anchor ?? { x: 24, y: 24 };
    const width = 320;
    const maxHeight = 360;
    setPos(positionPopover(anchorPos, { width, maxHeight }));
  }, [open, anchor]);

  // ---- Scroll active item into view ----
  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(`[data-flat-index="${highlight}"]`);
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [highlight, open]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      role="listbox"
      id={listboxId}
      aria-label="Insert block"
      className={['qcms-slash-menu', className].filter(Boolean).join(' ')}
      style={{
        position: 'fixed',
        zIndex: 60,
        left: pos?.left ?? 24,
        top: pos?.top ?? 24,
        width: pos?.width ?? 320,
        maxHeight: pos?.maxHeight ?? 360,
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.05)',
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        // Senior-designer touch: a subtle fade-in that respects
        // prefers-reduced-motion.
        animation: 'qcms-slash-menu-in 120ms ease-out',
      }}
      data-testid="slash-menu"
    >
      <style>{`
        @keyframes qcms-slash-menu-in {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .qcms-slash-menu { animation: none !important; }
        }
      `}</style>
      <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
        {flat.length === 0 ? (
          <EmptyState query={query} onClear={() => onSelect({ id: '__clear__', label: 'Clear' })} />
        ) : grouped && groups ? (
          groups.map((group) => (
            <section key={group.category} aria-label={group.category} style={{ marginBottom: 4 }}>
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  background: 'var(--color-background)',
                  padding: '4px 8px 2px',
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  color: 'var(--color-muted-foreground)',
                }}
              >
                {group.category}
              </div>
              {group.entries.map((entry) => {
                const idx = entry.flatIndex;
                return (
                  <ItemButton
                    key={entry.item.id}
                    entry={entry}
                    isActive={idx === highlight}
                    onActivate={() => {
                      pushRecent(entry.item, recentsKey);
                      onSelect(entry.item);
                    }}
                    onHover={() => setHighlight(idx)}
                  />
                );
              })}
            </section>
          ))
        ) : (
          flat.map((entry) => {
            const idx = entry.flatIndex;
            return (
              <ItemButton
                key={entry.item.id}
                entry={entry}
                isActive={idx === highlight}
                onActivate={() => {
                  pushRecent(entry.item, recentsKey);
                  onSelect(entry.item);
                }}
                onHover={() => setHighlight(idx)}
              />
            );
          })
        )}
      </div>
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px 4px',
          fontSize: 10,
          color: 'var(--color-muted-foreground)',
          borderTop: '1px solid var(--color-border)',
          marginTop: 2,
        }}
      >
        <span>Insert block</span>
        <span aria-hidden="true" style={{ display: 'flex', gap: 8 }}>
          <KbdHint label="↑↓" />
          <KbdHint label="↵" />
          <KbdHint label="Esc" />
        </span>
      </footer>
    </div>
  );
}

function KbdHint({ label }: { label: string }): React.JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 4px',
        minWidth: 16,
        height: 16,
        borderRadius: 4,
        background: 'var(--color-muted)',
        color: 'var(--color-muted-foreground)',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 10,
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

function EmptyState({ query, onClear }: { query: string; onClear: () => void }): React.JSX.Element {
  return (
    <div
      style={{
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'flex-start',
      }}
      data-testid="slash-menu-empty"
    >
      <span style={{ fontSize: 13, color: 'var(--color-muted-foreground)' }}>
        No blocks match <strong style={{ color: 'var(--color-foreground)' }}>“{query}”</strong>
      </span>
      <button
        type="button"
        onClick={onClear}
        style={{
          fontSize: 12,
          color: 'var(--color-accent-foreground, var(--color-foreground))',
          background: 'var(--color-accent)',
          padding: '4px 8px',
          borderRadius: 6,
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
        }}
      >
        Clear search
      </button>
    </div>
  );
}

interface ItemButtonProps {
  entry: FlatEntry;
  isActive: boolean;
  onActivate: () => void;
  onHover: () => void;
}

function ItemButton({ entry, isActive, onActivate, onHover }: ItemButtonProps): React.JSX.Element {
  const { item, flatIndex } = entry;
  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      data-flat-index={flatIndex}
      onMouseEnter={onHover}
      onClick={onActivate}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: 10,
        padding: '6px 8px',
        borderRadius: 6,
        background: isActive ? 'var(--color-accent)' : 'transparent',
        borderLeft: isActive
          ? '2px solid var(--color-accent-foreground, var(--color-foreground))'
          : '2px solid transparent',
        color: 'var(--color-foreground)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 80ms',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: '0 0 28px',
          height: 28,
          width: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-muted-foreground)',
          background: isActive ? 'var(--color-background)' : 'var(--color-muted)',
          borderRadius: 6,
        }}
        dangerouslySetInnerHTML={item.thumbnail ? { __html: item.thumbnail } : undefined}
      >
        {item.thumbnail ? null : <span style={{ fontSize: 14 }}>{item.icon ?? '◆'}</span>}
      </span>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
        {item.description ? (
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-muted-foreground)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.description}
          </span>
        ) : null}
      </span>
      {item.shortcut ? (
        <KbdHint label={item.shortcut} />
      ) : isActive ? (
        <span aria-hidden="true" style={{ color: 'var(--color-muted-foreground)' }}>
          ↵
        </span>
      ) : null}
    </button>
  );
}

function scoreItem(item: SlashMenuItem, q: string): number {
  const label = item.label.toLowerCase();
  const cat = (item.category ?? '').toLowerCase();
  const desc = (item.description ?? '').toLowerCase();
  const keywords = (item.keywords ?? []).map((k) => k.toLowerCase());
  const tags = (item.tags ?? []).map((t) => t.toLowerCase());
  let score = 0;
  if (label === q) return 1000;
  if (label.startsWith(q)) score = Math.max(score, 200);
  if (label.includes(q)) score = Math.max(score, 100);
  if (cat.startsWith(q)) score = Math.max(score, 80);
  if (cat.includes(q)) score = Math.max(score, 40);
  if (desc.includes(q)) score = Math.max(score, 20);
  for (const k of keywords) {
    if (k === q) return Math.max(score, 150);
    if (k.startsWith(q)) score = Math.max(score, 60);
    if (k.includes(q)) score = Math.max(score, 30);
  }
  for (const t of tags) {
    if (t === q) return Math.max(score, 150);
    if (t.startsWith(q)) score = Math.max(score, 60);
    if (t.includes(q)) score = Math.max(score, 30);
  }
  return score;
}

function pushRecent(item: SlashMenuItem, key: string): void {
  if (typeof window === 'undefined') return;
  if (item.id === '__clear__') return;
  try {
    const raw = window.sessionStorage.getItem(key);
    const list = raw ? (JSON.parse(raw) as Array<{ id: string; at: number }>) : [];
    const filtered = list.filter((r) => r.id !== item.id);
    filtered.unshift({ id: item.id, at: Date.now() });
    window.sessionStorage.setItem(key, JSON.stringify(filtered.slice(0, 5)));
  } catch {
    /* ignore storage errors */
  }
}

export const __testing = { scoreItem, positionPopover, pushRecent };
