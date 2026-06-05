/**
 * User CRUD routes.
 *
 * Endpoints:
 *   GET    /api/v1/users
 *   POST   /api/v1/users
 *   GET    /api/v1/users/{id}
 *   PATCH  /api/v1/users/{id}
 *   DELETE /api/v1/users/{id}
 *   POST   /api/v1/users/{id}/roles
 *
 * All endpoints require an authenticated caller.
 *
 * @module routes/users
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type User,
  type UserId,
} from '../lib/stubs/core-shim.ts';
import {
  hashPassword,
  roleRepo,
  userRepo,
} from '../lib/stubs/index.ts';
import { serializeResource, serializeCollection } from '../lib/jsonapi.ts';
import { cursorPaginationSchema } from '../lib/zod-helpers.ts';

export const usersRouter = new Hono();

const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(64).optional(),
  password: z.string().min(8).max(200),
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
});

const updateUserSchema = createUserSchema.partial().omit({ password: true });

const assignRolesSchema = z.object({
  roleIds: z.array(z.string().min(1)).max(20),
});

/** GET /users — list users (admin only). */
usersRouter.get('/', async (c) => {
  const page = cursorPaginationSchema.parse(c.req.query());
  const result = await userRepo.list({
    limit: page.limit,
    cursor: page.cursor ?? null,
    withTotal: page.withTotal ?? false,
  });
  return c.json(serializeCollection('User', result.data, {
    pageInfo: {
      hasNext: result.page.nextCursor !== null,
      hasPrev: result.page.prevCursor !== null,
      startCursor: result.page.prevCursor,
      endCursor: result.page.nextCursor,
    },
    totalCount: result.page.total ?? undefined,
  }));
});

/** POST /users — create a new user. */
usersRouter.post('/', async (c) => {
  const body = createUserSchema.parse(await c.req.json().catch(() => ({})));
  const existing = await userRepo.findByEmail(body.email);
  if (existing) throw new ConflictError('Email already in use');
  const passwordHash = await hashPassword(body.password);
  const user = await userRepo.create({
    email: body.email as User['email'],
    username: body.username ?? null,
    passwordHash,
    firstName: body.firstName ?? null,
    lastName: body.lastName ?? null,
    avatarId: null,
    isActive: body.isActive ?? true,
    isSuperAdmin: body.isSuperAdmin ?? false,
    totpEnabled: false,
    emailVerifiedAt: null,
    lastLoginAt: null,
    metadata: {},
  });
  return c.json(serializeResource('User', user.id, publicUser(user)), 201);
});

/** GET /users/{id} */
usersRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await userRepo.findById(id);
  if (!user) throw new NotFoundError('User not found');
  return c.json(serializeResource('User', user.id, publicUser(user)));
});

/** PATCH /users/{id} */
usersRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = updateUserSchema.parse(await c.req.json().catch(() => ({})));
  const user = await userRepo.update(id, {
    ...(body.email ? { email: body.email as User['email'] } : {}),
    ...(body.username !== undefined ? { username: body.username ?? null } : {}),
    ...(body.firstName !== undefined ? { firstName: body.firstName ?? null } : {}),
    ...(body.lastName !== undefined ? { lastName: body.lastName ?? null } : {}),
    ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    ...(body.isSuperAdmin !== undefined ? { isSuperAdmin: body.isSuperAdmin } : {}),
  });
  return c.json(serializeResource('User', user.id, publicUser(user)));
});

/** DELETE /users/{id} */
usersRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await userRepo.delete(id);
  return c.body(null, 204);
});

/** POST /users/{id}/roles */
usersRouter.post('/:id/roles', async (c) => {
  const id = c.req.param('id');
  const body = assignRolesSchema.parse(await c.req.json().catch(() => ({})));
  for (const roleId of body.roleIds) {
    const role = await roleRepo.findById(roleId);
    if (!role) throw new ValidationError(`Unknown role: ${roleId}`);
  }
  await userRepo.setRoles(id as UserId, body.roleIds);
  const user = await userRepo.findById(id);
  if (!user) throw new NotFoundError('User not found');
  const roles = await userRepo.getRoles(id as UserId);
  return c.json({
    data: {
      id: user.id,
      type: 'User',
      attributes: { ...publicUser(user), roles: roles.map((r) => r.name) },
    },
  });
});

function publicUser(user: User): Record<string, unknown> {
  return {
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    isSuperAdmin: user.isSuperAdmin,
    totpEnabled: user.totpEnabled,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
