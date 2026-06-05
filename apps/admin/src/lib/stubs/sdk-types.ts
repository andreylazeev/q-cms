/**
 * Local stub for `@q-cms/sdk` types. Re-exports the canonical domain
 * types from `@q-cms/core` and adds thin SDK-style aliases so the
 * admin app can develop against a stable contract.
 */

export type {
  User as SdkUser,
  Entry as SdkEntry,
  Collection as SdkCollection,
  Media as SdkMedia,
  Role as SdkRole,
  Webhook as SdkWebhook,
  WebhookDelivery as SdkWebhookDelivery,
  AuditLogEntry as SdkAuditLog,
  EntryStatus,
  Iso8601,
  Json,
  Locale,
  Slug,
  Email,
  Url,
  UserId,
  EntryId,
  CollectionId,
  MediaId,
  RoleId,
  SessionId,
} from '@q-cms/core';

export interface SdkLoginInput {
  email: string;
  password: string;
}

export interface SdkLoginResponse {
  token: string;
  user: import('@q-cms/core').User;
}

export interface PageInfo {
  hasNext: boolean;
  hasPrev: boolean;
  startCursor: string | null;
  endCursor: string | null;
  limit: number;
  total: number | null;
}

export interface Paginated<T> {
  data: readonly T[];
  meta: { pageInfo: PageInfo; totalCount: number };
}
