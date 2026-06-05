/**
 * Role management routes.
 *
 * Endpoints:
 *   GET    /api/v1/roles
 *   POST   /api/v1/roles
 *   PATCH  /api/v1/roles/{id}
 *   DELETE /api/v1/roles/{id}   (refuses to delete system roles)
 *
 * @module routes/roles
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { ConflictError, NotFoundError, ValidationError, type Role } from '../lib/stubs/core-shim.ts';
import { isSystemRole, roleRepo } from '../lib/stubs/index.ts';
import { serializeResource, serializeCollection } from '../lib/jsonapi.ts';

export const rolesRouter = new Hono();

const createRoleSchema = z.object({
  name: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/, 'lowercase, digits, dashes only'),
  description: z.string().max(500).optional(),
  isSystem: z.boolean().default(false),
});

const updateRoleSchema = createRoleSchema.partial().omit({ isSystem: true });

/** GET /roles */
rolesRouter.get('/', async (c) => {
  const items = await roleRepo.list();
  return c.json(serializeCollection('Role', items.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    createdAt: r.createdAt,
  })), {
    pageInfo: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null },
    totalCount: items.length,
  }));
});

/** POST /roles */
rolesRouter.post('/', async (c) => {
  const body = createRoleSchema.parse(await c.req.json().catch(() => ({})));
  if (isSystemRole(body.name) || body.isSystem) {
    throw new ConflictError(`Role '${body.name}' is reserved`);
  }
  const role = await roleRepo.create({
    name: body.name,
    description: body.description ?? null,
    isSystem: false,
  });
  return c.json(serializeResource('Role', role.id, publicRole(role)), 201);
});

/** PATCH /roles/{id} */
rolesRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await roleRepo.findById(id);
  if (!existing) throw new NotFoundError('Role not found');
  if (existing.isSystem) throw new ValidationError('System roles are immutable');
  const body = updateRoleSchema.parse(await c.req.json().catch(() => ({})));
  const updated = await roleRepo.update(id, {
    ...(body.name ? { name: body.name } : {}),
    ...(body.description !== undefined ? { description: body.description ?? null } : {}),
  });
  return c.json(serializeResource('Role', updated.id, publicRole(updated)));
});

/** DELETE /roles/{id} — refuses to delete system roles. */
rolesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await roleRepo.findById(id);
  if (!existing) throw new NotFoundError('Role not found');
  if (existing.isSystem) throw new ValidationError('Cannot delete system role');
  await roleRepo.delete(id);
  return c.body(null, 204);
});

function publicRole(r: Role): Record<string, unknown> {
  return {
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    createdAt: r.createdAt,
  };
}
