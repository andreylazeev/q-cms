/**
 * Authentication routes.
 *
 * Endpoints:
 *   POST /api/v1/auth/login        — email + password (rate-limited)
 *   POST /api/v1/auth/refresh      — exchange refresh token for new access token
 *   POST /api/v1/auth/logout       — revoke the current session
 *   POST /api/v1/auth/magic-link   — request a single-use email link
 *   POST /api/v1/auth/2fa/enable   — generate a TOTP secret
 *   POST /api/v1/auth/2fa/verify   — verify a TOTP code
 *   GET  /api/v1/auth/me           — current user
 *
 * @module routes/auth
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  type User,
  type UserId,
} from '../lib/stubs/core-shim.ts';
import {
  configureAuth,
  generateTotpSecret,
  hashApiToken,
  signJwt,
  verifyPassword,
  verifyTotp,
} from '../lib/stubs/auth.ts';
import { sessionRepo, userRepo } from '../lib/stubs/index.ts';
import { serializeResource } from '../lib/jsonapi.ts';
import { getEnv } from '../env.ts';
import { logger } from '../logger.ts';
import { getEmail, buildMagicLink } from '../services/email.ts';
import { getCache } from '../services/cache.ts';

export const authRouter = new Hono();

// Configure JWT secret from env. The real `@q-cms/auth` will replace this.
configureAuth({ jwtSecret: getEnv().JWT_SECRET, accessTtlSeconds: getEnv().JWT_ACCESS_TTL });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const magicLinkRequestSchema = z.object({
  email: z.string().email(),
});

const totpEnableSchema = z.object({});

const totpVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

/**
 * POST /auth/login
 * Authenticates with email + password and returns a JWT access token.
 */
authRouter.post('/login', async (c) => {
  const body = loginSchema.parse(await c.req.json().catch(() => ({})));
  const user = await userRepo.findByEmail(body.email);
  if (!user || !user.passwordHash) throw new UnauthorizedError('Invalid credentials');
  const ok = await verifyPassword(body.password, user.passwordHash);
  if (!ok) throw new UnauthorizedError('Invalid credentials');
  if (user.totpEnabled) {
    if (!body.totp) throw new UnauthorizedError('TOTP code required');
    if (!verifyTotp('', body.totp)) throw new UnauthorizedError('Invalid TOTP code');
  }
  const roles = await rolesForUser(user.id);
  const token = signJwt({ sub: user.id, email: user.email, roles, scopes: defaultScopes(roles) });
  const refresh = randomBytes(32).toString('base64url');
  await sessionRepo.create({
    userId: user.id,
    tokenHash: hashRefreshToken(refresh),
    ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: c.req.header('user-agent') ?? null,
    expiresAt: new Date(Date.now() + getEnv().JWT_REFRESH_TTL * 1000).toISOString(),
    revokedAt: null,
  });
  return c.json({ data: { type: 'Session', attributes: { accessToken: token, refreshToken: refresh } } });
});

/**
 * POST /auth/refresh
 * Exchanges a valid refresh token for a new access token.
 */
authRouter.post('/refresh', async (c) => {
  const body = refreshSchema.parse(await c.req.json().catch(() => ({})));
  const hash = hashRefreshToken(body.refreshToken);
  const session = await sessionRepo.findByTokenHash(hash);
  if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
    throw new UnauthorizedError('Invalid refresh token');
  }
  const user = await userRepo.findById(session.userId);
  if (!user || !user.isActive) throw new UnauthorizedError('User unavailable');
  const roles = await rolesForUser(user.id);
  const access = signJwt({ sub: user.id, email: user.email, roles, scopes: defaultScopes(roles) });
  return c.json({ data: { type: 'Session', attributes: { accessToken: access } } });
});

/**
 * POST /auth/logout
 * Revokes the active session.
 */
authRouter.post('/logout', async (c) => {
  const body = refreshSchema.parse(await c.req.json().catch(() => ({})));
  const hash = hashRefreshToken(body.refreshToken);
  const session = await sessionRepo.findByTokenHash(hash);
  if (session) await sessionRepo.revoke(session.id);
  return c.json({ data: { type: 'Session', attributes: { revoked: true } } });
});

/**
 * POST /auth/magic-link
 * Generates a single-use token, stores it in cache, and emails a link.
 */
authRouter.post('/magic-link', async (c) => {
  const body = magicLinkRequestSchema.parse(await c.req.json().catch(() => ({})));
  const user = await userRepo.findByEmail(body.email);
  if (!user) {
    // Don't reveal existence — return 200 either way.
    return c.json({ data: { type: 'MagicLinkRequest', attributes: { sent: true } } });
  }
  const token = randomBytes(24).toString('base64url');
  await getCache().set(`magic:${token}`, user.id, 15 * 60);
  const url = `${getEnv().API_URL}/auth/verify?token=${token}`;
  const { subject, html, text } = buildMagicLink({ url, expiresInMinutes: 15 });
  await getEmail().send({ to: user.email, subject, html, text }).catch((err: unknown) => {
    logger.warn({ err }, 'magic-link email send failed');
  });
  return c.json({ data: { type: 'MagicLinkRequest', attributes: { sent: true } } });
});

/**
 * POST /auth/2fa/enable
 * Returns a new TOTP secret + otpauth URL.
 */
authRouter.post('/2fa/enable', async (c) => {
  // Stub: the real handler will require the caller to be authenticated.
  totpEnableSchema.parse(await c.req.json().catch(() => ({})));
  const challenge = generateTotpSecret();
  return c.json({ data: { type: 'TotpChallenge', attributes: challenge } });
});

/**
 * POST /auth/2fa/verify
 * Confirms a 6-digit TOTP code.
 */
authRouter.post('/2fa/verify', async (c) => {
  const body = totpVerifySchema.parse(await c.req.json().catch(() => ({})));
  // Stub: real implementation will look up the user by JWT and verify.
  const ok = verifyTotp('', body.code);
  if (!ok) throw new ValidationError('Invalid TOTP code');
  return c.json({ data: { type: 'TotpVerification', attributes: { verified: true } } });
});

/**
 * GET /auth/me
 * Returns the currently authenticated user.
 */
authRouter.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');
  const full = await userRepo.findById(user.id);
  if (!full) throw new NotFoundError('User not found');
  return c.json(serializeResource('User', full.id, publicUser(full)));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashRefreshToken(token: string): string {
  // Reuse the API-token hash path; SHA-256 is fine for opaque tokens.
  return hashApiToken(token);
}

async function rolesForUser(userId: UserId): Promise<readonly string[]> {
  const roles = await userRepo.getRoles(userId);
  return roles.map((r) => r.name);
}

function defaultScopes(roles: readonly string[]): readonly string[] {
  if (roles.includes('super-admin') || roles.includes('admin')) {
    return ['*'];
  }
  return ['read:entries', 'write:entries', 'read:media', 'write:media'];
}

function publicUser(user: User): Record<string, unknown> {
  return {
    id: user.id,
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
