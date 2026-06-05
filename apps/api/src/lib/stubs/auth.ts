/**
 * Temporary local stub for `@q-cms/auth`.
 *
 * The real package is being built in parallel. Once it is published
 * the API should re-export from it instead. Until then, the routes
 * import everything they need from here.
 *
 * The exports intentionally mirror the surface the real package is
 * expected to provide: password hashing, JWT minting/verifying,
 * session storage, and the RBAC `require(roles, perm)` helper used
 * by `middleware/rbac.ts`.
 *
 * @module lib/stubs/auth
 */

import { Buffer } from 'node:buffer';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  ForbiddenError,
  UnauthorizedError,
  type User,
  type UserId,
} from './core-shim.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface AuthRuntimeConfig {
  jwtSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  apiTokenPrefix: string;
}

let runtimeConfig: AuthRuntimeConfig = {
  jwtSecret: 'change-me-with-openssl-rand-base64-32-chars-min',
  accessTtlSeconds: 900,
  refreshTtlSeconds: 2_592_000,
  apiTokenPrefix: 'qcs_',
};

export function configureAuth(config: Partial<AuthRuntimeConfig>): void {
  runtimeConfig = { ...runtimeConfig, ...config };
}

// ---------------------------------------------------------------------------
// Password hashing (PBKDF2 — bcrypt-free so we don't pull a native dep)
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

/** Hash a password with PBKDF2-SHA256, returning a self-describing string. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await new Promise<Buffer>((resolve, reject) => {
    // crypto.pbkdf2 callback API to avoid pulling node:crypto.promisify
    // interop glue in test runners.
    const cb = (
      err: Error | null,
      key: Buffer | undefined,
    ): void => {
      if (err) reject(err);
      else if (key) resolve(key);
      else reject(new Error('pbkdf2 returned no key'));
    };
    // Lazy import to keep the type-checker quiet on cross-runtime builds.
    import('node:crypto').then((c) =>
      c.pbkdf2(plain, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST, cb),
    );
  });
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/** Verify a password against a stored hash. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;
  const salt = Buffer.from(parts[2] ?? '', 'base64');
  const expected = Buffer.from(parts[3] ?? '', 'base64');
  if (salt.length === 0 || expected.length === 0) return false;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    const cb = (err: Error | null, key: Buffer | undefined): void => {
      if (err) reject(err);
      else if (key) resolve(key);
      else reject(new Error('pbkdf2 returned no key'));
    };
    import('node:crypto').then((c) =>
      c.pbkdf2(plain, salt, iterations, expected.length, PBKDF2_DIGEST, cb),
    );
  });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

// ---------------------------------------------------------------------------
// JWT (HS256) — minimal self-contained implementation
// ---------------------------------------------------------------------------

export interface JwtClaims {
  sub: string;
  email: string;
  roles: readonly string[];
  scopes: readonly string[];
  iat: number;
  exp: number;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/** Mint an access token for the given subject. */
export function signJwt(claims: Omit<JwtClaims, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const fullClaims: JwtClaims = {
    ...claims,
    iat: now,
    exp: now + runtimeConfig.accessTtlSeconds,
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(fullClaims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = createHmac('sha256', runtimeConfig.jwtSecret).update(signingInput).digest();
  return `${signingInput}.${base64url(sig)}`;
}

/** Verify a token's signature and expiry. Throws {@link UnauthorizedError} on failure. */
export function verifyJwt(token: string): JwtClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new UnauthorizedError('Malformed token');
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) {
    throw new UnauthorizedError('Malformed token');
  }
  const expectedSig = createHmac('sha256', runtimeConfig.jwtSecret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actualSig = base64urlDecode(sigB64);
  if (expectedSig.length !== actualSig.length || !timingSafeEqual(expectedSig, actualSig)) {
    throw new UnauthorizedError('Invalid token signature');
  }
  let claims: JwtClaims;
  try {
    claims = JSON.parse(base64urlDecode(payloadB64).toString('utf8')) as JwtClaims;
  } catch {
    throw new UnauthorizedError('Invalid token payload');
  }
  if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) {
    throw new UnauthorizedError('Token expired');
  }
  return claims;
}

// ---------------------------------------------------------------------------
// API tokens (PAT)
// ---------------------------------------------------------------------------

export interface ApiTokenMint {
  id: string;
  /** Plaintext token — only available at mint time. */
  token: string;
  prefix: string;
  hash: string;
}

export function mintApiToken(id: string): ApiTokenMint {
  const plaintext = `${runtimeConfig.apiTokenPrefix}${randomBytes(24).toString('base64url')}`;
  const prefix = plaintext.slice(0, 12);
  const hash = createHash('sha256').update(plaintext).digest('hex');
  return { id, token: plaintext, prefix, hash };
}

export function hashApiToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

// ---------------------------------------------------------------------------
// RBAC — `require(roles, perm)`
// ---------------------------------------------------------------------------

export interface RoleLike {
  name: string;
  permissions: readonly string[];
}

const SYSTEM_ROLES: Record<string, RoleLike> = {
  'super-admin': { name: 'super-admin', permissions: ['*'] },
  admin: {
    name: 'admin',
    permissions: [
      'collection:*:read',
      'collection:*:write',
      'collection:*:publish',
      'collection:*:delete',
      'media:*',
      'users:*',
      'roles:*',
      'webhooks:*',
      'settings:*',
    ],
  },
  editor: {
    name: 'editor',
    permissions: [
      'collection:*:read',
      'collection:*:write',
      'collection:*:publish',
      'media:read',
      'media:write',
    ],
  },
  author: {
    name: 'author',
    permissions: ['collection:*:read', 'collection:*:write', 'media:read', 'media:write'],
  },
  reviewer: { name: 'reviewer', permissions: ['collection:*:read', 'media:read'] },
  viewer: { name: 'viewer', permissions: ['collection:*:read', 'media:read'] },
};

export function isSystemRole(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(SYSTEM_ROLES, name);
}

export function systemRolePermissions(name: string): readonly string[] {
  return SYSTEM_ROLES[name]?.permissions ?? [];
}

/**
 * Authorize a user against a required permission.
 *
 * Returns `true` if the user holds at least one role that grants the
 * permission. Throws {@link ForbiddenError} otherwise. Throws
 * {@link UnauthorizedError} if the user is anonymous.
 */
export function require(
  user: { roles: readonly string[] } | null,
  perm: string,
  permissionsByRole: Record<string, readonly string[]> = {},
): boolean {
  if (!user) throw new UnauthorizedError('Authentication required');
  if (user.roles.includes('super-admin')) return true;
  const parts = perm.split(':');
  const scope = parts[0] ?? '';
  const action = parts[1] ?? '';
  for (const role of user.roles) {
    const grants = permissionsByRole[role] ?? systemRolePermissions(role);
    for (const g of grants) {
      if (g === '*' || g === perm) return true;
      if (matchesWildcard(g, scope, action)) return true;
    }
  }
  throw new ForbiddenError(`Missing permission: ${perm}`);
}

function matchesWildcard(grant: string, scope: string, action: string): boolean {
  // Accepts "collection:*:read", "*:read", "collection:Article:*" etc.
  const parts = grant.split(':');
  if (parts.length !== 3) return false;
  const gScope = parts[0] ?? '';
  const gResource = parts[1] ?? '';
  const gAction = parts[2] ?? '';
  if (!gScope || !gResource || !gAction) return false;
  const scopeOk = gScope === '*' || gScope === scope;
  const resourceOk = gResource === '*' || gResource === scope.split('.').pop();
  const actionOk = gAction === '*' || gAction === action;
  return scopeOk && resourceOk && actionOk;
}

// ---------------------------------------------------------------------------
// User type re-export (for clarity at the call-site)
// ---------------------------------------------------------------------------

export type { User, UserId };

// ---------------------------------------------------------------------------
// TOTP — minimal stub. Real implementation will be supplied by the
// auth package; for now we just expose a placeholder.
// ---------------------------------------------------------------------------

export interface TotpChallenge {
  secret: string;
  otpauthUrl: string;
}

export function generateTotpSecret(): TotpChallenge {
  const secret = base64url(randomBytes(20));
  return { secret, otpauthUrl: `otpauth://totp/Q-CMS?secret=${secret}` };
}

export function verifyTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  // Stub: any 6-digit code is rejected. Real TOTP will replace this.
  return code === '000000' && secret.length > 0;
}
