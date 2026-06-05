import { describe, expect, it } from 'vitest';
import { userId } from '@q-cms/core/branded';
import { UnauthorizedError } from '@q-cms/core/errors';
import { createSessionId, hashToken, validateSession } from '../src/sessions.ts';
import type { Session } from '../src/index.ts';

const ANNA = userId('11111111-1111-4111-8111-111111111111');
const BASE_SESSION: Session = {
  id: '11111111-1111-4111-8111-111111111111' as Session['id'],
  userId: ANNA,
  tokenHash: 'abc123',
  ip: null,
  userAgent: null,
  expiresAt: '2099-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  revokedAt: null,
};

describe('sessions', () => {
  describe('createSessionId', () => {
    it('returns a UUID-shaped SessionId', () => {
      const id = createSessionId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('returns a unique id on every call', () => {
      const a = createSessionId();
      const b = createSessionId();
      expect(a).not.toBe(b);
    });
  });

  describe('hashToken', () => {
    it('produces a 64-char hex SHA-256 digest', () => {
      expect(hashToken('hello')).toBe(
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      );
    });

    it('is deterministic for the same input', () => {
      expect(hashToken('abc')).toBe(hashToken('abc'));
    });

    it('rejects empty input', () => {
      expect(() => hashToken('')).toThrow();
    });
  });

  describe('validateSession', () => {
    it('returns Ok for a valid session', () => {
      const r = validateSession(BASE_SESSION, new Date('2026-06-01T00:00:00Z'));
      expect(r.ok).toBe(true);
    });

    it('returns Err when revoked', () => {
      const revoked: Session = { ...BASE_SESSION, revokedAt: '2026-05-01T00:00:00Z' };
      const r = validateSession(revoked, new Date('2026-06-01T00:00:00Z'));
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toBeInstanceOf(UnauthorizedError);
      expect(r.error.message).toMatch(/revoked/i);
    });

    it('returns Err when expired', () => {
      const expired: Session = { ...BASE_SESSION, expiresAt: '2025-12-01T00:00:00Z' };
      const r = validateSession(expired, new Date('2026-06-01T00:00:00Z'));
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.message).toMatch(/expired/i);
    });

    it('returns Err when expiresAt is unparseable', () => {
      const bad: Session = { ...BASE_SESSION, expiresAt: 'not-a-date' as Session['expiresAt'] };
      const r = validateSession(bad, new Date('2026-06-01T00:00:00Z'));
      expect(r.ok).toBe(false);
    });

    it('rejects non-object input', () => {
      // @ts-expect-error: explicit type-pun to test runtime guard.
      const r = validateSession(null);
      expect(r.ok).toBe(false);
    });
  });
});
