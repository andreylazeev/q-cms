/**
 * Role repository — queries the `roles` table directly.
 *
 * TODO: Replace with a dedicated `RoleRepository` in `@q-cms/db`
 * once one exists.
 *
 * @module lib/repos/roles
 */

import { eq } from 'drizzle-orm';
import { schema } from '@q-cms/db';
import type { Role, RoleId } from '@q-cms/core';
import { roleId } from '@q-cms/core/branded';
import { getDb } from '../db.ts';

const { roles: rolesTable } = schema;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RoleRepo {
  list(): Promise<readonly Role[]>;
  findById(id: string): Promise<Role | null>;
  create(input: { name: string; description?: string | null; isSystem?: boolean }): Promise<Role>;
  update(id: string, patch: { name?: string; description?: string | null }): Promise<Role>;
  delete(id: string): Promise<void>;
}

export const roleRepo: RoleRepo = {
  async list() {
    const db = getDb();
    const rows = await db.select().from(rolesTable).orderBy(rolesTable.name);
    return rows.map((r) => ({
      id: roleId(r.id),
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      createdAt: (r.createdAt as Date).toISOString() as Role['createdAt'],
    }));
  },

  async findById(id) {
    const db = getDb();
    const rows = await db
      .select()
      .from(rolesTable)
      .where(eq(rolesTable.id, id as RoleId))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: roleId(r.id),
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      createdAt: (r.createdAt as Date).toISOString() as Role['createdAt'],
    };
  },

  async create(input) {
    const db = getDb();
    const [row] = await db
      .insert(rolesTable)
      .values({
        name: input.name,
        description: input.description ?? null,
        isSystem: input.isSystem ?? false,
      })
      .returning();
    return {
      id: roleId(row.id),
      name: row.name,
      description: row.description,
      isSystem: row.isSystem,
      createdAt: (row.createdAt as Date).toISOString() as Role['createdAt'],
    };
  },

  async update(id, patch) {
    const db = getDb();
    const updates: Record<string, unknown> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.description !== undefined) updates.description = patch.description;
    const [row] = await db
      .update(rolesTable)
      .set(updates)
      .where(eq(rolesTable.id, id as RoleId))
      .returning();
    if (!row) throw new Error('Role not found');
    return {
      id: roleId(row.id),
      name: row.name,
      description: row.description,
      isSystem: row.isSystem,
      createdAt: (row.createdAt as Date).toISOString() as Role['createdAt'],
    };
  },

  async delete(id) {
    const db = getDb();
    await db.delete(rolesTable).where(eq(rolesTable.id, id as RoleId));
  },
};
