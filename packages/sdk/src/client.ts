/**
 * The {@link createClient} factory and the public {@link QcmsClient}
 * surface exposed to consumers.
 *
 * The client is a thin, typed wrapper around `fetch` that:
 *  - injects the right `Authorization` header from a Bearer token
 *    or a personal access token (`apiKey`);
 *  - serializes JSON bodies and parses JSON:API-ish envelopes;
 *  - maps API errors onto the SDK's error hierarchy;
 *  - retries transient (5xx / network) failures with exponential
 *    backoff + jitter.
 *
 * @module client
 */

import {
  QcmsAuthError,
  QcmsError,
  QcmsNetworkError,
  QcmsRateLimitError,
  QcmsServerError,
  mapApiError,
} from './errors.ts';
import { QueryBuilder, type QueryExecutor } from './query-builder.ts';
import type {
  EntryStatus,
  Iso8601,
  Json,
  PageInfo,
  Paginated,
  QcmsConfig,
  RequestOptions,
  SdkApiError,
  SdkApiErrorEnvelope,
  SdkAuditLog,
  SdkCollection,
  SdkCollectionEnvelope,
  SdkEntry,
  SdkLoginInput,
  SdkLoginResponse,
  SdkMedia,
  SdkMediaTransform,
  SdkMediaUploadMeta,
  SdkResourceEnvelope,
  SdkRole,
  SdkRoleInput,
  SdkSearchOptions,
  SdkSearchResponse,
  SdkUser,
  SdkUserCreateInput,
  SdkUserUpdateInput,
  SdkWebhook,
  SdkWebhookDelivery,
  SdkWebhookInput,
} from './types.ts';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_BACKOFF = 250;
const DEFAULT_TIMEOUT_MS = 30_000;
const VERSION = '0.1.0';
const SDK_HEADER = `@q-cms/sdk/${VERSION}`;

// ---------------------------------------------------------------------------
// Public client shape
// ---------------------------------------------------------------------------

/** Top-level client. Returned by {@link createClient}. */
export interface QcmsClient {
  readonly config: ResolvedQcmsConfig;
  /** Resolve / reissue the Bearer token used for subsequent calls. */
  setToken(token: string | undefined): void;
  /** Resolve / clear the API key used for subsequent calls. */
  setApiKey(apiKey: string | undefined): void;
  /** Start a fluent query for a collection. */
  entries<T extends SdkEntry = SdkEntry>(collectionSlug: string): QueryBuilder<T>;
  /** Media namespace. */
  media: MediaNamespace;
  /** Users namespace. */
  users: UsersNamespace;
  /** Auth namespace. */
  auth: AuthNamespace;
  /** Full-text search. */
  search<T = Json>(q: string, opts?: SdkSearchOptions): Promise<SdkSearchResponse<T>>;
  /** Webhooks namespace. */
  webhooks: WebhooksNamespace;
  /** Collections namespace. */
  collections: CollectionsNamespace;
  /** Roles namespace. */
  roles: RolesNamespace;
  /** Audit log namespace. */
  audit: AuditNamespace;
  /** Low-level escape hatch. */
  request<T>(method: string, path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
}

/** Resolved, fully-defaulted config (returned on `client.config`). */
export interface ResolvedQcmsConfig extends QcmsConfig {
  maxRetries: number;
  initialBackoffMs: number;
  timeoutMs: number;
  fetch: typeof fetch;
}

// ---------------------------------------------------------------------------
// Sub-namespaces
// ---------------------------------------------------------------------------

export interface MediaNamespace {
  findById(id: string): Promise<SdkMedia>;
  list(params?: { limit?: number; cursor?: string; type?: string }): Promise<Paginated<SdkMedia>>;
  upload(file: Blob | File | ArrayBuffer, meta?: SdkMediaUploadMeta): Promise<SdkMedia>;
  delete(id: string): Promise<void>;
  render(id: string, transform: SdkMediaTransform): string;
}

export interface UsersNamespace {
  me(): Promise<SdkUser>;
  findById(id: string): Promise<SdkUser>;
  list(params?: { limit?: number; cursor?: string; q?: string }): Promise<Paginated<SdkUser>>;
  create(input: SdkUserCreateInput): Promise<SdkUser>;
  update(id: string, input: SdkUserUpdateInput): Promise<SdkUser>;
  delete(id: string): Promise<void>;
  assignRole(userId: string, roleId: string, scope?: Json): Promise<void>;
  revokeRole(userId: string, roleId: string): Promise<void>;
}

export interface AuthNamespace {
  login(input: SdkLoginInput): Promise<SdkLoginResponse>;
  logout(): Promise<void>;
  refresh(): Promise<SdkLoginResponse>;
  magicLink(email: string): Promise<void>;
  me(): Promise<SdkUser>;
}

export interface WebhooksNamespace {
  list(): Promise<Paginated<SdkWebhook>>;
  create(input: SdkWebhookInput): Promise<SdkWebhook>;
  update(id: string, input: Partial<SdkWebhookInput>): Promise<SdkWebhook>;
  delete(id: string): Promise<void>;
  getDeliveries(webhookId: string, params?: { limit?: number; cursor?: string }): Promise<Paginated<SdkWebhookDelivery>>;
  retry(deliveryId: string): Promise<SdkWebhookDelivery>;
}

export interface CollectionsNamespace {
  list(): Promise<readonly SdkCollection[]>;
  findBySlug(slug: string): Promise<SdkCollection>;
}

export interface RolesNamespace {
  list(): Promise<readonly SdkRole[]>;
  create(input: SdkRoleInput): Promise<SdkRole>;
  update(id: string, input: Partial<SdkRoleInput>): Promise<SdkRole>;
  delete(id: string): Promise<void>;
}

export interface AuditNamespace {
  list(params?: { limit?: number; cursor?: string; actorId?: string; resourceType?: string }): Promise<Paginated<SdkAuditLog>>;
}

// ---------------------------------------------------------------------------
// Internal request type
// ---------------------------------------------------------------------------

/** Internal request function shape. */
type RequestFn = <T>(
  method: string,
  path: string,
  body: unknown | undefined,
  opts: RequestOptions | undefined,
  parseEnvelope: boolean,
) => Promise<T>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new {@link QcmsClient}.
 *
 * @param config - {@link QcmsConfig}; at minimum `baseUrl`.
 *
 * @example
 * ```ts
 * const cms = createClient({
 *   baseUrl: 'https://cms.example.com',
 *   token: process.env.QCMS_TOKEN!,
 * });
 * const { data } = await cms.entries('Article').where({ status: 'published' }).get();
 * ```
 */
export function createClient(config: QcmsConfig): QcmsClient {
  if (!config || !config.baseUrl) {
    throw new QcmsError('createClient: `baseUrl` is required', 'config', 0);
  }
  const resolved: ResolvedQcmsConfig = {
    ...config,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    initialBackoffMs: config.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    fetch: config.fetch ?? globalThis.fetch.bind(globalThis),
  };
  if (typeof resolved.fetch !== 'function') {
    throw new QcmsError('createClient: no fetch implementation available', 'config', 0);
  }
  if (!resolved.baseUrl.endsWith('/')) resolved.baseUrl += '/';
  if (!/\/api\/v\d+\/?$/.test(resolved.baseUrl)) {
    resolved.baseUrl = resolved.baseUrl.replace(/\/?$/, '') + '/api/v1/';
  }

  let token: string | undefined = resolved.token;
  let apiKey: string | undefined = resolved.apiKey;

  const performRequest: RequestFn = async <T>(
    method: string,
    path: string,
    body: unknown | undefined,
    opts: RequestOptions | undefined,
    parseEnvelope: boolean,
  ): Promise<T> => {
    const url = buildUrl(resolved.baseUrl, path, opts?.query);
    const fetchImpl = opts?.fetch ?? resolved.fetch;
    const maxRetries = opts?.noRetry ? 0 : resolved.maxRetries;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), resolved.timeoutMs);
    const signal = opts?.signal
      ? mergeSignals(opts.signal, controller.signal)
      : controller.signal;

    const headers = buildHeaders(token, apiKey, resolved.locale, opts?.headers, body);
    const init: RequestInit = {
      method,
      headers,
      ...(body === undefined ? {} : { body: serializeBody(body, headers) }),
      signal,
    };

    let lastError: QcmsError | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetchImpl(url, init);
        clearTimeout(timeoutHandle);
        if (response.status >= 500 && attempt < maxRetries) {
          lastError = await buildServerErrorFromResponse(response);
          await sleep(backoff(resolved.initialBackoffMs, attempt));
          continue;
        }
        return await parseResponse<T>(response, parseEnvelope);
      } catch (cause) {
        clearTimeout(timeoutHandle);
        if (cause instanceof QcmsError) {
          if (isRetryable(cause) && attempt < maxRetries) {
            lastError = cause;
            await sleep(backoff(resolved.initialBackoffMs, attempt));
            continue;
          }
          throw cause;
        }
        const networkError = cause instanceof Error
          ? new QcmsNetworkError(cause.message, cause)
          : new QcmsNetworkError(String(cause));
        if (attempt < maxRetries) {
          lastError = networkError;
          await sleep(backoff(resolved.initialBackoffMs, attempt));
          continue;
        }
        throw networkError;
      }
    }
    throw lastError ?? new QcmsError('Request failed', 'unknown', 0);
  };

  const executor: QueryExecutor = {
    async list(path, query) {
      const env = await performRequest<SdkCollectionEnvelope<SdkEntry> | Paginated<SdkEntry>>(
        'GET',
        path,
        undefined,
        { query },
        true,
      );
      return normalizeCollectionResponse(env);
    },
    get: (path, query) =>
      performRequest<SdkEntry | SdkResourceEnvelope<SdkEntry>>(
        'GET',
        path,
        undefined,
        { query },
        true,
      ).then(unwrapResource),
    create: (path, body) =>
      performRequest<SdkEntry | SdkResourceEnvelope<SdkEntry>>(
        'POST',
        path,
        body,
        undefined,
        true,
      ).then(unwrapResource),
    update: (path, body) =>
      performRequest<SdkEntry | SdkResourceEnvelope<SdkEntry>>(
        'PATCH',
        path,
        body,
        undefined,
        true,
      ).then(unwrapResource),
    delete: async (path) => {
      await performRequest<unknown>('DELETE', path, undefined, undefined, false);
    },
    post: (path, body) =>
      performRequest<SdkEntry | SdkResourceEnvelope<SdkEntry>>(
        'POST',
        path,
        body,
        undefined,
        true,
      ).then(unwrapResource),
  };

  const client: QcmsClient = {
    config: resolved,
    setToken(next) {
      token = next;
    },
    setApiKey(next) {
      apiKey = next;
    },
    entries<T extends SdkEntry = SdkEntry>(slug: string) {
      return new QueryBuilder<T>(slug, executor, resolved.locale);
    },
    media: makeMediaNamespace(performRequest, resolved),
    users: makeUsersNamespace(performRequest),
    auth: makeAuthNamespace(performRequest, (next) => {
      token = next;
    }),
    search<T = Json>(q: string, searchOpts?: SdkSearchOptions) {
      const query: Record<string, string | number | boolean> = { q };
      const effectiveLocale = searchOpts?.locale ?? resolved.locale;
      if (searchOpts?.collection) query['collection'] = searchOpts.collection;
      if (effectiveLocale) query['locale'] = String(effectiveLocale);
      if (searchOpts?.limit !== undefined) query['limit'] = searchOpts.limit;
      if (searchOpts?.offset !== undefined) query['offset'] = searchOpts.offset;
      if (searchOpts?.fields) query['fields'] = searchOpts.fields.join(',');
      if (searchOpts?.filter) {
        for (const [field, value] of Object.entries(searchOpts.filter)) {
          if (value === null) {
            query[`filter[${field}]`] = 'isNull';
          } else if (typeof value === 'object' && !Array.isArray(value)) {
            for (const [op, opValue] of Object.entries(value as Record<string, unknown>)) {
              query[`filter[${field}]`] = `${op}.${String(opValue)}`;
            }
          } else {
            query[`filter[${field}]`] = String(value);
          }
        }
      }
      return performRequest<SdkSearchResponse<T>>('GET', '/search', undefined, { query }, true);
    },
    webhooks: makeWebhooksNamespace(performRequest),
    collections: makeCollectionsNamespace(performRequest),
    roles: makeRolesNamespace(performRequest),
    audit: makeAuditNamespace(performRequest),
    request<T>(method: string, path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
      return performRequest<T>(method, path, body, opts, true);
    },
  };

  return client;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUrl(
  base: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  let url = base + cleanPath;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      params.append(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  return url;
}

function buildHeaders(
  token: string | undefined,
  apiKey: string | undefined,
  locale: string | undefined,
  extra: Record<string, string> | undefined,
  body: unknown,
): Headers {
  const h = new Headers();
  h.set('Accept', 'application/json');
  h.set('X-Client', SDK_HEADER);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) h.set(k, v);
  }
  if (locale && !h.has('Accept-Language')) h.set('Accept-Language', locale);
  if (token) {
    h.set('Authorization', `Bearer ${token}`);
  } else if (apiKey) {
    h.set('Authorization', `Bearer ${apiKey}`);
  }
  if (body !== undefined && body !== null && !h.has('Content-Type')) {
    h.set('Content-Type', 'application/json');
  }
  return h;
}

function serializeBody(body: unknown, headers: Headers): BodyInit {
  const contentType = headers.get('Content-Type') ?? '';
  if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
    return body as BodyInit;
  }
  if (contentType.includes('application/json')) {
    return JSON.stringify(body);
  }
  return JSON.stringify(body);
}

async function parseResponse<T>(response: Response, parseEnvelope: boolean): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await safeJson(response) : await response.text();
  if (response.status >= 200 && response.status < 300) {
    if (!parseEnvelope) return undefined as unknown as T;
    return body as T;
  }
  throw classifyHttpError(response.status, body, response.headers);
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function classifyHttpError(status: number, body: unknown, headers: Headers): QcmsError {
  const apiError = extractApiError(body);
  const message = apiError?.detail ?? apiError?.title ?? (typeof body === 'string' ? body : `HTTP ${status}`);
  if (status === 401) {
    return new QcmsAuthError(message, apiError);
  }
  if (status === 429) {
    const retryAfterRaw = headers.get('Retry-After');
    const retryAfter = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : null;
    return new QcmsRateLimitError(message, retryAfter, apiError, { retryAfter });
  }
  return mapApiError(status, apiError, message);
}

function extractApiError(body: unknown): SdkApiError | null {
  if (!body || typeof body !== 'object') return null;
  const env = body as SdkApiErrorEnvelope;
  if (Array.isArray(env.errors) && env.errors.length > 0) {
    return env.errors[0] ?? null;
  }
  return null;
}

async function buildServerErrorFromResponse(response: Response): Promise<QcmsServerError> {
  const body = await safeJson(response);
  const apiError = extractApiError(body);
  return new QcmsServerError(
    apiError?.detail ?? apiError?.title ?? `HTTP ${response.status}`,
    response.status,
    apiError,
  );
}

function isRetryable(error: QcmsError): boolean {
  if (error instanceof QcmsServerError) return true;
  if (error instanceof QcmsNetworkError) return true;
  return false;
}

function backoff(initialMs: number, attempt: number): number {
  const base = Math.min(initialMs * 2 ** attempt, 8_000);
  return Math.floor(Math.random() * base);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });
  return controller.signal;
}

function unwrapResource<T>(value: T | SdkResourceEnvelope<T>): T {
  if (value && typeof value === 'object' && 'data' in (value as Record<string, unknown>)) {
    return (value as SdkResourceEnvelope<T>).data;
  }
  return value as T;
}

function normalizeCollectionResponse(
  env: SdkCollectionEnvelope<SdkEntry> | Paginated<SdkEntry>,
): { data: SdkEntry[]; page: PageInfo; total: number | null } {
  if ('data' in env && Array.isArray(env.data)) {
    const meta = (env as SdkCollectionEnvelope<SdkEntry>).meta ?? {};
    const pageInfo = (meta as { pageInfo?: PageInfo }).pageInfo;
    const total = (meta as { totalCount?: number }).totalCount ?? null;
    return {
      data: [...env.data],
      page: pageInfo ?? defaultPageInfo(),
      total,
    };
  }
  const paginated = env as Paginated<SdkEntry>;
  return {
    data: [...paginated.data],
    page: paginated.meta.pageInfo,
    total: paginated.meta.totalCount,
  };
}

function defaultPageInfo(): PageInfo {
  return { hasNext: false, hasPrev: false, startCursor: null, endCursor: null, limit: 0, total: null };
}

// ---------------------------------------------------------------------------
// Namespace factories
// ---------------------------------------------------------------------------

function makeMediaNamespace(request: RequestFn, config: ResolvedQcmsConfig): MediaNamespace {
  return {
    findById: (id) => request<SdkMedia | SdkResourceEnvelope<SdkMedia>>('GET', `/media/${encodeURIComponent(id)}`, undefined, undefined, true).then(unwrapResource),
    list: (params) => {
      const query: Record<string, string> = {};
      if (params?.limit !== undefined) query['limit'] = String(params.limit);
      if (params?.cursor) query['cursor'] = params.cursor;
      if (params?.type) query['type'] = params.type;
      return request<Paginated<SdkMedia>>('GET', '/media', undefined, { query }, true);
    },
    upload: (file, meta) => {
      const form = new FormData();
      const blob = file instanceof Blob ? file : new Blob([file as ArrayBuffer]);
      const filename = meta?.filename ?? (file instanceof File ? file.name : 'upload.bin');
      form.append('file', blob, filename);
      if (meta?.alt) form.append('alt', meta.alt);
      if (meta?.caption) form.append('caption', meta.caption);
      if (meta?.folderId) form.append('folderId', meta.folderId);
      return request<SdkMedia | SdkResourceEnvelope<SdkMedia>>(
        'POST',
        '/media',
        form,
        { headers: {} },
        true,
      ).then(unwrapResource);
    },
    delete: async (id) => {
      await request<unknown>('DELETE', `/media/${encodeURIComponent(id)}`, undefined, undefined, false);
    },
    render: (id, transform) => {
      const params = new URLSearchParams();
      if (transform.width !== undefined) params.set('w', String(transform.width));
      if (transform.height !== undefined) params.set('h', String(transform.height));
      if (transform.fit) params.set('fit', transform.fit);
      if (transform.format) params.set('format', transform.format);
      if (transform.quality !== undefined) params.set('q', String(transform.quality));
      if (transform.blur) params.set('blur', 'true');
      if (transform.preset) params.set('preset', transform.preset);
      const base = config.baseUrl.replace(/\/api\/v\d+\/$/, '');
      return `${base}/media/${encodeURIComponent(id)}/render?${params.toString()}`;
    },
  };
}

function makeUsersNamespace(request: RequestFn): UsersNamespace {
  return {
    me: () => request<SdkUser | SdkResourceEnvelope<SdkUser>>('GET', '/users/me', undefined, undefined, true).then(unwrapResource),
    findById: (id) => request<SdkUser | SdkResourceEnvelope<SdkUser>>('GET', `/users/${encodeURIComponent(id)}`, undefined, undefined, true).then(unwrapResource),
    list: (params) => {
      const query: Record<string, string> = {};
      if (params?.limit !== undefined) query['limit'] = String(params.limit);
      if (params?.cursor) query['cursor'] = params.cursor;
      if (params?.q) query['q'] = params.q;
      return request<Paginated<SdkUser>>('GET', '/users', undefined, { query }, true);
    },
    create: (input) => request<SdkUser | SdkResourceEnvelope<SdkUser>>('POST', '/users', input, undefined, true).then(unwrapResource),
    update: (id, input) => request<SdkUser | SdkResourceEnvelope<SdkUser>>('PATCH', `/users/${encodeURIComponent(id)}`, input, undefined, true).then(unwrapResource),
    delete: async (id) => {
      await request<unknown>('DELETE', `/users/${encodeURIComponent(id)}`, undefined, undefined, false);
    },
    assignRole: async (userId, roleId, scope) => {
      await request<unknown>('POST', `/users/${encodeURIComponent(userId)}/roles`, { roleId, scope }, undefined, false);
    },
    revokeRole: async (userId, roleId) => {
      await request<unknown>('DELETE', `/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`, undefined, undefined, false);
    },
  };
}

function makeAuthNamespace(
  request: RequestFn,
  setToken: (next: string | undefined) => void,
): AuthNamespace {
  return {
    login: async (input) => {
      const result = await request<SdkLoginResponse>('POST', '/auth/login', input, undefined, true);
      setToken(result.token);
      return result;
    },
    logout: async () => {
      try {
        await request<unknown>('POST', '/auth/logout', undefined, undefined, false);
      } finally {
        setToken(undefined);
      }
    },
    refresh: async () => {
      const result = await request<SdkLoginResponse>('POST', '/auth/refresh', undefined, undefined, true);
      setToken(result.token);
      return result;
    },
    magicLink: async (email) => {
      await request<unknown>('POST', '/auth/magic-link', { email }, undefined, false);
    },
    me: () => request<SdkUser | SdkResourceEnvelope<SdkUser>>('GET', '/auth/me', undefined, undefined, true).then(unwrapResource),
  };
}

function makeWebhooksNamespace(request: RequestFn): WebhooksNamespace {
  return {
    list: () => request<Paginated<SdkWebhook>>('GET', '/webhooks', undefined, undefined, true),
    create: (input) => request<SdkWebhook | SdkResourceEnvelope<SdkWebhook>>('POST', '/webhooks', input, undefined, true).then(unwrapResource),
    update: (id, input) => request<SdkWebhook | SdkResourceEnvelope<SdkWebhook>>('PATCH', `/webhooks/${encodeURIComponent(id)}`, input, undefined, true).then(unwrapResource),
    delete: async (id) => {
      await request<unknown>('DELETE', `/webhooks/${encodeURIComponent(id)}`, undefined, undefined, false);
    },
    getDeliveries: (webhookId, params) => {
      const query: Record<string, string> = {};
      if (params?.limit !== undefined) query['limit'] = String(params.limit);
      if (params?.cursor) query['cursor'] = params.cursor;
      return request<Paginated<SdkWebhookDelivery>>('GET', `/webhooks/${encodeURIComponent(webhookId)}/deliveries`, undefined, { query }, true);
    },
    retry: (deliveryId) => request<SdkWebhookDelivery | SdkResourceEnvelope<SdkWebhookDelivery>>('POST', `/webhooks/deliveries/${encodeURIComponent(deliveryId)}/retry`, undefined, undefined, true).then(unwrapResource),
  };
}

function makeCollectionsNamespace(request: RequestFn): CollectionsNamespace {
  return {
    list: () => request<readonly SdkCollection[]>('GET', '/collections', undefined, undefined, true),
    findBySlug: (slug) => request<SdkCollection | SdkResourceEnvelope<SdkCollection>>('GET', `/collections/${encodeURIComponent(slug)}`, undefined, undefined, true).then(unwrapResource),
  };
}

function makeRolesNamespace(request: RequestFn): RolesNamespace {
  return {
    list: () => request<readonly SdkRole[]>('GET', '/roles', undefined, undefined, true),
    create: (input) => request<SdkRole | SdkResourceEnvelope<SdkRole>>('POST', '/roles', input, undefined, true).then(unwrapResource),
    update: (id, input) => request<SdkRole | SdkResourceEnvelope<SdkRole>>('PATCH', `/roles/${encodeURIComponent(id)}`, input, undefined, true).then(unwrapResource),
    delete: async (id) => {
      await request<unknown>('DELETE', `/roles/${encodeURIComponent(id)}`, undefined, undefined, false);
    },
  };
}

function makeAuditNamespace(request: RequestFn): AuditNamespace {
  return {
    list: (params) => {
      const query: Record<string, string> = {};
      if (params?.limit !== undefined) query['limit'] = String(params.limit);
      if (params?.cursor) query['cursor'] = params.cursor;
      if (params?.actorId) query['actorId'] = params.actorId;
      if (params?.resourceType) query['resourceType'] = params.resourceType;
      return request<Paginated<SdkAuditLog>>('GET', '/audit-log', undefined, { query }, true);
    },
  };
}

// Re-export for type re-export tests
export type { Iso8601, EntryStatus };
