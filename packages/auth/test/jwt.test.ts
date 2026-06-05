import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from '@q-cms/core/errors';
import {
  extractBearerToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/jwt.ts';

const SECRET = 'test-secret-32-chars-minimum-aaaaaa';
const PAYLOAD = {
  sub: 'user-123',
  email: 'user@example.com',
  roles: ['admin', 'editor'] as const,
  scopes: ['read:entries', 'write:entries'] as const,
};

describe('jwt', () => {
  describe('signAccessToken / verifyAccessToken', () => {
    it('round-trips a valid token', async () => {
      const token = await signAccessToken(PAYLOAD, { secret: SECRET, ttl: 60 });
      const result = await verifyAccessToken(token, { secret: SECRET });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.sub).toBe(PAYLOAD.sub);
      expect(result.value.email).toBe(PAYLOAD.email);
      expect([...result.value.roles]).toEqual([...PAYLOAD.roles]);
      expect([...result.value.scopes]).toEqual([...PAYLOAD.scopes]);
      expect(result.value.exp).toBeGreaterThan(result.value.iat);
    });

    it('rejects a token signed with a different secret', async () => {
      const token = await signAccessToken(PAYLOAD, { secret: SECRET, ttl: 60 });
      const result = await verifyAccessToken(token, { secret: 'other-secret-32-chars-minimum-aaa' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBeInstanceOf(UnauthorizedError);
    });

    it('rejects a malformed token', async () => {
      const result = await verifyAccessToken('not-a-jwt', { secret: SECRET });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBeInstanceOf(UnauthorizedError);
    });

    it('rejects an empty token', async () => {
      const result = await verifyAccessToken('', { secret: SECRET });
      expect(result.ok).toBe(false);
    });

    it('rejects an expired token', async () => {
      // ttl of 0 means the token expires "now" — by the time we verify, it's stale.
      const token = await signAccessToken(PAYLOAD, { secret: SECRET, ttl: 0 });
      // Sleep 1.1s to be safely past the second boundary.
      await new Promise((r) => setTimeout(r, 1100));
      const result = await verifyAccessToken(token, { secret: SECRET });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBeInstanceOf(UnauthorizedError);
      expect(result.error.message).toMatch(/exp/i);
    });
  });

  describe('signRefreshToken / verifyRefreshToken', () => {
    it('round-trips a refresh token', async () => {
      const token = await signRefreshToken(PAYLOAD, { secret: SECRET, ttl: 3600 });
      const result = await verifyRefreshToken(token, { secret: SECRET });
      expect(result.ok).toBe(true);
    });

    it('rejects a refresh token used as an access token', async () => {
      const token = await signRefreshToken(PAYLOAD, { secret: SECRET, ttl: 3600 });
      const result = await verifyAccessToken(token, { secret: SECRET });
      expect(result.ok).toBe(false);
    });

    it('rejects an access token used as a refresh token', async () => {
      const token = await signAccessToken(PAYLOAD, { secret: SECRET, ttl: 60 });
      const result = await verifyRefreshToken(token, { secret: SECRET });
      expect(result.ok).toBe(false);
    });
  });

  describe('extractBearerToken', () => {
    it('extracts a token from a valid header', () => {
      const result = extractBearerToken('Bearer abc.def.ghi');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('abc.def.ghi');
    });

    it('is case-insensitive on the scheme', () => {
      const result = extractBearerToken('bearer xyz');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('xyz');
    });

    it('trims surrounding whitespace', () => {
      const result = extractBearerToken('   Bearer  padded-token  ');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('padded-token');
    });

    it('rejects missing header', () => {
      const result = extractBearerToken(undefined);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBeInstanceOf(UnauthorizedError);
    });

    it('rejects wrong scheme', () => {
      const result = extractBearerToken('Basic dXNlcjpwYXNz');
      expect(result.ok).toBe(false);
    });

    it('rejects empty token after scheme', () => {
      const result = extractBearerToken('Bearer    ');
      expect(result.ok).toBe(false);
    });
  });
});
