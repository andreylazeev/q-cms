/**
 * Self-contained type stub for `@q-cms/core`.
 *
 * Used to break a transitive typecheck dependency on the real
 * package (which is still being finalized by other agents). The
 * real package will replace this at the import sites.
 *
 * The exported types here match the `index.ts` of `@q-cms/core` as
 * of the integration point.
 *
 * @module lib/stubs/core-shim
 */

// ---------------------------------------------------------------------------
// Branded primitives
// ---------------------------------------------------------------------------

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, 'UserId'>;
export type EntryId = Brand<string, 'EntryId'>;
export type CollectionId = Brand<string, 'CollectionId'>;
export type MediaId = Brand<string, 'MediaId'>;
export type RoleId = Brand<string, 'RoleId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type Locale = Brand<string, 'Locale'>;
export type Slug = Brand<string, 'Slug'>;
export type Email = Brand<string, 'Email'>;
export type Url = Brand<string, 'Url'>;

// ---------------------------------------------------------------------------
// Scalars & enums
// ---------------------------------------------------------------------------

export type Iso8601 = string;
export type Json = unknown;

export type UserStatus = 'active' | 'inactive' | 'pending';
export type EntryStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'other';
export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'exhausted';
export type EmailStatus = 'pending' | 'sent' | 'failed' | 'bounced';
export type WebhookEvent =
  | 'entry.create'
  | 'entry.update'
  | 'entry.publish'
  | 'entry.unpublish'
  | 'entry.delete'
  | 'media.upload'
  | 'media.delete'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'role.assign'
  | 'role.revoke';

// ---------------------------------------------------------------------------
// Domain entities
// ---------------------------------------------------------------------------

export interface User {
  id: UserId;
  email: Email;
  username: string | null;
  passwordHash: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarId: MediaId | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  totpEnabled: boolean;
  emailVerifiedAt: Iso8601 | null;
  lastLoginAt: Iso8601 | null;
  metadata: Json;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

export interface Session {
  id: SessionId;
  userId: UserId;
  tokenHash: string;
  ip: string | null;
  userAgent: string | null;
  expiresAt: Iso8601;
  createdAt: Iso8601;
  revokedAt: Iso8601 | null;
}

export interface ApiToken {
  id: string;
  userId: UserId;
  name: string;
  tokenHash: string;
  prefix: string;
  scopes: readonly string[];
  expiresAt: Iso8601 | null;
  lastUsedAt: Iso8601 | null;
  createdAt: Iso8601;
  revokedAt: Iso8601 | null;
}

export interface Role {
  id: RoleId;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Iso8601;
}

export interface PermissionCondition {
  field: string;
  op: 'eq' | 'neq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
  value: string | number | boolean | readonly (string | number)[];
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  conditions: readonly PermissionCondition[];
}

export interface RolePermission {
  roleId: RoleId;
  permissionId: string;
}

export interface UserRole {
  userId: UserId;
  roleId: RoleId;
  scope: Json;
  grantedBy: UserId | null;
  grantedAt: Iso8601;
}

export interface Collection {
  id: CollectionId;
  name: string;
  slug: string;
  isSingleton: boolean;
  draftAndPublish: boolean;
  versioning: boolean;
  schema: Json;
  settings: Json;
  displayName: string;
  displayNameI18n: Record<string, string>;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

export interface Entry<T = Json> {
  id: EntryId;
  collectionId: CollectionId;
  slug: Slug | null;
  status: EntryStatus;
  locale: Locale;
  isDefaultLocale: boolean;
  data: T;
  publishedAt: Iso8601 | null;
  scheduledPublishAt: Iso8601 | null;
  scheduledUnpublishAt: Iso8601 | null;
  createdBy: UserId | null;
  updatedBy: UserId | null;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

export interface EntryRevision {
  id: string;
  entryId: EntryId;
  version: number;
  status: EntryStatus;
  data: Json;
  createdBy: UserId | null;
  createdAt: Iso8601;
  comment: string | null;
}

export interface EntryRelation {
  id: string;
  sourceId: EntryId;
  targetId: EntryId;
  field: string;
  relationType: 'direct' | 'inherited';
  metadata: Json;
  createdAt: Iso8601;
}

export interface EntryComment {
  id: string;
  entryId: EntryId;
  blockId: string | null;
  threadId: string | null;
  body: string;
  resolvedAt: Iso8601 | null;
  createdBy: UserId | null;
  createdAt: Iso8601;
}

export interface Media {
  id: MediaId;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  storageKey: string;
  type: MediaType;
  width: number | null;
  height: number | null;
  duration: number | null;
  altText: string | null;
  caption: string | null;
  focalPoint: { x: number; y: number } | null;
  folderId: string | null;
  uploadedBy: UserId | null;
  metadata: Json;
  isProcessed: boolean;
  virusScanned: boolean;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

export interface MediaVariant {
  id: string;
  mediaId: MediaId;
  variantName: string;
  width: number | null;
  height: number | null;
  format: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: Iso8601;
}

export interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  createdBy: UserId | null;
  createdAt: Iso8601;
}

export interface WebhookRetryPolicy {
  maxAttempts: number;
  backoff: 'linear' | 'exponential' | 'fixed';
  initialDelayMs: number;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: readonly WebhookEvent[];
  secret: string;
  headers: Record<string, string>;
  isActive: boolean;
  retryPolicy: WebhookRetryPolicy;
  createdBy: UserId | null;
  createdAt: Iso8601;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: Json;
  attempt: number;
  status: WebhookDeliveryStatus;
  responseCode: number | null;
  responseBody: string | null;
  responseHeaders: Record<string, string> | null;
  errorMessage: string | null;
  durationMs: number | null;
  scheduledAt: Iso8601;
  deliveredAt: Iso8601 | null;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: readonly string[];
  isActive: boolean;
}

export interface EmailQueueItem {
  id: string;
  toEmail: string;
  fromEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  templateName: string | null;
  variables: Json;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  scheduledAt: Iso8601;
  sentAt: Iso8601 | null;
}

export interface AuditDiff {
  [field: string]: { from: Json; to: Json };
}

export interface AuditLogEntry {
  id: string;
  actorId: UserId | null;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  diff: AuditDiff | null;
  context: Record<string, Json>;
  occurredAt: Iso8601;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PageInfo {
  nextCursor: string | null;
  prevCursor: string | null;
  limit: number;
  total: number | null;
}

export interface PageInput {
  limit: number;
  cursor: string | null;
  withTotal: boolean;
}

export interface Paginated<T> {
  data: readonly T[];
  page: PageInfo;
}

// ---------------------------------------------------------------------------
// Filtering & sorting
// ---------------------------------------------------------------------------

export type FilterOperator =
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

export interface Filter {
  field: string;
  op: FilterOperator;
  value?: Json;
}

export type SortDirection = 'asc' | 'desc';
export interface Sort {
  field: string;
  direction: SortDirection;
}
export type SortInput = readonly Sort[];

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

export type LocalizedString = Readonly<Record<Locale, string>>;

// ---------------------------------------------------------------------------
// Image transforms
// ---------------------------------------------------------------------------

export type ImageFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
export type ImageFormat = 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';
export interface ImageTransform {
  width?: number;
  height?: number;
  fit?: ImageFit;
  format?: ImageFormat;
  quality?: number;
  blur?: boolean;
}

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

export class DomainError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly meta: Record<string, unknown>;
  constructor(
    message: string,
    code: string,
    httpStatus: number,
    meta: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.meta = meta;
    Object.setPrototypeOf(this, new.target.prototype);
  }
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      meta: this.meta,
    };
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super(message, 'VALIDATION_ERROR', 400, meta);
  }
}
export class NotFoundError extends DomainError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super(message, 'NOT_FOUND', 404, meta);
  }
}
export class ConflictError extends DomainError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super(message, 'CONFLICT', 409, meta);
  }
}
export class UnauthorizedError extends DomainError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super(message, 'UNAUTHORIZED', 401, meta);
  }
}
export class ForbiddenError extends DomainError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super(message, 'FORBIDDEN', 403, meta);
  }
}
export class RateLimitError extends DomainError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super(message, 'RATE_LIMIT', 429, meta);
  }
}
export class InvalidBrandError extends DomainError {
  constructor(brand: string, detail: string, meta: Record<string, unknown> = {}) {
    super(`Invalid ${brand}: ${detail}`, 'INVALID_BRAND', 400, { brand, ...meta });
  }
}
export class InternalError extends DomainError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super(message, 'INTERNAL_ERROR', 500, meta);
  }
}

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = Error> = Ok<T> | Err<E>;

export function Ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}
export function Err<E>(error: E): Err<E> {
  return { ok: false, error };
}
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? Ok(fn(result.value)) : result;
}
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : Err(fn(result.error));
}
export function andThen<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw result.error instanceof Error
    ? result.error
    : new Error(`unwrap on Err: ${String(result.error)}`);
}
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}
export function match<T, E, R>(
  result: Result<T, E>,
  handlers: { ok: (value: T) => R; err: (error: E) => R },
): R {
  return result.ok ? handlers.ok(result.value) : handlers.err(result.error);
}
export async function fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
  try {
    return Ok(await promise);
  } catch (cause) {
    return Err(cause instanceof Error ? cause : new Error(String(cause)));
  }
}
export function fromThrowable<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    return Ok(fn());
  } catch (cause) {
    return Err(cause as E);
  }
}
export async function fromAsyncThrowable<T, E = Error>(fn: () => Promise<T>): Promise<Result<T, E>> {
  try {
    return Ok(await fn());
  } catch (cause) {
    return Err(cause as E);
  }
}
