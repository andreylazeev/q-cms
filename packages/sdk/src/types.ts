/**
 * Public types for the Q-CMS SDK.
 *
 * Re-exports the canonical domain types from `@q-cms/core` for
 * ergonomic consumption from end-users, then layers SDK-specific
 * types on top (config, query filters, pagination, request
 * envelopes, etc.).
 *
 * @module types
 */

import type {
  AuditLogEntry,
  Collection,
  Entry,
  EntryStatus,
  ImageFormat,
  ImageFit,
  Iso8601,
  Json,
  Locale,
  Media,
  Role,
  User,
  Webhook,
  WebhookDelivery,
  WebhookEvent,
  WebhookRetryPolicy,
} from '@q-cms/core';

// Re-export the imported core types so consumers can do
// `import type { Entry, Json, ... } from '@q-cms/sdk'`.
export type { AuditLogEntry, Collection, Entry, EntryStatus, ImageFormat, ImageFit, Iso8601, Json, Locale, Media, Role, User, Webhook, WebhookDelivery, WebhookEvent, WebhookRetryPolicy };

// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

/**
 * Configuration accepted by {@link createClient}.
 *
 * At least one of `token` or `apiKey` is recommended. `fetch` may be
 * overridden for SSR, edge runtimes, or for tests with `msw`.
 */
export interface QcmsConfig {
  /** Base URL of the Q-CMS API (e.g. `https://cms.example.com`). */
  baseUrl: string;
  /** Bearer JWT obtained from `auth.login` or `auth.refresh`. */
  token?: string;
  /** Long-lived personal access token (`qcs_…`). */
  apiKey?: string;
  /** Default locale to send with each request. */
  locale?: Locale | string;
  /** Custom fetch implementation (e.g. for testing or edge runtimes). */
  fetch?: typeof fetch;
  /** Number of automatic retries for transient (5xx / network) failures. */
  maxRetries?: number;
  /** Initial backoff in ms; doubled + jittered on each retry. */
  initialBackoffMs?: number;
  /** Hard cap on a single request, ms. */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Query / filter / pagination
// ---------------------------------------------------------------------------

/** Available filter operators (RQL subset accepted by the SDK). */
export type QcmsFilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'isNull'
  | 'isNotNull';

/** A single `field → value` filter — translated into RQL under the hood. */
export interface QcmsFilter {
  field: string;
  op: QcmsFilterOperator;
  value?: unknown;
}

/** Free-form filter object: `{ status: 'published', title: { contains: 'hi' } }`. */
export type QcmsFilterValue =
  | string
  | number
  | boolean
  | null
  | readonly (string | number)[]
  | { readonly [op: string]: string | number | boolean | readonly (string | number)[] | null };

/** Free-form filter object: `{ status: 'published', title: { contains: 'hi' } }`. */
export type QcmsFilterObject = { readonly [field: string]: QcmsFilterValue };

/** A filter clause accepted by `.where()` — either a typed filter or a raw RQL fragment. */
export type QcmsWhereClause = QcmsFilter | QcmsFilterObject | string;

/** Populate relation spec: field path, with optional projection / maxDepth. */
export interface QcmsPopulateSpec {
  field: string;
  fields?: readonly string[];
  maxDepth?: number;
}

/** Sort clause: `field` and direction. */
export interface QcmsSortClause {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Low-level query parameters accepted by the SDK before being serialized
 * into an RQL URL. Most callers should use the {@link QueryBuilder} instead.
 */
export interface QueryParams {
  where?: readonly QcmsWhereClause[];
  populate?: readonly (string | QcmsPopulateSpec)[];
  fields?: readonly string[];
  sort?: readonly (string | QcmsSortClause)[];
  limit?: number;
  offset?: number;
  cursor?: string;
  locale?: Locale | string;
  status?: EntryStatus | readonly EntryStatus[];
  withTotal?: boolean;
}

/** Page info embedded inside paginated responses. */
export interface PageInfo {
  hasNext: boolean;
  hasPrev: boolean;
  startCursor: string | null;
  endCursor: string | null;
  limit: number;
  total: number | null;
}

/** Paginated collection response from the API. */
export interface Paginated<T> {
  data: readonly T[];
  meta: {
    pageInfo: PageInfo;
    totalCount: number;
  };
}

// ---------------------------------------------------------------------------
// Resource shapes (convenience aliases)
// ---------------------------------------------------------------------------

/** A user record as returned by the API. */
export type SdkUser = User;
/** A role record. */
export type SdkRole = Role;
/** A collection (schema + metadata) record. */
export type SdkCollection = Collection;
/** A media record. */
export type SdkMedia = Media;
/** A webhook record. */
export type SdkWebhook = Webhook;
/** A webhook delivery log row. */
export type SdkWebhookDelivery = WebhookDelivery;
/** An audit log row. */
export type SdkAuditLog = AuditLogEntry;
/** A content entry (generic `data`). */
export type SdkEntry<T = Json> = Entry<T>;

/** Input for `media.upload`. */
export interface SdkMediaUploadMeta {
  alt?: string;
  caption?: string;
  folderId?: string;
  filename?: string;
}

/** Input for `media.render`. */
export interface SdkMediaTransform {
  width?: number;
  height?: number;
  fit?: ImageFit;
  format?: ImageFormat;
  quality?: number;
  blur?: boolean;
  preset?: string;
}

/** Input for `webhooks.create` / `webhooks.update`. */
export interface SdkWebhookInput {
  name: string;
  url: string;
  events: readonly WebhookEvent[];
  secret: string;
  headers?: Record<string, string>;
  isActive?: boolean;
  retryPolicy?: WebhookRetryPolicy;
}

/** Input for `users.create`. */
export interface SdkUserCreateInput {
  email: string;
  username?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  isSuperAdmin?: boolean;
}

/** Input for `users.update`. */
export interface SdkUserUpdateInput {
  email?: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isActive?: boolean;
  isSuperAdmin?: boolean;
}

/** Input for `roles.create` / `roles.update`. */
export interface SdkRoleInput {
  name: string;
  description?: string;
  permissions?: readonly { resource: string; action: string }[];
}

/** Input for `auth.login`. */
export interface SdkLoginInput {
  email: string;
  password: string;
  totpCode?: string;
}

/** Login response. */
export interface SdkLoginResponse {
  token: string;
  refreshToken: string;
  expiresAt: Iso8601;
  user: SdkUser;
}

/** Search options accepted by `client.search`. */
export interface SdkSearchOptions {
  collection?: string;
  locale?: Locale | string;
  limit?: number;
  offset?: number;
  filter?: QcmsFilterObject;
  fields?: readonly string[];
}

/** Search response. */
export interface SdkSearchResponse<T = Json> {
  data: readonly {
    id: string;
    type: string;
    attributes: T;
    meta: {
      score: number;
      highlights: Record<string, string>;
    };
  }[];
  meta: {
    query: string;
    total: number;
    processingTimeMs: number;
  };
}

// ---------------------------------------------------------------------------
// JSON:API–ish response envelopes
// ---------------------------------------------------------------------------

/** Resource envelope. */
export interface SdkResourceEnvelope<T> {
  data: T;
}

/** Collection envelope. */
export interface SdkCollectionEnvelope<T> {
  data: readonly T[];
  included?: readonly unknown[];
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Request options
// ---------------------------------------------------------------------------

/** Per-request options that override client-level defaults. */
export interface RequestOptions {
  /** Abort the request early. */
  signal?: AbortSignal;
  /** Override the default `fetch` for this call. */
  fetch?: typeof fetch;
  /** Disable automatic retries for this call. */
  noRetry?: boolean;
  /** Query parameters to merge with the body/path. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Extra headers to include. */
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Low-level error shape returned by the API
// ---------------------------------------------------------------------------

/** Single API error object (matches `API.md` §3.4). */
export interface SdkApiError {
  id?: string;
  status?: string | number;
  code: string;
  title: string;
  detail?: string;
  source?: { pointer?: string; parameter?: string };
  meta?: Record<string, unknown>;
}

/** Top-level `errors` array returned by the API. */
export interface SdkApiErrorEnvelope {
  errors: readonly SdkApiError[];
}
