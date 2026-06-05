'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiClient } from '../lib/api-client.ts';
import type { SdkUser } from '../lib/stubs/sdk-types.ts';

const STORAGE_KEY = 'q-cms-admin:auth';
const AUTH_COOKIE = 'qcms_token';

export interface AuthState {
  user: SdkUser | null;
  token: string | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UseAuth extends AuthState {
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

/** Rehydrate auth state from localStorage and the API. */
function readPersisted(): { token: string; user: SdkUser } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'token' in parsed && 'user' in parsed) {
      const p = parsed as { token: string; user: SdkUser };
      return { token: p.token, user: p.user };
    }
  } catch {
    return null;
  }
  return null;
}

function persist(value: { token: string; user: SdkUser } | null): void {
  if (typeof window === 'undefined') return;
  if (value === null) {
    window.localStorage.removeItem(STORAGE_KEY);
    document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(value.token)}; path=/; max-age=2592000; SameSite=Lax`;
  }
}

/** Minimal auth state hook.
 *
 * - `login()` calls the SDK's `auth.login` and persists token/user to
 *   `localStorage` so the session survives reloads.
 * - `logout()` clears the local session and calls the API.
 * - On mount we rehydrate from `localStorage`.
 */
export function useAuth(): UseAuth {
  const [state, setState] = useState<AuthState>({ user: null, token: null, status: 'loading' });

  const refetch = useCallback(async (): Promise<void> => {
    const persisted = readPersisted();
    if (!persisted) {
      setState({ user: null, token: null, status: 'unauthenticated' });
      return;
    }
    getApiClient().setToken(persisted.token);
    const me = await getApiClient().users.me();
    if (me) {
      setState({ user: me, token: persisted.token, status: 'authenticated' });
      persist({ token: persisted.token, user: me });
    } else {
      persist(null);
      setState({ user: null, token: null, status: 'unauthenticated' });
    }
  }, []);

  useEffect(() => {
    const persisted = readPersisted();
    if (!persisted) {
      setState({ user: null, token: null, status: 'unauthenticated' });
      return;
    }
    getApiClient().setToken(persisted.token);
    setState({ user: persisted.user, token: persisted.token, status: 'authenticated' });
    void refetch();
  }, [refetch]);

  const login = useCallback(async (input: LoginInput): Promise<void> => {
    const client = getApiClient();
    const result = await client.auth.login(input);
    client.setToken(result.token);
    setState({ user: result.user, token: result.token, status: 'authenticated' });
    persist({ token: result.token, user: result.user });
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await getApiClient().auth.logout();
    } finally {
      getApiClient().setToken(undefined);
      persist(null);
      setState({ user: null, token: null, status: 'unauthenticated' });
    }
  }, []);

  return { ...state, login, logout, refetch };
}

/** Convenience wrapper — fetches the current user. */
export function useMe(): { user: SdkUser | null; status: AuthState['status'] } {
  const { user, status } = useAuth();
  return { user, status };
}

/** Login mutation. */
export function useLogin() {
  const { login, status } = useAuth();
  return { login, status };
}

/** Logout mutation. */
export function useLogout() {
  const { logout } = useAuth();
  return { logout };
}
