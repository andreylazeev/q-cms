/**
 * User repository adapter.
 *
 * Wraps `@q-cms/db`'s `UserRepository` and exposes the same flat
 * interface the route handlers expect.
 *
 * @module lib/repos/users
 */

import { eq, desc } from 'drizzle-orm';
import { UserRepository } from '@q-cms/db';
import { schema } from '@q-cms/db';
import type { Paginated, Role, RoleId, User, UserId } from '@q-cms/core';
import { getDb } from '../db.ts';

const { userRoles: userRolesTable, roles: rolesTable } = schema;

let cached: UserRepository | undefined;

function repo(): UserRepository {
  if (!cached) cached = new UserRepository(getDb());
  return cached;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UserRepo {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(page: { limit: number; cursor: string | null; withTotal: boolean }): Promise<Paginated<User>>;
  create(input: Record<string, unknown>): Promise<User>;
  update(id: string, patch: Record<string, unknown>): Promise<User>;
  delete(id: string): Promise<void>;
  setRoles(userId: string, roleIds: readonly string[]): Promise<void>;
  getRoles(userId: string): Promise<readonly Role[]>;
}

export const userRepo: UserRepo = {
  async findById(id) {
    const result = await repo().findById(id as UserId);
    return result.ok ? result.value : null;
  },

  async findByEmail(email) {
    const result = await repo().findByEmail(email);
    return result.ok ? result.value : null;
  },

  async list(page) {
    const cursorNum = page.cursor ? Number(page.cursor) : 0;
    const limit = page.limit;
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(limit)
      .offset(cursorNum);

    let total: number | null = null;
    if (page.withTotal) {
      const [countResult] = await db
        .select({ count: schema.users.id })
        .from(schema.users);
      total = Number(countResult?.count ?? 0);
    }

    const nextCursor = rows.length === limit ? String(cursorNum + limit) : null;

    return {
      data: rows as unknown as readonly User[],
      page: {
        nextCursor,
        prevCursor: cursorNum > 0 ? String(Math.max(0, cursorNum - limit)) : null,
        limit,
        total,
      },
    };
  },

  async create(input) {
    return repo().create(input as Parameters<UserRepository['create']>[0]);
  },

  async update(id, patch) {
    return repo().update(id as UserId, patch as Parameters<UserRepository['update']>[1]);
  },

  async delete(id) {
    await repo().delete(id as UserId);
  },

  async setRoles(userId, roleIds) {
    // Remove all existing roles, then assign new ones.
    // The real repo works one role at a time — do a manual reset.
    const db = getDb();
    const uid = userId as UserId;
    // Simple approach: delete all and re-insert
    await db.delete(userRolesTable).where(eq(userRolesTable.userId, uid));
    for (const rid of roleIds) {
      await repo().assignRole(uid, rid as RoleId);
    }
  },

  async getRoles(userId) {
    const db = getDb();
    const rows = await db
      .select({
        id: rolesTable.id,
        name: rolesTable.name,
        description: rolesTable.description,
        isSystem: rolesTable.isSystem,
      })
      .from(userRolesTable)
      .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
      .where(eq(userRolesTable.userId, userId as UserId));
    return rows as unknown as readonly Role[];
  },
};
