'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from '../../components/Sidebar.tsx';
import { Header } from '../../components/Header.tsx';
import { DashboardShell } from './_shell.tsx';

const SIDEBAR_COLLAPSED_KEY = 'q-cms-admin:sidebar-collapsed';
const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

export interface DashboardGridProps {
  children: ReactNode;
}

/**
 * Client-side dashboard chrome. Owns the sidebar's collapsed state
 * (persisted to localStorage) and adapts the grid template column
 * accordingly. Renders a stable expanded layout on first paint to
 * avoid SSR/CSR hydration mismatches; the persisted preference is
 * applied on mount via {@link useEffect}.
 */
export function DashboardGrid({ children }: DashboardGridProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [isNarrow, setIsNarrow] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (raw === '1') setCollapsed(true);
    } catch {
      // Ignore storage errors (private mode, quota, etc.) and keep the
      // default expanded layout.
    }
    setHydrated(true);
  }, []);

  // Track narrow viewports (<1024px) so <main> can shrink its padding
  // and PageBuilder (which uses matchMedia-driven panels on the same
  // breakpoint) can spread out. Initial render uses the desktop
  // default; the listener applies the actual value post-hydration.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1023.98px)');
    setIsNarrow(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setIsNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function handleCollapsedChange(next: boolean): void {
    setCollapsed(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // Best-effort persistence; UI state still updates in-memory.
    }
  }

  const sidebarWidth = hydrated ? (collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH) : EXPANDED_WIDTH;
  const mainPadding = isNarrow ? 12 : 24;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${sidebarWidth}px 1fr`,
        gridTemplateRows: '56px 1fr',
        minHeight: '100vh',
        background: 'var(--color-background)',
        transition: 'grid-template-columns 200ms ease-in-out',
      }}
    >
      <div
        style={{
          gridColumn: '1 / 2',
          gridRow: '1 / 3',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        <Sidebar collapsed={collapsed} onCollapsedChange={handleCollapsedChange} />
      </div>
      <div
        style={{
          gridColumn: '2 / 3',
          gridRow: '1 / 2',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Header />
      </div>
      <main
        style={{
          gridColumn: '2 / 3',
          gridRow: '2 / 3',
          padding: mainPadding,
          overflow: 'auto',
        }}
      >
        <DashboardShell>{children}</DashboardShell>
      </main>
    </div>
  );
}
