import { type ReactNode } from 'react';
import { Sidebar } from '../../components/Sidebar.tsx';
import { Header } from '../../components/Header.tsx';
import { DashboardShell } from './_shell.tsx';

export const dynamic = 'force-dynamic';

export interface DashboardLayoutProps {
  children: ReactNode;
}

/**
 * Server-component shell that renders the sidebar + topbar chrome
 * around the dashboard pages. Auth gating is delegated to the
 * client-side `DashboardShell` so we don't break the SPA-style
 * localStorage flow in dev.
 */
export default function DashboardLayout({ children }: DashboardLayoutProps): React.JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
        gridTemplateRows: '56px 1fr',
        minHeight: '100vh',
        background: 'var(--color-background)',
      }}
    >
      <div
        style={{
          gridColumn: '1 / 2',
          gridRow: '1 / 3',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        <Sidebar />
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
          padding: 24,
          overflow: 'auto',
        }}
      >
        <DashboardShell>{children}</DashboardShell>
      </main>
    </div>
  );
}
