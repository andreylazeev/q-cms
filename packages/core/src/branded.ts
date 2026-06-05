/**
 * Branded primitive types for Q-CMS.
 *
 * A "brand" is a phantom TypeScript tag that prevents accidental mixing
 * of structurally identical primitives (e.g. confusing a `UserId` with
 * an `EntryId` even though both are strings at runtime).
 *
 * Brands are erased at runtime — they only exist in the type system.
 * Constructor functions validate input and throw {@link InvalidBrandError}
 * when the value is not well-formed.
 *
 * @module branded
 */

import { InvalidBrandError } from './errors/index.ts';

// ---------------------------------------------------------------------------
// Brand utility
// ---------------------------------------------------------------------------

/**
 * Attach a phantom tag `B` to a value of type `T`.
 *
 * @typeParam T - Underlying runtime type (e.g. `string`, `number`).
 * @typeParam B - Unique string literal identifying the brand.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

// ---------------------------------------------------------------------------
// Domain brands
// ---------------------------------------------------------------------------

/** UUID-style identifier for a user record. */
export type UserId = Brand<string, 'UserId'>;
/** UUID-style identifier for an entry record. */
export type EntryId = Brand<string, 'EntryId'>;
/** UUID-style identifier for a collection record. */
export type CollectionId = Brand<string, 'CollectionId'>;
/** UUID-style identifier for a media record. */
export type MediaId = Brand<string, 'MediaId'>;
/** UUID-style identifier for a role record. */
export type RoleId = Brand<string, 'RoleId'>;
/** UUID-style identifier for a session record. */
export type SessionId = Brand<string, 'SessionId'>;

/** BCP-47 / ISO-639 locale code (e.g. `en`, `ru`, `pt-BR`). */
export type Locale = Brand<string, 'Locale'>;
/** URL-safe identifier (lowercase, digits, dashes). */
export type Slug = Brand<string, 'Slug'>;
/** RFC-5322 compliant e-mail address. */
export type Email = Brand<string, 'Email'>;
/** RFC-3986 absolute URL with `http` or `https` scheme. */
export type Url = Brand<string, 'Url'>;

// ---------------------------------------------------------------------------
// Validation patterns
// ---------------------------------------------------------------------------

/**
 * Pragmatic UUID v4 pattern. Accepts the canonical 8-4-4-4-12 hex form
 * (case-insensitive). Not a full RFC-4122 validator — we want to catch
 * obviously malformed input without rejecting valid UUIDv7 / future
 * variants which share the same shape.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Locale pattern: 2-3 letter base language code, optional region tag.
 * Examples: `en`, `ru`, `pt-BR`, `zh-Hans`.
 */
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

/**
 * Slug pattern: lowercase letters, digits, dashes; cannot start or end
 * with a dash; must be 1-128 characters.
 */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/;

/** Practical e-mail pattern. Intentionally permissive. */
const EMAIL_PATTERN =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/** Absolute `http`/`https` URL. */
const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

// ---------------------------------------------------------------------------
// ID constructors (no format constraint beyond UUID-shape)
// ---------------------------------------------------------------------------

/** Validate UUID-shape and brand the value. */
function brandUuid<T extends string>(value: string, brand: string): T {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new InvalidBrandError(brand, `Invalid UUID: "${value}"`);
  }
  return value as T;
}

/** Construct a {@link UserId}, validating UUID shape. */
export function userId(value: string): UserId {
  return brandUuid<UserId>(value, 'UserId');
}

/** Construct an {@link EntryId}, validating UUID shape. */
export function entryId(value: string): EntryId {
  return brandUuid<EntryId>(value, 'EntryId');
}

/** Construct a {@link CollectionId}, validating UUID shape. */
export function collectionId(value: string): CollectionId {
  return brandUuid<CollectionId>(value, 'CollectionId');
}

/** Construct a {@link MediaId}, validating UUID shape. */
export function mediaId(value: string): MediaId {
  return brandUuid<MediaId>(value, 'MediaId');
}

/** Construct a {@link RoleId}, validating UUID shape. */
export function roleId(value: string): RoleId {
  return brandUuid<RoleId>(value, 'RoleId');
}

/** Construct a {@link SessionId}, validating UUID shape. */
export function sessionId(value: string): SessionId {
  return brandUuid<SessionId>(value, 'SessionId');
}

// ---------------------------------------------------------------------------
// Domain primitive constructors
// ---------------------------------------------------------------------------

/** Construct a {@link Locale}, validating BCP-47 shape. */
export function locale(value: string): Locale {
  if (typeof value !== 'string' || !LOCALE_PATTERN.test(value)) {
    throw new InvalidBrandError('Locale', `Invalid locale code: "${value}"`);
  }
  return value as Locale;
}

/** Construct a {@link Slug}, validating URL-safe shape. */
export function slug(value: string): Slug {
  if (typeof value !== 'string' || !SLUG_PATTERN.test(value)) {
    throw new InvalidBrandError('Slug', `Invalid slug: "${value}"`);
  }
  return value as Slug;
}

/** Construct an {@link Email}, validating RFC-5322 shape. */
export function email(value: string): Email {
  if (typeof value !== 'string' || !EMAIL_PATTERN.test(value)) {
    throw new InvalidBrandError('Email', `Invalid e-mail: "${value}"`);
  }
  return value as Email;
}

/** Construct a {@link Url}, validating absolute `http`/`https` shape. */
export function url(value: string): Url {
  if (typeof value !== 'string' || !URL_PATTERN.test(value)) {
    throw new InvalidBrandError('Url', `Invalid URL: "${value}"`);
  }
  return value as Url;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** Type guard for {@link UserId} (UUID-shape only). */
export function isUserId(value: unknown): value is UserId {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Type guard for {@link EntryId}. */
export function isEntryId(value: unknown): value is EntryId {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Type guard for {@link CollectionId}. */
export function isCollectionId(value: unknown): value is CollectionId {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Type guard for {@link MediaId}. */
export function isMediaId(value: unknown): value is MediaId {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Type guard for {@link RoleId}. */
export function isRoleId(value: unknown): value is RoleId {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Type guard for {@link SessionId}. */
export function isSessionId(value: unknown): value is SessionId {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Type guard for {@link Locale}. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALE_PATTERN.test(value);
}

/** Type guard for {@link Slug}. */
export function isSlug(value: unknown): value is Slug {
  return typeof value === 'string' && SLUG_PATTERN.test(value);
}

/** Type guard for {@link Email}. */
export function isEmail(value: unknown): value is Email {
  return typeof value === 'string' && EMAIL_PATTERN.test(value);
}

/** Type guard for {@link Url}. */
export function isUrl(value: unknown): value is Url {
  return typeof value === 'string' && URL_PATTERN.test(value);
}
