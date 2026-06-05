import { type ReactNode } from 'react';
import { DashboardGrid } from './_grid.tsx';

export const dynamic = 'force-dynamic';

export interface DashboardLayoutProps {
  children: ReactNode;
}

/**
 * Server-component shell that hands the dashboard pages over to the
 * client-side {@link DashboardGrid} chrome. Auth gating is delegated
 * to the client-side `DashboardShell` so we don't break the SPA-style
 * localStorage flow in dev.
 */
export default function DashboardLayout({ children }: DashboardLayoutProps): React.JSX.Element {
  return <DashboardGrid>{children}</DashboardGrid>;
}
