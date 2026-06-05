import type {
  Collection,
  Entry,
  EntryId,
  Media,
  MediaId,
  Role,
  Slug,
  User,
} from '@q-cms/core';
import { ApiClientError } from './errors.js';
import { QueryBuilder } from './query-builder.js';
import type { ApiClientConfig, PaginatedResponse, RequestOptions } from './types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Token getter — punched through to sub-APIs so {@link ApiClient.setToken} propagates. */
type TokenFn = () => string | undefined;

function buildUrl(base: string, path: string, query?: QueryBuilder | URLSearchParams): string {
  const url = new URL(path, base);
  let params: URLSearchParams | undefined;
  if (query instanceof QueryBuilder) {
    params = query.toSearchParams();
  } else if (query) {
    params = query;
  }
  if (params) url.search = params.toString();
  return url.toString();
}

async function request<T>(
  url: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, { ...init, headers });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new ApiClientError({
      status: response.status,
      body,
      url,
    });
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Sub-APIs
// ---------------------------------------------------------------------------

export type ListParams = QueryBuilder | URLSearchParams | undefined;

class EntryApi {
  constructor(
    private baseUrl: string,
    private getToken: TokenFn,
    private collection: string,
  ) {}

  list(
    query?: ListParams,
    opts?: RequestOptions,
  ): Promise<PaginatedResponse<Entry>> {
    const q = applyRequestOptions(query, opts);
    return request(buildUrl(this.baseUrl, `/api/entries/${this.collection}`, q), {
      signal: opts?.signal ?? null,
    }, this.getToken());
  }

  get(id: EntryId, opts?: RequestOptions): Promise<Entry> {
    return request(buildUrl(this.baseUrl, `/api/entries/${this.collection}/${id}`, requestQuery(opts)), {
      signal: opts?.signal ?? null,
    }, this.getToken());
  }

  create(data: Partial<Entry>, opts?: RequestOptions): Promise<Entry> {
    return request(buildUrl(this.baseUrl, `/api/entries/${this.collection}`, requestQuery(opts)), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: opts?.signal ?? null,
    }, this.getToken());
  }

  update(id: EntryId, data: Partial<Entry>, opts?: RequestOptions): Promise<Entry> {
    return request(buildUrl(this.baseUrl, `/api/entries/${this.collection}/${id}`, requestQuery(opts)), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: opts?.signal ?? null,
    }, this.getToken());
  }

  delete(id: EntryId, opts?: RequestOptions): Promise<void> {
    return request(buildUrl(this.baseUrl, `/api/entries/${this.collection}/${id}`, requestQuery(opts)), {
      method: 'DELETE',
      signal: opts?.signal ?? null,
    }, this.getToken());
  }
}

class CollectionApi {
  constructor(
    private baseUrl: string,
    private getToken: TokenFn,
  ) {}

  list(query?: ListParams, opts?: RequestOptions): Promise<PaginatedResponse<Collection>> {
    const q = applyRequestOptions(query, opts);
    return request(buildUrl(this.baseUrl, '/api/collections', q), {
      signal: opts?.signal ?? null,
    }, this.getToken());
  }

  get(id: string, opts?: RequestOptions): Promise<Collection> {
    return request(buildUrl(this.baseUrl, `/api/collections/${id}`, requestQuery(opts)), {
      signal: opts?.signal ?? null,
    }, this.getToken());
  }

  findBySlug(slug: Slug, opts?: RequestOptions): Promise<Collection> {
    const params = applyRequestOptions(new URLSearchParams({ slug }), opts);
    return request(buildUrl(this.baseUrl, '/api/collections', params), {
      signal: opts?.signal ?? null,
    }, this.getToken()) as Promise<Collection>;
  }
}

class UserApi {
  constructor(
    private baseUrl: string,
    private getToken: TokenFn,
  ) {}

  me(opts?: RequestOptions): Promise<User> {
    return request(buildUrl(this.baseUrl, '/api/users/me', requestQuery(opts)), {
      signal: opts?.signal ?? null,
    }, this.getToken());
  }

  list(query?: ListParams, opts?: RequestOptions): Promise<PaginatedResponse<User>> {
    const q = applyRequestOptions(query, opts);
    return request(buildUrl(this.baseUrl, '/api/users', q), {
      signal: opts?.signal ?? null,
    }, this.getToken());
  }
}

class MediaApi {
  constructor(
    private baseUrl: string,
    private getToken: TokenFn,
  ) {}

  list(query?: ListParams, opts?: RequestOptions): Promise<PaginatedResponse<Media>> {
    const q = applyRequestOptions(query, opts);
    return request(buildUrl(this.baseUrl, '/api/media', q), {
      signal: opts?.signal ?? null,
    }, this.getToken());
  }

  async upload(file: Blob, metadata?: Record<string, unknown>, opts?: RequestOptions): Promise<Media> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    return request(buildUrl(this.baseUrl, '/api/media', requestQuery(opts)), {
      method: 'POST',
      body: formData,
      signal: opts?.signal ?? null,
    }, this.getToken());
  }

  delete(id: MediaId, opts?: RequestOptions): Promise<void> {
    return request(buildUrl(this.baseUrl, `/api/media/${id}`, requestQuery(opts)), {
      method: 'DELETE',
      signal: opts?.signal ?? null,
    }, this.getToken());
  }
}

class RoleApi {
  constructor(
    private baseUrl: string,
    private getToken: TokenFn,
  ) {}

  list(query?: ListParams, opts?: RequestOptions): Promise<PaginatedResponse<Role>> {
    const q = applyRequestOptions(query, opts);
    return request(buildUrl(this.baseUrl, '/api/roles', q), {
      signal: opts?.signal ?? null,
    }, this.getToken());
  }
}

class AuthApi {
  constructor(
    private baseUrl: string,
    private getToken: TokenFn,
  ) {}

  login(email: string, password: string, opts?: RequestOptions): Promise<{ user: User; token: string }> {
    return request(buildUrl(this.baseUrl, '/api/auth/login', requestQuery(opts)), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: opts?.signal ?? null,
    }, this.getToken());
  }

  logout(opts?: RequestOptions): Promise<void> {
    return request(buildUrl(this.baseUrl, '/api/auth/logout', requestQuery(opts)), {
      method: 'POST',
      signal: opts?.signal ?? null,
    }, this.getToken());
  }

  refresh(opts?: RequestOptions): Promise<{ token: string }> {
    return request(buildUrl(this.baseUrl, '/api/auth/refresh', requestQuery(opts)), {
      method: 'POST',
      signal: opts?.signal ?? null,
    }, this.getToken());
  }
}

// ---------------------------------------------------------------------------
// Helpers for option composition
// ---------------------------------------------------------------------------

function requestQuery(opts?: RequestOptions): URLSearchParams | undefined {
  if (!opts?.locale) return undefined;
  return new URLSearchParams({ locale: opts.locale });
}

function applyRequestOptions(
  base: QueryBuilder | URLSearchParams | undefined,
  opts?: RequestOptions,
): QueryBuilder | URLSearchParams | undefined {
  if (!opts?.locale) return base;
  const localeParams = new URLSearchParams({ locale: opts.locale });
  if (base === undefined) return localeParams;
  if (base instanceof QueryBuilder) {
    base.locale(opts.locale);
    return base;
  }
  const merged = new URLSearchParams(base.toString());
  merged.set('locale', opts.locale);
  return merged;
}

// ---------------------------------------------------------------------------
// ApiClient
// ---------------------------------------------------------------------------

/**
 * Type-safe fetch wrapper for the CMS API.
 *
 * ```ts
 * const cms = new ApiClient({ baseUrl: 'https://cms.example.com', token: '…' });
 * const posts = await cms.entries('posts').list(
 *   new QueryBuilder().filter('status', 'eq', 'published').sort('createdAt', 'desc').limit(10)
 * );
 * ```
 */
export class ApiClient {
  readonly baseUrl: string;
  private token: string | undefined;

  /** Lazy sub-APIs — created once, re-read token via getter on each call. */
  private _collections?: CollectionApi;
  private _users?: UserApi;
  private _media?: MediaApi;
  private _roles?: RoleApi;
  private _auth?: AuthApi;
  private _entries = new Map<string, EntryApi>();

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
  }

  /** Update the bearer token used for authenticated requests. */
  setToken(token: string): void {
    this.token = token;
  }

  private getToken = (): string | undefined => this.token;

  /** Entry operations scoped to a specific collection. */
  entries(collection: string): EntryApi {
    let api = this._entries.get(collection);
    if (!api) {
      api = new EntryApi(this.baseUrl, this.getToken, collection);
      this._entries.set(collection, api);
    }
    return api;
  }

  /** Collection operations. */
  get collections(): CollectionApi {
    return (this._collections ??= new CollectionApi(this.baseUrl, this.getToken));
  }

  /** User operations. */
  get users(): UserApi {
    return (this._users ??= new UserApi(this.baseUrl, this.getToken));
  }

  /** Media operations. */
  get media(): MediaApi {
    return (this._media ??= new MediaApi(this.baseUrl, this.getToken));
  }

  /** Role operations. */
  get roles(): RoleApi {
    return (this._roles ??= new RoleApi(this.baseUrl, this.getToken));
  }

  /** Authentication operations. */
  get auth(): AuthApi {
    return (this._auth ??= new AuthApi(this.baseUrl, this.getToken));
  }
}
