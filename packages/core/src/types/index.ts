/**
 * Shared TypeScript types for Q-CMS.
 *
 * These mirror the database schema in `DATA_MODEL.md` and are the
 * canonical type definitions for cross-package boundaries.
 *
 * @module types
 */

import type {
  CollectionId,
  Email,
  EntryId,
  Locale,
  MediaId,
  RoleId,
  SessionId,
  Slug,
  UserId,
} from '../branded.ts';

// ---------------------------------------------------------------------------
// Common scalar types
// ---------------------------------------------------------------------------

/** ISO-8601 timestamp string (e.g. `2026-06-05T12:00:00Z`). */
export type Iso8601 = string;
/** Arbitrary JSON value. Prefer narrower types at boundaries. */
export type Json = unknown;

// ---------------------------------------------------------------------------
// Enums (string literal unions)
// ---------------------------------------------------------------------------

/** Lifecycle status of a {@link User}. */
export type UserStatus = 'active' | 'inactive' | 'pending';

/** Editorial status of an {@link Entry}. */
export type EntryStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'archived';

/** Coarse media type — drives UI rendering and validation. */
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'other';

/** Webhook delivery lifecycle. */
export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'exhausted';

/** Lifecycle of an email message in the queue. */
export type EmailStatus = 'pending' | 'sent' | 'failed' | 'bounced';

/** Domain events emitted by webhooks. */
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
// Auth & RBAC
// ---------------------------------------------------------------------------

/** Row from `users` table. */
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

/** Row from `sessions` table. */
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

/** Row from `api_tokens` table. */
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

/** Row from `roles` table. */
export interface Role {
  id: RoleId;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Iso8601;
}

/** Per-field rule controlling when a permission applies. */
export interface PermissionCondition {
  /** Field path to inspect (e.g. `created_by`). */
  field: string;
  /** Comparison operator. */
  op: 'eq' | 'neq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
  /** Constant or expression reference (e.g. `$user.id`). */
  value: string | number | boolean | readonly (string | number)[];
}

/** Row from `permissions` table. */
export interface Permission {
  id: string;
  /** Resource identifier (e.g. `collection:Article`, `media`, `*`). */
  resource: string;
  /** Action identifier (e.g. `read`, `publish`, `*`). */
  action: string;
  conditions: readonly PermissionCondition[];
}

/** Per-role permission grant (join row). */
export interface RolePermission {
  roleId: RoleId;
  permissionId: string;
}

/** Per-user role grant with optional collection scope. */
export interface UserRole {
  userId: UserId;
  roleId: RoleId;
  scope: Json;
  grantedBy: UserId | null;
  grantedAt: Iso8601;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/** Row from `collections` table. */
export interface Collection {
  id: CollectionId;
  name: string;
  slug: string;
  isSingleton: boolean;
  draftAndPublish: boolean;
  versioning: boolean;
  /** JSON Schema (subset) describing fields. */
  schema: Json;
  settings: Json;
  displayName: string;
  displayNameI18n: Record<string, string>;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

/** Generic content entry — `data` shape is collection-defined. */
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

/** Row from `entry_revisions` table — full snapshot. */
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

/** Row from `entry_relations` table. */
export interface EntryRelation {
  id: string;
  sourceId: EntryId;
  targetId: EntryId;
  field: string;
  relationType: 'direct' | 'inherited';
  metadata: Json;
  createdAt: Iso8601;
}

/** Row from `entry_comments` table. */
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

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/** Row from `media` table. */
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
  /** Duration in seconds; for video / audio. */
  duration: number | null;
  altText: string | null;
  caption: string | null;
  /** Focal point for `object-fit: cover` cropping. */
  focalPoint: { x: number; y: number } | null;
  folderId: string | null;
  uploadedBy: UserId | null;
  metadata: Json;
  isProcessed: boolean;
  virusScanned: boolean;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

/** Row from `media_variants` table. */
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

/** Row from `media_folders` table. */
export interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  /** Materialized path (LTREE) — e.g. `blog.heroes.2026`. */
  path: string;
  createdBy: UserId | null;
  createdAt: Iso8601;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/** Retry policy attached to a {@link Webhook}. */
export interface WebhookRetryPolicy {
  maxAttempts: number;
  backoff: 'linear' | 'exponential' | 'fixed';
  initialDelayMs: number;
}

/** Row from `webhooks` table. */
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

/** Row from `webhook_deliveries` table. */
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

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/** Row from `email_templates` table. */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: readonly string[];
  isActive: boolean;
}

/** Row from `email_queue` table. */
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

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/** A single diff entry (`field`: `{ from, to }`). */
export interface AuditDiff {
  [field: string]: { from: Json; to: Json };
}

/** Row from `audit_log` table. */
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

/** Cursor- and total-aware pagination response envelope. */
export interface PageInfo {
  /** Opaque cursor for the next page; `null` when exhausted. */
  nextCursor: string | null;
  /** Opaque cursor for the previous page; `null` at the start. */
  prevCursor: string | null;
  /** Page size used. */
  limit: number;
  /** Total number of rows matching the query (expensive — opt-in). */
  total: number | null;
}

/** Request-side pagination input. */
export interface PageInput {
  /** Maximum rows per page. */
  limit: number;
  /** Cursor returned by a previous call. */
  cursor: string | null;
  /** Whether to compute `PageInfo.total` (costly COUNT(*)). */
  withTotal: boolean;
}

/** Result of a paginated query. */
export interface Paginated<T> {
  data: readonly T[];
  page: PageInfo;
}

// ---------------------------------------------------------------------------
// Filtering & sorting
// ---------------------------------------------------------------------------

/** Operators available on filter clauses. */
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

/** Single filter clause: field + operator + value. */
export interface Filter {
  field: string;
  op: FilterOperator;
  value?: Json;
}

/** Sort direction. */
export type SortDirection = 'asc' | 'desc';

/** Single sort clause. */
export interface Sort {
  field: string;
  direction: SortDirection;
}

/** Request-side sort input. */
export type SortInput = readonly Sort[];

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

/** Map of locale code → translated string. */
export type LocalizedString = Readonly<Record<Locale, string>>;

// ---------------------------------------------------------------------------
// Image transformations
// ---------------------------------------------------------------------------

/** Resize / crop fit strategy. */
export type ImageFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

/** Output image format. */
export type ImageFormat = 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';

/** Image transformation request used by the media proxy. */
export interface ImageTransform {
  width?: number;
  height?: number;
  fit?: ImageFit;
  format?: ImageFormat;
  quality?: number;
  /** `true` → generate a tiny blurred placeholder. */
  blur?: boolean;
}
