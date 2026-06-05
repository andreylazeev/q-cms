'use client';

import { useQuery } from '@tanstack/react-query';
import { getApiClient } from '../lib/api-client.ts';
import type { SdkCollection } from '../lib/stubs/sdk-types.ts';

export interface UseCollectionsResult {
  collections: readonly SdkCollection[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export function useCollections(): UseCollectionsResult {
  const query = useQuery<readonly SdkCollection[]>({
    queryKey: ['qcms', 'collections'],
    queryFn: () => getApiClient().collections.list(),
  });
  return {
    collections: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}

export interface UseCollectionResult {
  collection: SdkCollection | null;
  isLoading: boolean;
  error: unknown;
}

export function useCollection(slug: string): UseCollectionResult {
  const query = useQuery<SdkCollection | null>({
    queryKey: ['qcms', 'collection', slug],
    queryFn: async () => {
      try {
        return await getApiClient().collections.findBySlug(slug);
      } catch {
        return null;
      }
    },
    enabled: Boolean(slug),
  });
  return {
    collection: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
