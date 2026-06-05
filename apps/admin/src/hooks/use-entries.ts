'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '../lib/api-client.ts';
import type { SdkEntry, EntryStatus } from '../lib/stubs/sdk-types.ts';

export interface UseEntriesParams {
  collection: string;
  status?: EntryStatus;
  search?: string;
  limit?: number;
  page?: number;
}

export interface UseEntriesResult {
  entries: readonly SdkEntry[];
  isLoading: boolean;
  error: unknown;
  total: number | null;
  refetch: () => void;
}

export function useEntries(params: UseEntriesParams): UseEntriesResult {
  const query = useQuery({
    queryKey: ['qcms', 'entries', params.collection, params] as const,
    queryFn: async () => {
      const result = await getApiClient().entries<SdkEntry>(params.collection).list();
      return result;
    },
    enabled: Boolean(params.collection),
  });
  return {
    entries: query.data?.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    total: query.data?.meta.totalCount ?? null,
    refetch: () => {
      void query.refetch();
    },
  };
}

export interface UseEntryResult {
  entry: SdkEntry | null;
  isLoading: boolean;
  error: unknown;
}

/** Fetch a single entry by id. */
export function useEntry(collection: string, id: string): UseEntryResult {
  const query = useQuery<SdkEntry | null>({
    queryKey: ['qcms', 'entry', collection, id] as const,
    queryFn: async () => {
      try {
        return await getApiClient().entries<SdkEntry>(collection).get(id);
      } catch {
        return null;
      }
    },
    enabled: Boolean(collection) && Boolean(id),
  });
  return {
    entry: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export interface CreateEntryInput {
  data: Record<string, unknown>;
  slug?: string;
  locale?: string;
  status?: EntryStatus;
}

export interface UpdateEntryInput {
  id: string;
  data: Record<string, unknown>;
}

export interface PublishEntryInput {
  id: string;
}

/** Mutation hook for creating a new entry. */
export function useCreateEntry(collection: string) {
  const qc = useQueryClient();
  return useMutation<SdkEntry, Error, CreateEntryInput>({
    mutationFn: (input) =>
      getApiClient().entries<SdkEntry>(collection).create(input.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['qcms', 'entries', collection] });
    },
  });
}

/** Mutation hook for updating an entry. */
export function useUpdateEntry(collection: string) {
  const qc = useQueryClient();
  return useMutation<SdkEntry, Error, UpdateEntryInput>({
    mutationFn: ({ id, data }) =>
      getApiClient().entries<SdkEntry>(collection).update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['qcms', 'entries', collection] });
      void qc.invalidateQueries({ queryKey: ['qcms', 'entry', collection] });
    },
  });
}

/** Mutation hook for deleting an entry. */
export function useDeleteEntry(collection: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => getApiClient().entries<SdkEntry>(collection).delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['qcms', 'entries', collection] });
    },
  });
}

/** Mutation hook for publishing an entry.
 *
 * The stub client does not yet expose a publish action; in the real
 * SDK this will become `client.entries(c).publish(id)`. Until then we
 * optimistically mark the entry as published locally.
 */
export function usePublishEntry(collection: string) {
  const qc = useQueryClient();
  return useMutation<SdkEntry, Error, PublishEntryInput>({
    mutationFn: async ({ id }) => {
      const current = await getApiClient().entries<SdkEntry>(collection).get(id);
      if (!current) throw new Error('Entry not found');
      return getApiClient()
        .entries<SdkEntry>(collection)
        .update(id, { ...(current.data as Record<string, unknown>), status: 'published' });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['qcms', 'entries', collection] });
      void qc.invalidateQueries({ queryKey: ['qcms', 'entry', collection] });
    },
  });
}
