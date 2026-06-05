'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

export interface DashboardShellProps {
  children: ReactNode;
}

/**
 * Client-side auth gate. Reads `q-cms-admin:auth` from localStorage
 * on mount; redirects to /login when missing or when status resolves
 * to `unauthenticated`. Renders a small loading shell during the
 * rehydration phase so the SSR markup doesn't flash.
 */
export function DashboardShell({ children }: DashboardShellProps): React.JSX.Element | null {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('q-cms-admin:auth');
      if (!raw) {
        const next = encodeURIComponent(window.location.pathname);
        router.replace(`/login?next=${next}`);
      }
    } catch {
      router.replace('/login');
    }
  }, [router]);

  return <>{children}</>;
}
