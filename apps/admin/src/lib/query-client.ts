/**
 * Singleton TanStack Query client for the admin app.
 *
 * The client is stored on `globalThis` so it survives HMR and
 * prevents the cache from being blown away on every Fast Refresh.
 */

import { QueryClient } from '@tanstack/react-query';

declare global {
  // eslint-disable-next-line no-var
  var __QCMS_ADMIN_QUERY_CLIENT__: QueryClient | undefined;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/** Resolve the singleton QueryClient, creating it on first access. */
export function getQueryClient(): QueryClient {
  if (!globalThis.__QCMS_ADMIN_QUERY_CLIENT__) {
    globalThis.__QCMS_ADMIN_QUERY_CLIENT__ = makeQueryClient();
  }
  return globalThis.__QCMS_ADMIN_QUERY_CLIENT__;
}

export const queryClient = getQueryClient();
