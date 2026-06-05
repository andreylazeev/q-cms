import { describe, expect, it } from 'vitest';
import {
  BCRYPT_COST,
  DEFAULT_RANDOM_PASSWORD_LENGTH,
  generateRandomPassword,
  hashPassword,
  isStrongPassword,
  MIN_PASSWORD_LENGTH,
  needsRehash,
  verifyPassword,
} from '../src/password.ts';

describe('password', () => {
  describe('hashPassword / verifyPassword', () => {
    it('hashes and verifies a valid password', async () => {
      const hash = await hashPassword('correct horse battery staple');
      expect(hash).toMatch(new RegExp(`^\\$2[abxy]?\\$${BCRYPT_COST}\\$`));
      await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
    });

    it('rejects wrong password', async () => {
      const hash = await hashPassword('hunter2');
      await expect(verifyPassword('hunter3', hash)).resolves.toBe(false);
    });

    it('verifyPassword returns false on malformed hash', async () => {
      await expect(verifyPassword('hunter2', 'not-a-bcrypt-hash')).resolves.toBe(false);
    });

    it('verifyPassword returns false on empty input', async () => {
      const hash = await hashPassword('hunter22');
      await expect(verifyPassword('', hash)).resolves.toBe(false);
      await expect(verifyPassword('hunter22', '')).resolves.toBe(false);
    });

    it('hashPassword rejects empty plaintext', async () => {
      await expect(hashPassword('')).rejects.toThrow();
    });

    it('produces unique hashes for the same input', async () => {
      const a = await hashPassword('hunter22');
      const b = await hashPassword('hunter22');
      expect(a).not.toBe(b);
    });

    it('uses cost 12 per spec §6.1', async () => {
      const hash = await hashPassword('hunter22');
      expect(hash).toContain(`$${BCRYPT_COST}$`);
    });
  });

  describe('isStrongPassword', () => {
    it('accepts a compliant password', () => {
      expect(isStrongPassword('hunter22')).toBe(true);
      expect(isStrongPassword('HelloThere1')).toBe(true);
    });

    it(`requires at least ${MIN_PASSWORD_LENGTH} chars`, () => {
      expect(isStrongPassword('Aa1')).toBe(false);
    });

    it('requires a letter', () => {
      expect(isStrongPassword('12345678')).toBe(false);
    });

    it('requires a digit', () => {
      expect(isStrongPassword('abcdefgh')).toBe(false);
    });

    it('rejects non-strings', () => {
      // @ts-expect-error: explicit type-pun to test runtime guard.
      expect(isStrongPassword(null)).toBe(false);
      // @ts-expect-error: explicit type-pun to test runtime guard.
      expect(isStrongPassword(12345678)).toBe(false);
    });
  });

  describe('generateRandomPassword', () => {
    it('uses default length when omitted', () => {
      const pw = generateRandomPassword();
      expect(pw).toHaveLength(DEFAULT_RANDOM_PASSWORD_LENGTH);
    });

    it('honors explicit length', () => {
      expect(generateRandomPassword(8)).toHaveLength(8);
      expect(generateRandomPassword(24)).toHaveLength(24);
    });

    it('avoids ambiguous characters', () => {
      const pw = generateRandomPassword(32);
      expect(pw).toMatch(/^[A-HJ-NP-Z2-9]+$/);
    });

    it('produces unique values', () => {
      const a = generateRandomPassword(32);
      const b = generateRandomPassword(32);
      expect(a).not.toBe(b);
    });

    it('rejects invalid lengths', () => {
      expect(() => generateRandomPassword(0)).toThrow();
      expect(() => generateRandomPassword(-1)).toThrow();
      expect(() => generateRandomPassword(33)).toThrow();
      expect(() => generateRandomPassword(1.5)).toThrow();
    });
  });

  describe('needsRehash', () => {
    it('returns true for a cost-10 hash', () => {
      // Real bcrypt cost-10 hash for "hunter2" (test fixture).
      const hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
      expect(needsRehash(hash)).toBe(true);
    });

    it('returns false for a cost-12 hash', async () => {
      const hash = await hashPassword('hunter2');
      expect(needsRehash(hash)).toBe(false);
    });

    it('returns true for malformed input', () => {
      expect(needsRehash('not-a-hash')).toBe(true);
      // @ts-expect-error: explicit type-pun to test runtime guard.
      expect(needsRehash(null)).toBe(true);
    });
  });
});
