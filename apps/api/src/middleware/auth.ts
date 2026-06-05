/**
 * Authentication middleware.
 *
 * Resolves the caller from either:
 *   - `Authorization: Bearer <jwt>`          (session user)
 *   - `Authorization: Bearer qcs_...`        (PAT / API token)
 *
 * Populates `c.get('user')` and `c.get('roles')` on success. Leaves
 * the context untouched on failure (a downstream RBAC middleware is
 * expected to throw if the route requires auth).
 *
 * @module middleware/auth
 */

import type { MiddlewareHandler } from 'hono';
import { UnauthorizedError, type User, type UserId } from '../lib/stubs/core-shim.ts';
import { hashApiToken, verifyJwt } from '../lib/stubs/auth.ts';
import { userRepo } from '../lib/stubs/index.ts';

export interface AuthenticatedContext {
  user: { id: UserId; email: string };
  roles: readonly string[];
  via: 'jwt' | 'api-token';
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const header = c.req.header('authorization');
  if (!header) {
    await next();
    return;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match || !match[1]) {
    await next();
    return;
  }
  const token = match[1].trim();
  try {
    if (token.startsWith('qcs_')) {
      await authenticateApiToken(c, token);
    } else {
      await authenticateJwt(c, token);
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      // Surface as 401 to the caller.
      throw err;
    }
    throw err;
  }
  await next();
};

async function authenticateJwt(c: Parameters<MiddlewareHandler>[0], token: string): Promise<void> {
  const claims = verifyJwt(token);
  const user = await userRepo.findById(claims.sub);
  if (!user) throw new UnauthorizedError('User no longer exists');
  if (!user.isActive) throw new UnauthorizedError('User disabled');
  setAuthContext(c, user, claims.roles, 'jwt');
}

async function authenticateApiToken(c: Parameters<MiddlewareHandler>[0], token: string): Promise<void> {
  // We don't have a dedicated API token repo in the stub; the real
  // implementation will look the hash up in `api_tokens` and return
  // the associated user. For now we just bind the user by id.
  hashApiToken(token); // validate the token can be hashed
  const userId = c.req.header('x-api-token-user') ?? '';
  if (!userId) {
    // No token repo available — accept the call but mark as anonymous.
    return;
  }
  const user = await userRepo.findById(userId);
  if (!user) throw new UnauthorizedError('Invalid API token');
  if (!user.isActive) throw new UnauthorizedError('User disabled');
  setAuthContext(c, user, ['api-token'], 'api-token');
}

function setAuthContext(
  c: Parameters<MiddlewareHandler>[0],
  user: User,
  roles: readonly string[],
  via: 'jwt' | 'api-token',
): void {
  c.set('user', { id: user.id, email: user.email });
  c.set('roles', roles);
  c.set('authMethod', via);
}

declare module 'hono' {
  interface ContextVariableMap {
    user?: { id: UserId; email: string };
    roles?: readonly string[];
    authMethod?: 'jwt' | 'api-token';
  }
}
