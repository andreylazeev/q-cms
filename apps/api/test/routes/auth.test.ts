/**
 * Tests for the auth route.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authRouter } from '../../src/routes/auth.ts';
import { errorMiddleware } from '../../src/middleware/error.ts';
import { requestIdMiddleware } from '../../src/middleware/request-id.ts';
import { authMiddleware } from '../../src/middleware/auth.ts';
import { userRepo, hashPassword, configureAuth, signJwt, verifyJwt } from '../../src/lib/stubs/index.ts';

function makeApp() {
  const app = new Hono();
  app.use('*', requestIdMiddleware);
  app.onError(errorMiddleware);
  app.use('*', authMiddleware);
  app.route('/api/v1/auth', authRouter);
  return app;
}

describe('auth router', () => {
  beforeEach(() => {
    configureAuth({ jwtSecret: 'test-secret-32-chars-minimum-1234567890ab' });
  });

  it('POST /login returns access + refresh tokens for valid creds', async () => {
    const passwordHash = await hashPassword('supersecret');
    await userRepo.create({
      email: 'login@test.local' as never,
      username: null,
      passwordHash,
      firstName: null,
      lastName: null,
      avatarId: null,
      isActive: true,
      isSuperAdmin: false,
      totpEnabled: false,
      emailVerifiedAt: null,
      lastLoginAt: null,
      metadata: {},
    });
    const res = await makeApp().request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'login@test.local', password: 'supersecret' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { attributes: { accessToken: string; refreshToken: string } } };
    expect(body.data.attributes.accessToken).toBeDefined();
    expect(body.data.attributes.refreshToken).toBeDefined();
  });

  it('POST /login returns 401 for invalid creds', async () => {
    const res = await makeApp().request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'missing@test.local', password: 'nope' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /me requires authentication', async () => {
    const res = await makeApp().request('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /me returns current user when authenticated', async () => {
    const user = await userRepo.create({
      email: 'me@test.local' as never,
      username: null,
      passwordHash: null,
      firstName: 'A',
      lastName: 'B',
      avatarId: null,
      isActive: true,
      isSuperAdmin: false,
      totpEnabled: false,
      emailVerifiedAt: null,
      lastLoginAt: null,
      metadata: {},
    });
    const token = signJwt({ sub: user.id, email: user.email, roles: ['admin'], scopes: ['*'] });
    const res = await makeApp().request('/api/v1/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string; attributes: { email: string } } };
    expect(body.data.attributes.email).toBe('me@test.local');
  });

  it('POST /magic-link returns 200 even for unknown emails (no enumeration)', async () => {
    const res = await makeApp().request('/api/v1/auth/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nope@example.com' }),
    });
    expect(res.status).toBe(200);
  });

  it('POST /refresh issues a new access token from a valid refresh token', async () => {
    const user = await userRepo.create({
      email: 'refresh@test.local' as never,
      username: null,
      passwordHash: null,
      firstName: null,
      lastName: null,
      avatarId: null,
      isActive: true,
      isSuperAdmin: false,
      totpEnabled: false,
      emailVerifiedAt: null,
      lastLoginAt: null,
      metadata: {},
    });
    const passwordHash = await hashPassword('password-1234');
    const updated = await userRepo.update(user.id, { passwordHash });
    // Sign in
    const login = await makeApp().request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: updated.email, password: 'password-1234' }),
    });
    const loginBody = (await login.json()) as { data: { attributes: { refreshToken: string } } };
    const refreshRes = await makeApp().request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: loginBody.data.attributes.refreshToken }),
    });
    expect(refreshRes.status).toBe(200);
    const refreshBody = (await refreshRes.json()) as { data: { attributes: { accessToken: string } } };
    expect(refreshBody.data.attributes.accessToken).toBeDefined();
    // And the access token is verifiable.
    expect(() => verifyJwt(refreshBody.data.attributes.accessToken)).not.toThrow();
  });
});
