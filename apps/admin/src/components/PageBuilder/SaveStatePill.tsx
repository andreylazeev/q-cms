'use client';

/**
 * SaveStatePill — single source of truth for the "saved / saving /
 * unsaved" status that's used in both the top toolbar and the
 * inspector header. Renders as a small pill with a dot + label.
 *
 * States:
 *   - saving   → pulsing dot + "Saving…"
 *   - dirty    → warning dot + "Unsaved changes"
 *   - saved    → green check + "Saved Xs ago" (auto-updates every 10s)
 *   - idle     → muted dot + "Draft"
 *
 * The component is dumb: it accepts a state + an optional savedAt
 * timestamp; the parent owns the dirty/saving flags. The "saved X
 * seconds ago" text is computed locally so both tooltips stay in
 * sync without lifting a timer up the tree.
 */

import { useEffect, useState } from 'react';
import { Check, Loader2 } from './icons.tsx';
import { cn } from '../../lib/utils.ts';

export type SaveState = 'idle' | 'saving' | 'saved' | 'dirty';

export interface SaveStatePillProps {
  state: SaveState;
  savedAt?: number | null;
  className?: string;
}

function formatAgo(savedAt: number, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - savedAt) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function SaveStatePill({ state, savedAt, className }: SaveStatePillProps): React.JSX.Element {
  // Tick every 10s so "Saved Xs ago" stays accurate while the user
  // is staring at the canvas. Cheap (one setInterval per pill).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (state !== 'saved' || !savedAt) return;
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [state, savedAt]);

  const label =
    state === 'saving'
      ? 'Saving…'
      : state === 'dirty'
        ? 'Unsaved changes'
        : state === 'saved'
          ? savedAt
            ? `Saved ${formatAgo(savedAt, now)}`
            : 'Saved'
          : 'Draft';

  return (
    <span
      className={cn('pb-save-pill', `pb-save-pill--${state}`, className)}
      data-testid="save-state-pill"
      data-state={state}
      role="status"
      aria-live="polite"
    >
      <span className="pb-save-pill__dot" aria-hidden="true">
        {state === 'saving' ? <Loader2 size={12} className="pb-save-pill__spin" /> : null}
        {state === 'saved' ? <Check size={12} /> : null}
        {state === 'dirty' || state === 'idle' ? <span className="pb-save-pill__pip" /> : null}
      </span>
      <span className="pb-save-pill__label">{label}</span>
    </span>
  );
}
