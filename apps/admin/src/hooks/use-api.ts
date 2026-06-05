'use client';

import { useEffect, useState } from 'react';
import { getApiClient } from '../lib/api-client.ts';

export interface UseApiResult<T> {
  data: T | null;
  error: unknown;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export interface UseApiOptions<T> {
  initialData?: T;
}

/**
 * Minimal generic fetch hook for ad-hoc endpoints not yet covered by
 * a dedicated hook (e.g. dashboard aggregates). Uses the singleton
 * API client's base URL and bearer token.
 */
export function useApi<T>(path: string, options: UseApiOptions<T> = {}): UseApiResult<T> {
  const [data, setData] = useState<T | null>(options.initialData ?? null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = async (): Promise<void> => {
    if (typeof window === 'undefined') return;
    setIsLoading(true);
    setError(null);
    try {
      const baseUrl = getApiClient().config.baseUrl.replace(/\/$/, '');
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as T;
      setData(body);
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return { data, error, isLoading, refetch };
}
