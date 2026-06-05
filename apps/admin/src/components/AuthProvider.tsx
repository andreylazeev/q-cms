'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getApiClient } from '../lib/api-client.ts';
import type { SdkUser } from '../lib/stubs/sdk-types.ts';

export interface AuthContextValue {
  user: SdkUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  setUser: (user: SdkUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used inside <AuthProvider>');
  }
  return ctx;
}

const STORAGE_KEY = 'q-cms-admin:auth';

interface PersistedAuth {
  token: string;
  user: SdkUser;
}

function isPersisted(value: unknown): value is PersistedAuth {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v['token'] === 'string' && typeof v['user'] === 'object' && v['user'] !== null;
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<SdkUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    if (typeof window === 'undefined') {
      setStatus('unauthenticated');
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setStatus('unauthenticated');
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (isPersisted(parsed)) {
        getApiClient().setToken(parsed.token);
        setUser(parsed.user);
        setStatus('authenticated');
        return;
      }
    } catch {
      // ignore
    }
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, setUser }),
    [user, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
