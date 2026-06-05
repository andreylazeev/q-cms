/**
 * Role-based access control middleware.
 *
 * Inspects a `require(perm)` string attached to the Hono route via
 * `c.set('require', perm)` (set in route definitions). Calls the
 * `require(user, perm)` helper from `@q-cms/auth` (stubbed locally
 * for now) to authorize the call.
 *
 * @module middleware/rbac
 */

import type { MiddlewareHandler } from 'hono';
import { ForbiddenError, UnauthorizedError } from '../lib/stubs/core-shim.ts';
import { require as rbacRequire } from '../lib/stubs/auth.ts';

export const rbacMiddleware: MiddlewareHandler = async (c, next) => {
  const perm = c.get('require') as string | undefined;
  if (!perm) {
    await next();
    return;
  }
  const user = c.get('user');
  const roles = c.get('roles') ?? [];
  if (!user) throw new UnauthorizedError('Authentication required');
  const ok = rbacRequire({ roles } as { roles: readonly string[] }, perm);
  if (!ok) throw new ForbiddenError(`Missing permission: ${perm}`);
  await next();
};

/**
 * Helper used by route definitions to mark a route as requiring a
 * permission. The rbac middleware reads the value back.
 */
export function requires(perm: string): { require: string } {
  return { require: perm };
}

declare module 'hono' {
  interface ContextVariableMap {
    require?: string;
  }
}
