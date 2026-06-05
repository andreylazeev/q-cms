'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '../lib/api-client.ts';
import type { SdkMedia } from '../lib/stubs/sdk-types.ts';
import type { MediaType } from '@q-cms/core';

export interface UseMediaParams {
  type?: MediaType;
  search?: string;
  limit?: number;
}

export interface UseMediaResult {
  items: readonly SdkMedia[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

/** List media items with optional filters. */
export function useMedia(params: UseMediaParams = {}): UseMediaResult {
  const query = useQuery<readonly SdkMedia[]>({
    queryKey: ['qcms', 'media', params] as const,
    queryFn: async () => {
      const list = await getApiClient().media.list();
      return list;
    },
  });
  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}

/** Upload mutation — accepts a `File` or `Blob`. */
export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation<SdkMedia, Error, File | Blob>({
    mutationFn: (file) => getApiClient().media.upload(file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['qcms', 'media'] });
    },
  });
}

/** Delete mutation. */
export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => getApiClient().media.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['qcms', 'media'] });
    },
  });
}

/** Aggregated mutations (legacy compatibility). */
export function useMediaMutations(): {
  upload: ReturnType<typeof useUploadMedia>;
  remove: ReturnType<typeof useDeleteMedia>;
} {
  return { upload: useUploadMedia(), remove: useDeleteMedia() };
}
