/**
 * User repository — CRUD + role assignment.
 *
 * Policy: see `./_shared.ts`. Reads return `Result`; writes throw on
 * irrecoverable errors and map unique violations to `ConflictError`.
 */

import { and, eq } from 'drizzle-orm';
import {
  NotFoundError,
} from '@q-cms/core/errors';
import type { Result } from '@q-cms/core/result';
import { Err, Ok } from '@q-cms/core/result';
import {
  userId as brandUserId,
  type UserId,
  type RoleId,
} from '@q-cms/core/branded';
import type { User, UserStatus } from '@q-cms/core/types';

import type { DrizzleClient } from '../client.ts';
import { users, userRoles, roles } from '../schema/index.ts';
import { toDomainError, tryFind } from './_shared.ts';

/** Input for `UserRepository.create`. */
export interface CreateUserInput {
  email: string;
  username?: string | null;
  passwordHash?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isActive?: boolean;
  isSuperAdmin?: boolean;
  emailVerifiedAt?: Date | null;
}

/** Input for `UserRepository.update`. All fields optional. */
export interface UpdateUserInput {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  passwordHash?: string | null;
  avatarId?: UserId | null;
  isActive?: boolean;
  status?: UserStatus;
  emailVerifiedAt?: Date | null;
  lastLoginAt?: Date | null;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Row → Domain mapping
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  email: string;
  username: string | null;
  passwordHash: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarId: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  totpEnabled: boolean;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

function mapUser(row: UserRow): User {
  return {
    id: brandUserId(row.id),
    email: row.email as User['email'],
    username: row.username,
    passwordHash: row.passwordHash,
    firstName: row.firstName,
    lastName: row.lastName,
    avatarId: row.avatarId ? (row.avatarId as User['avatarId']) : null,
    isActive: row.isActive,
    isSuperAdmin: row.isSuperAdmin,
    totpEnabled: row.totpEnabled,
    emailVerifiedAt: row.emailVerifiedAt
      ? (row.emailVerifiedAt.toISOString() as User['emailVerifiedAt'])
      : null,
    lastLoginAt: row.lastLoginAt
      ? (row.lastLoginAt.toISOString() as User['lastLoginAt'])
      : null,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString() as User['createdAt'],
    updatedAt: row.updatedAt.toISOString() as User['updatedAt'],
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class UserRepository {
  private readonly db: DrizzleClient;

  constructor(db: DrizzleClient) {
    this.db = db;
  }

  /** Find a user by primary key. */
  async findById(id: UserId): Promise<Result<User, NotFoundError>> {
    return tryFind<User>(async () => {
      const rows = await this.db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return mapUser(row as UserRow);
    }, 'User');
  }

  /** Find a user by e-mail (case-insensitive via `citext`). */
  async findByEmail(email: string): Promise<Result<User, NotFoundError>> {
    return tryFind<User>(async () => {
      const rows = await this.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return mapUser(row as UserRow);
    }, 'User');
  }

  /** Create a new user; maps `23505` to `ConflictError`. */
  async create(input: CreateUserInput): Promise<User> {
    try {
      const [row] = await this.db
        .insert(users)
        .values({
          email: input.email,
          username: input.username ?? null,
          passwordHash: input.passwordHash ?? null,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          isActive: input.isActive ?? true,
          isSuperAdmin: input.isSuperAdmin ?? false,
          emailVerifiedAt: input.emailVerifiedAt ?? null,
        })
        .returning();
      if (!row) throw new Error('insert returned no row');
      return mapUser(row as UserRow);
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Update an existing user; returns `NotFoundError` if the row is gone. */
  async update(id: UserId, patch: UpdateUserInput): Promise<User> {
    try {
      const updates: Partial<typeof users.$inferInsert> = {};
      if (patch.username !== undefined) updates.username = patch.username;
      if (patch.firstName !== undefined) updates.firstName = patch.firstName;
      if (patch.lastName !== undefined) updates.lastName = patch.lastName;
      if (patch.passwordHash !== undefined) updates.passwordHash = patch.passwordHash;
      if (patch.avatarId !== undefined) updates.avatarId = patch.avatarId;
      if (patch.isActive !== undefined) updates.isActive = patch.isActive;
      if (patch.emailVerifiedAt !== undefined)
        updates.emailVerifiedAt = patch.emailVerifiedAt;
      if (patch.lastLoginAt !== undefined) updates.lastLoginAt = patch.lastLoginAt;
      if (patch.metadata !== undefined) updates.metadata = JSON.stringify(patch.metadata);
      updates.updatedAt = new Date();

      const [row] = await this.db
        .update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning();
      if (!row) throw new NotFoundError('User not found', { id });
      return mapUser(row as UserRow);
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Hard delete a user (cascades to sessions, api_tokens, user_roles). */
  async delete(id: UserId): Promise<void> {
    try {
      const result = await this.db.delete(users).where(eq(users.id, id)).returning();
      if (result.length === 0) throw new NotFoundError('User not found', { id });
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Grant a role to a user (idempotent — `ON CONFLICT DO NOTHING`). */
  async assignRole(
    userIdValue: UserId,
    roleIdValue: RoleId,
    grantedBy: UserId | null = null,
  ): Promise<void> {
    try {
      await this.db
        .insert(userRoles)
        .values({
          userId: userIdValue,
          roleId: roleIdValue,
          grantedBy,
        })
        .onConflictDoNothing();
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Revoke a role from a user. Returns `Ok` even if the grant was absent. */
  async revokeRole(
    userIdValue: UserId,
    roleIdValue: RoleId,
  ): Promise<Result<void, NotFoundError>> {
    try {
      const result = await this.db
        .delete(userRoles)
        .where(
          and(
            eq(userRoles.userId, userIdValue),
            eq(userRoles.roleId, roleIdValue),
          ),
        )
        .returning();
      if (result.length === 0) {
        return Err(new NotFoundError('User role grant not found', {
          userId: userIdValue,
          roleId: roleIdValue,
        }));
      }
      return Ok(undefined);
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Convenience: list role names assigned to a user. */
  async listRoles(userIdValue: UserId): Promise<readonly string[]> {
    const rows = await this.db
      .select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, userIdValue));
    return rows.map((r) => r.name);
  }
}
