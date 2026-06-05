/**
 * Authentication tables: `users`, `sessions`, `api_tokens`.
 *
 * Mirrors DATA_MODEL.md §1.1 – §1.3.
 *
 * Notes:
 * - `users.email` is `citext` (case-insensitive). We model it as a `customType`
 *   so queries behave identically across drivers.
 * - `users.totp_secret` is encrypted at the application layer.
 * - `sessions.ip` is `inet`; modeled as a custom type.
 * - `api_tokens.scopes` is a `text[]` array.
 */

import { customType, pgTable, text, timestamp, uuid, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Custom types
// ---------------------------------------------------------------------------

/**
 * PostgreSQL `CITEXT` — case-insensitive text. We model values as plain
 * strings at the TS level; the column itself enforces case-folding.
 */
const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext';
  },
});

/**
 * PostgreSQL `INET` — IP address (v4 or v6). We model values as strings;
 * the column validates format and supports network operators.
 */
const inet = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'inet';
  },
});

// ---------------------------------------------------------------------------
// Reusable timestamp helpers
// ---------------------------------------------------------------------------

/** `TIMESTAMPTZ` with the value exposed as a JS `Date`. */
const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: citext('email').notNull().unique(),
    username: text('username').unique(),
    passwordHash: text('password_hash'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    avatarId: uuid('avatar_id'),
    isActive: boolean('is_active').notNull().default(true),
    isSuperAdmin: boolean('is_super_admin').notNull().default(false),
    totpSecret: text('totp_secret'),
    totpEnabled: boolean('totp_enabled').notNull().default(false),
    emailVerifiedAt: timestamptz('email_verified_at'),
    lastLoginAt: timestamptz('last_login_at'),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('idx_users_email').on(t.email),
    activeIdx: index('idx_users_active').on(t.isActive).where(sql`${t.isActive} = true`),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    ip: inet('ip'),
    userAgent: text('user_agent'),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    revokedAt: timestamptz('revoked_at'),
  },
  (t) => ({
    userIdx: index('idx_sessions_user').on(t.userId).where(sql`${t.revokedAt} IS NULL`),
    expiresIdx: index('idx_sessions_expires').on(t.expiresAt).where(sql`${t.revokedAt} IS NULL`),
  }),
);

export type SessionRow = typeof sessions.$inferSelect;
export type SessionInsert = typeof sessions.$inferInsert;

// ---------------------------------------------------------------------------
// api_tokens
// ---------------------------------------------------------------------------

export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    prefix: text('prefix').notNull(),
    /** Comma-separated scopes; arrays are awkward to model in Drizzle v0.36. */
    scopes: text('scopes').notNull().default('{}'),
    expiresAt: timestamptz('expires_at'),
    lastUsedAt: timestamptz('last_used_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    revokedAt: timestamptz('revoked_at'),
  },
  (t) => ({
    userIdx: index('idx_api_tokens_user').on(t.userId).where(sql`${t.revokedAt} IS NULL`),
  }),
);

export type ApiTokenRow = typeof apiTokens.$inferSelect;
export type ApiTokenInsert = typeof apiTokens.$inferInsert;
