/**
 * Role-Based Access Control tables: `roles`, `permissions`,
 * `role_permissions`, `user_roles`.
 *
 * Mirrors DATA_MODEL.md §1.4.
 *
 * `permissions.conditions` and `user_roles.scope` are stored as JSON-encoded
 * text (Drizzle v0.36 has no first-class JSONB column for arbitrary JSON);
 * a JSONB column is added via a custom type. We default to JSON-typed text
 * for portability and let the application layer parse.
 */

import { customType, pgTable, text, timestamp, uuid, boolean, primaryKey, index, uniqueIndex } from 'drizzle-orm/pg-core';

import { users } from './auth.ts';

/**
 * `JSONB` — stored as text at the TS level, parsed by the driver.
 * Drizzle's own `jsonb` column type is also fine; we re-export it as
 * `jsonb` to keep callers decoupled from the underlying driver adapter.
 */
const jsonb = customType<{ data: unknown; driverData: unknown }>({
  dataType() {
    return 'jsonb';
  },
  toDriver(value: unknown): string {
    return JSON.stringify(value ?? null);
  },
  fromDriver(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') return value ? JSON.parse(value) : null;
    return value;
  },
});

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

// ---------------------------------------------------------------------------
// roles
// ---------------------------------------------------------------------------

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
);

export type RoleRow = typeof roles.$inferSelect;
export type RoleInsert = typeof roles.$inferInsert;

// ---------------------------------------------------------------------------
// permissions
// ---------------------------------------------------------------------------

export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    conditions: jsonb('conditions').notNull().default({}),
  },
  (t) => ({
    resourceActionUq: uniqueIndex('uq_permissions_resource_action').on(t.resource, t.action),
  }),
);

export type PermissionRow = typeof permissions.$inferSelect;
export type PermissionInsert = typeof permissions.$inferInsert;

// ---------------------------------------------------------------------------
// role_permissions
// ---------------------------------------------------------------------------

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
  }),
);

export type RolePermissionRow = typeof rolePermissions.$inferSelect;
export type RolePermissionInsert = typeof rolePermissions.$inferInsert;

// ---------------------------------------------------------------------------
// user_roles
// ---------------------------------------------------------------------------

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    scope: jsonb('scope').notNull().default({}),
    grantedBy: uuid('granted_by').references(() => users.id),
    grantedAt: timestamptz('granted_at').notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.roleId] }),
    roleIdx: index('idx_user_roles_role').on(t.roleId),
  }),
);

export type UserRoleRow = typeof userRoles.$inferSelect;
export type UserRoleInsert = typeof userRoles.$inferInsert;
