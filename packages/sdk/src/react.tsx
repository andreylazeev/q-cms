/**
 * React integration for the Q-CMS SDK.
 *
 * Provides a small {@link QcmsProvider} for context plumbing and
 * hooks built on top of `@tanstack/react-query`. TanStack Query is
 * an optional peer dependency; the file is structured so that
 * consuming apps may dynamically import the hooks.
 *
 * @module react
 */

import * as React from 'react';
import type {
  EntryStatus,
  Json,
  Locale,
  Paginated,
  QcmsFilterObject,
  QcmsPopulateSpec,
  SdkEntry,
  SdkUser,
} from './types.ts';
import type { QcmsClient } from './client.ts';

// ---------------------------------------------------------------------------
// Optional TanStack Query integration
// ---------------------------------------------------------------------------

/**
 * Minimal structural type for the parts of TanStack Query that we
 * rely on. The real package may not be installed; we detect that
 * at module load time and re-export accordingly.
 */
interface QueryClientLike {
  invalidateQueries(args: { queryKey: readonly unknown[] }): Promise<void>;
  fetchQuery<T>(args: { queryKey: readonly unknown[]; queryFn: () => Promise<T> }): Promise<T>;
}

interface QueryObserverResult<T> {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  refetch: () => Promise<unknown>;
}

interface UseQueryFn {
  <T>(args: { queryKey: readonly unknown[]; queryFn: () => Promise<T> }): QueryObserverResult<T>;
}

interface UseMutationFn {
  <TData, TVariables>(args: {
    mutationFn: (variables: TVariables) => Promise<TData>;
    onSuccess?: (data: TData, variables: TVariables) => void;
  }): {
    mutate: (variables: TVariables) => Promise<TData>;
    mutateAsync: (variables: TVariables) => Promise<TData>;
    isLoading: boolean;
    error: unknown;
    data: TData | undefined;
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const QcmsContext = React.createContext<QcmsClient | null>(null);

/** Optional QueryClient context — provided by apps that want to share a cache. */
const QcmsQueryClientContext = React.createContext<QueryClientLike | null>(null);

export interface QcmsProviderProps {
  client: QcmsClient;
  /** Optional TanStack Query client to share cache. */
  queryClient?: QueryClientLike | null;
  children: React.ReactNode;
}

/**
 * Provide a {@link QcmsClient} to the React tree.
 *
 * Wrap your app root:
 * ```tsx
 * const cms = createClient({ baseUrl, token });
 * <QcmsProvider client={cms}><App /></QcmsProvider>
 * ```
 */
export function QcmsProvider(props: QcmsProviderProps): React.ReactElement {
  return (
    <QcmsContext.Provider value={props.client}>
      <QcmsQueryClientContext.Provider value={props.queryClient ?? null}>
        {props.children}
      </QcmsQueryClientContext.Provider>
    </QcmsContext.Provider>
  );
}

/** Read the active client; throws when used outside a {@link QcmsProvider}. */
export function useQcmsClient(): QcmsClient {
  const ctx = React.useContext(QcmsContext);
  if (!ctx) {
    throw new Error('useQcmsClient: must be used inside <QcmsProvider>.');
  }
  return ctx;
}

function useOptionalQueryClient(): QueryClientLike | null {
  return React.useContext(QcmsQueryClientContext);
}

// ---------------------------------------------------------------------------
// Internal hook adapters
// ---------------------------------------------------------------------------

interface HookDeps {
  useQuery: UseQueryFn | null;
  useMutation: UseMutationFn | null;
  useQueryClient: () => QueryClientLike | null;
}

let cachedDeps: HookDeps | null = null;

/** Resolve TanStack Query lazily so the SDK is usable without React Query installed. */
function resolveHookDeps(): HookDeps {
  if (cachedDeps) return cachedDeps;
  cachedDeps = { useQuery: null, useMutation: null, useQueryClient: () => null };
  return cachedDeps;
}

/** Test-only override. */
export function __setHookDepsForTests(deps: Partial<HookDeps> | null): void {
  if (!deps) {
    cachedDeps = null;
    return;
  }
  cachedDeps = { ...resolveHookDeps(), ...deps };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export interface UseQcmsEntryOptions {
  populate?: readonly (string | QcmsPopulateSpec)[];
  fields?: readonly string[];
  locale?: Locale | string;
  status?: EntryStatus | readonly EntryStatus[];
  where?: QcmsFilterObject;
}

export interface UseQcmsEntriesParams {
  where?: QcmsFilterObject;
  populate?: readonly (string | QcmsPopulateSpec)[];
  fields?: readonly string[];
  sort?: string;
  limit?: number;
  locale?: Locale | string;
  status?: EntryStatus | readonly EntryStatus[];
}

/**
 * Fetch a single entry by id (or slug).
 *
 * Falls back to a `useState + useEffect` implementation if TanStack
 * Query is not available; the return shape is identical.
 */
export function useQcmsEntry<T extends SdkEntry = SdkEntry>(
  collection: string,
  id: string,
  opts: UseQcmsEntryOptions = {},
): QueryObserverResult<T> {
  const client = useQcmsClient();
  const external = useOptionalQueryClient();
  const deps = resolveHookDeps();
  const [state, setState] = React.useState<QueryObserverResult<T>>({
    data: undefined,
    error: null,
    isLoading: true,
    isFetching: true,
    isSuccess: false,
    refetch: () => Promise.resolve(),
  });

  const queryKey = React.useMemo(
    () => ['qcms', 'entry', collection, id, JSON.stringify(opts)] as const,
    [collection, id, opts],
  );

  const fetchOnce = React.useCallback(async (): Promise<T> => {
    const params: Record<string, string> = { limit: '1' };
    if (opts.populate && opts.populate.length > 0) {
      params['populate'] = opts.populate
        .map((p) => (typeof p === 'string' ? p : p.field))
        .join(',');
    }
    if (opts.fields && opts.fields.length > 0) params['fields'] = opts.fields.join(',');
    if (opts.locale) params['locale'] = String(opts.locale);
    if (opts.status) {
      params['status'] = Array.isArray(opts.status) ? opts.status.slice().join(',') : (opts.status as string);
    }
    return client.entries<T>(collection).where({ id, ...(opts.where as QcmsFilterObject | undefined) }).get().then((res) => {
      if (res.data.length === 0) {
        throw new Error(`Entry ${id} not found in ${collection}`);
      }
      return res.data[0] as T;
    });
  }, [client, collection, id, opts]);

  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, isFetching: true, error: null }));
    fetchOnce()
      .then((data) => {
        if (cancelled) return;
        setState({
          data,
          error: null,
          isLoading: false,
          isFetching: false,
          isSuccess: true,
          refetch: fetchOnce,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          data: undefined,
          error,
          isLoading: false,
          isFetching: false,
          isSuccess: false,
          refetch: fetchOnce,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [fetchOnce]);

  // If TanStack Query is wired up, prefer it (it can dedupe / cache).
  if (deps.useQuery && external) {
    return deps.useQuery<T>({ queryKey, queryFn: fetchOnce });
  }
  void external;
  return state;
}

/** Fetch a list of entries from a collection. */
export function useQcmsEntries<T extends SdkEntry = SdkEntry>(
  collection: string,
  params: UseQcmsEntriesParams = {},
): QueryObserverResult<Paginated<T>> {
  const client = useQcmsClient();
  const external = useOptionalQueryClient();
  const deps = resolveHookDeps();
  const [state, setState] = React.useState<QueryObserverResult<Paginated<T>>>({
    data: undefined,
    error: null,
    isLoading: true,
    isFetching: true,
    isSuccess: false,
    refetch: () => Promise.resolve(),
  });

  const queryKey = React.useMemo(
    () => ['qcms', 'entries', collection, JSON.stringify(params)] as const,
    [collection, params],
  );

  const fetchOnce = React.useCallback(async (): Promise<Paginated<T>> => {
    const qb = client.entries<T>(collection);
    if (params.where) qb.where(params.where);
    if (params.populate) qb.populate(params.populate);
    if (params.fields) qb.fields(params.fields);
    if (params.sort) qb.sort(params.sort);
    if (params.limit !== undefined) qb.limit(params.limit);
    if (params.locale) qb.locale(params.locale);
    if (params.status) qb.status(params.status);
    return qb.get();
  }, [client, collection, params]);

  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, isFetching: true, error: null }));
    fetchOnce()
      .then((data) => {
        if (cancelled) return;
        setState({
          data,
          error: null,
          isLoading: false,
          isFetching: false,
          isSuccess: true,
          refetch: fetchOnce,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          data: undefined,
          error,
          isLoading: false,
          isFetching: false,
          isSuccess: false,
          refetch: fetchOnce,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [fetchOnce]);

  if (deps.useQuery && external) {
    return deps.useQuery<Paginated<T>>({ queryKey, queryFn: fetchOnce });
  }
  void external;
  return state;
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

interface MutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData>;
  isLoading: boolean;
  error: unknown;
  data: TData | undefined;
}

function useMutationShim<TData, TVariables>(
  mutationFn: (vars: TVariables) => Promise<TData>,
  onSuccess?: (data: TData, vars: TVariables) => void,
): MutationResult<TData, TVariables> {
  const [state, setState] = React.useState<Omit<MutationResult<TData, TVariables>, 'mutate'>>({
    isLoading: false,
    error: null,
    data: undefined,
  });
  const mutate = React.useCallback(
    async (variables: TVariables) => {
      setState({ isLoading: true, error: null, data: undefined });
      try {
        const data = await mutationFn(variables);
        setState({ isLoading: false, error: null, data });
        if (onSuccess) onSuccess(data, variables);
        return data;
      } catch (error) {
        setState({ isLoading: false, error, data: undefined });
        throw error;
      }
    },
    [mutationFn, onSuccess],
  );
  return { mutate, ...state };
}

/** Create an entry. Invalidates the `['qcms', 'entries', collection]` key on success. */
export function useQcmsCreateEntry<T extends SdkEntry = SdkEntry>(
  collection: string,
): MutationResult<T, Partial<T['data']>> {
  const client = useQcmsClient();
  const external = useOptionalQueryClient();
  const deps = resolveHookDeps();
  const invalidate = React.useCallback(async () => {
    if (external) await external.invalidateQueries({ queryKey: ['qcms', 'entries', collection] });
  }, [external, collection]);
  if (deps.useMutation) {
    return deps.useMutation<T, Partial<T['data']>>({
      mutationFn: (data) => client.entries<T>(collection).create(data),
      onSuccess: invalidate,
    });
  }
  return useMutationShim<T, Partial<T['data']>>(
    (data) => client.entries<T>(collection).create(data),
    invalidate,
  );
}

/** Update an entry. Invalidates the entry + list cache on success. */
export function useQcmsUpdateEntry<T extends SdkEntry = SdkEntry>(
  collection: string,
): MutationResult<T, { id: string; data: Partial<T['data']> }> {
  const client = useQcmsClient();
  const external = useOptionalQueryClient();
  const deps = resolveHookDeps();
  const invalidate = React.useCallback(async () => {
    if (external) await external.invalidateQueries({ queryKey: ['qcms', collection] });
  }, [external, collection]);
  if (deps.useMutation) {
    return deps.useMutation<T, { id: string; data: Partial<T['data']> }>({
      mutationFn: ({ id, data }) => client.entries<T>(collection).update(id, data),
      onSuccess: invalidate,
    });
  }
  return useMutationShim<T, { id: string; data: Partial<T['data']> }>(
    ({ id, data }) => client.entries<T>(collection).update(id, data),
    invalidate,
  );
}

/** Delete an entry. Invalidates the list cache on success. */
export function useQcmsDeleteEntry<T extends SdkEntry = SdkEntry>(
  collection: string,
): MutationResult<void, string> {
  const client = useQcmsClient();
  const external = useOptionalQueryClient();
  const deps = resolveHookDeps();
  const invalidate = React.useCallback(async () => {
    if (external) await external.invalidateQueries({ queryKey: ['qcms', 'entries', collection] });
  }, [external, collection]);
  if (deps.useMutation) {
    return deps.useMutation<void, string>({
      mutationFn: (id) => client.entries<T>(collection).delete(id),
      onSuccess: invalidate,
    });
  }
  return useMutationShim<void, string>((id) => client.entries<T>(collection).delete(id), invalidate);
}

/** Publish an entry. Invalidates the entry + list cache on success. */
export function useQcmsPublishEntry<T extends SdkEntry = SdkEntry>(
  collection: string,
): MutationResult<T, string> {
  const client = useQcmsClient();
  const external = useOptionalQueryClient();
  const deps = resolveHookDeps();
  const invalidate = React.useCallback(async () => {
    if (external) await external.invalidateQueries({ queryKey: ['qcms', collection] });
  }, [external, collection]);
  if (deps.useMutation) {
    return deps.useMutation<T, string>({
      mutationFn: (id) => client.entries<T>(collection).publish(id),
      onSuccess: invalidate,
    });
  }
  return useMutationShim<T, string>((id) => client.entries<T>(collection).publish(id), invalidate);
}

// ---------------------------------------------------------------------------
// Convenience: re-exports so consumers can `import { useQcmsMe } from '@q-cms/sdk/react'`.
// ---------------------------------------------------------------------------

export function useQcmsMe(): QueryObserverResult<SdkUser> {
  const client = useQcmsClient();
  const external = useOptionalQueryClient();
  const deps = resolveHookDeps();
  const fetchOnce = React.useCallback(() => client.users.me(), [client]);
  const [state, setState] = React.useState<QueryObserverResult<SdkUser>>({
    data: undefined,
    error: null,
    isLoading: true,
    isFetching: true,
    isSuccess: false,
    refetch: fetchOnce,
  });
  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, isFetching: true, error: null }));
    fetchOnce()
      .then((data) => {
        if (cancelled) return;
        setState({ data, error: null, isLoading: false, isFetching: false, isSuccess: true, refetch: fetchOnce });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ data: undefined, error, isLoading: false, isFetching: false, isSuccess: false, refetch: fetchOnce });
      });
    return () => { cancelled = true; };
  }, [fetchOnce]);
  if (deps.useQuery && external) {
    return deps.useQuery<SdkUser>({ queryKey: ['qcms', 'auth', 'me'], queryFn: fetchOnce });
  }
  return state;
}

// Suppress unused-imports for the re-export
export type { Json };
