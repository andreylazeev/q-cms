'use client';

/**
 * BlockPalette — left sidebar of the visual page builder.
 *
 * Lists every block spec exposed by `@q-cms/templates`. The
 * palette is grouped by `spec.category`, with **sticky** category
 * headers that float above the scrollable card list. A search
 * input at the top filters by label / description / type using a
 * simple substring match (we don't pull in fuse.js for this — the
 * list is small and substring is enough for ~12 items).
 *
 * Each card is draggable. The canvas handles the `application/
 * x-qcms-block-type` MIME payload to know which spec to add.
 *
 * Keyboard shortcuts:
 *   `/` focuses the search input
 *   `Esc` clears the search and blurs the input
 */

import type { BlockSpec } from '@q-cms/templates';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BlockPaletteCard } from './BlockPaletteCard.tsx';
import { Search, X } from './icons.tsx';

export interface BlockPaletteProps {
  onAdd: (spec: BlockSpec) => void;
}

const CATEGORY_LABELS: Record<string, { label: string; hint: string }> = {
  content: { label: 'Content', hint: 'Hero, text, lists' },
  layout: { label: 'Layout', hint: 'Grids, separators' },
  media: { label: 'Media', hint: 'Images and embeds' },
  commerce: { label: 'Commerce', hint: 'Calls to action' },
  other: { label: 'Other', hint: 'Miscellaneous' },
};

const CATEGORY_ORDER: ReadonlyArray<string> = ['content', 'layout', 'media', 'commerce', 'other'];

/** Hand-rolled "fuzzy" match: lowercases, splits query into tokens,
 *  every token must be a substring of some combination of the
 *  searchable fields. */
function matchesQuery(spec: BlockSpec, tokens: ReadonlyArray<string>): boolean {
  if (tokens.length === 0) return true;
  const haystack = `${spec.label} ${spec.description} ${spec.type}`.toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

export function BlockPalette({ onAdd }: BlockPaletteProps): React.JSX.Element {
  // Lazy-load the spec list on the client to avoid the SSR
  // import-time side effect of `registerBuiltinBlocks()`.
  const [specs, setSpecs] = useState<BlockSpec[]>([]);
  const [query, setQuery] = useState('');
  const [draggingType, setDraggingType] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('@q-cms/templates').then((mod) => {
      if (cancelled) return;
      mod.registerBuiltinBlocks();
      setSpecs(mod.listBlockSpecs());
      // Expose the spec map to the canvas, which looks up the spec
      // when a palette card is dropped on it.
      const map = new Map<string, BlockSpec>();
      for (const s of mod.listBlockSpecs()) map.set(s.type, s);
      window.QCMS_BLOCK_REGISTRY = map;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onKey(ev: KeyboardEvent): void {
      const target = ev.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (ev.key === '/' && !isInput) {
        ev.preventDefault();
        inputRef.current?.focus();
      } else if (ev.key === 'Escape' && document.activeElement === inputRef.current) {
        setQuery('');
        inputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tokens = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  );

  const filtered = useMemo(() => {
    if (tokens.length === 0) return specs;
    return specs.filter((s) => matchesQuery(s, tokens));
  }, [specs, tokens]);

  const grouped = useMemo(() => {
    const map = new Map<string, BlockSpec[]>();
    for (const spec of filtered) {
      const list = map.get(spec.category) ?? [];
      list.push(spec);
      map.set(spec.category, list);
    }
    return map;
  }, [filtered]);

  const hasResults = filtered.length > 0;

  return (
    <aside className="pb-palette" data-testid="block-palette" aria-label="Block palette">
      <div className="pb-palette__head">
        <h2 className="pb-palette__title">Blocks</h2>
        <p className="pb-palette__sub">Click to add, or drag onto the canvas.</p>
      </div>
      <div className="pb-palette__search">
        <Search size={14} aria-hidden="true" className="pb-palette__search-icon" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search blocks…"
          className="pb-palette__search-input"
          aria-label="Search blocks"
          data-testid="palette-search"
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="pb-palette__search-clear"
            aria-label="Clear search"
            data-testid="palette-search-clear"
          >
            <X size={12} />
          </button>
        ) : (
          <kbd className="pb-palette__kbd">/</kbd>
        )}
      </div>
      {!hasResults ? (
        <div className="pb-palette__empty" data-testid="palette-empty">
          <p>No blocks match “{query}”.</p>
        </div>
      ) : null}
      <div className="pb-palette__scroll">
        {CATEGORY_ORDER.map((key) => {
          const items = grouped.get(key);
          if (!items || items.length === 0) return null;
          const meta = CATEGORY_LABELS[key] ?? { label: key, hint: '' };
          return (
            <section key={key} className="pb-palette__section" data-testid={`palette-category-${key}`}>
              <header className="pb-palette__section-head">
                <h3 className="pb-palette__section-title">{meta.label}</h3>
                {meta.hint ? <p className="pb-palette__section-hint">{meta.hint}</p> : null}
              </header>
              <div className="pb-palette__list">
                {items.map((spec) => (
                  <BlockPaletteCard
                    key={spec.type}
                    spec={spec}
                    onAdd={onAdd}
                    onDragStart={(s) => setDraggingType(s?.type ?? null)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {draggingType ? (
        <span className="pb-palette__drag-hint" data-testid="palette-drag-hint">
          Drop on the canvas to insert “{draggingType}”.
        </span>
      ) : null}
    </aside>
  );
}

declare global {
  interface Window {
    QCMS_BLOCK_REGISTRY?: Map<string, BlockSpec>;
  }
}
