/**
 * Local stub for `@q-cms/api-client` while the real package is being built.
 *
 * Re-exports a minimal `createClient` factory that mimics the SDK's
 * public surface so that the admin app can be developed and tested
 * without depending on the full implementation. All calls return
 * empty/zeroed data — this is purely so the TypeScript build passes.
 */

import type { SdkEntry, SdkUser, SdkCollection, SdkMedia, SdkRole } from './sdk-types.ts';

export interface StubClientConfig {
  baseUrl: string;
  token?: string;
  apiKey?: string;
}

export interface StubPaginated<T> {
  data: readonly T[];
  meta: {
    pageInfo: { hasNext: boolean; hasPrev: boolean; limit: number; total: number | null };
    totalCount: number;
  };
}

export interface StubClient {
  readonly config: { baseUrl: string; token?: string };
  setToken(token: string | undefined): void;
  entries<T = SdkEntry>(collection: string): {
    list(): Promise<StubPaginated<T>>;
    get(id: string): Promise<T | null>;
    create(data: Record<string, unknown>): Promise<T>;
    update(id: string, data: Record<string, unknown>): Promise<T>;
    delete(id: string): Promise<void>;
  };
  collections: {
    list(): Promise<readonly SdkCollection[]>;
    findBySlug(slug: string): Promise<SdkCollection | null>;
  };
  users: {
    me(): Promise<SdkUser | null>;
    list(): Promise<readonly SdkUser[]>;
  };
  media: {
    list(): Promise<readonly SdkMedia[]>;
    upload(file: File | Blob): Promise<SdkMedia>;
    delete(id: string): Promise<void>;
  };
  roles: {
    list(): Promise<readonly SdkRole[]>;
  };
  auth: {
    login(input: { email: string; password: string }): Promise<{ token: string; user: SdkUser }>;
    logout(): Promise<void>;
  };
}

const EMPTY_PAGINATED = <T,>(): StubPaginated<T> => ({
  data: [],
  meta: { pageInfo: { hasNext: false, hasPrev: false, limit: 0, total: 0 }, totalCount: 0 },
});

/** Create a stub Q-CMS API client. */
export function createClient(config: StubClientConfig): StubClient {
  let token: string | undefined = config.token;
  return {
    config: { baseUrl: config.baseUrl, ...(token !== undefined ? { token } : {}) },
    setToken(next) {
      token = next;
      (this.config as { token?: string }).token = next;
    },
    entries<T = SdkEntry>(_collection: string) {
      return {
        list: async () => EMPTY_PAGINATED<T>(),
        get: async () => null,
        create: async (data) => ({ id: 'stub', data } as unknown as T),
        update: async (_id, data) => ({ id: 'stub', data } as unknown as T),
        delete: async () => {
          /* no-op */
        },
      };
    },
    collections: {
      list: async () => [],
      findBySlug: async () => null,
    },
    users: {
      me: async () => null,
      list: async () => [],
    },
    media: {
      list: async () => [],
      upload: async () => ({}) as SdkMedia,
      delete: async () => {
        /* no-op */
      },
    },
    roles: {
      list: async () => [],
    },
    auth: {
      login: async () => ({ token: 'stub', user: {} as SdkUser }),
      logout: async () => {
        /* no-op */
      },
    },
  };
}

export type { SdkEntry, SdkUser, SdkCollection, SdkMedia, SdkRole };
