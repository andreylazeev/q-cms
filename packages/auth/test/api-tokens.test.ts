import { describe, expect, it } from 'vitest';
import {
  API_TOKEN_DISPLAY_PREFIX_LENGTH,
  API_TOKEN_PREFIX,
  API_TOKEN_RANDOM_LENGTH,
  generateApiToken,
  parseScopes,
  parseScopesResult,
  validateApiTokenScopes,
} from '../src/api-tokens.ts';
import { ValidationError } from '@q-cms/core/errors';

describe('api-tokens', () => {
  describe('generateApiToken', () => {
    it('returns a token with the qcs_ prefix', () => {
      const { token } = generateApiToken();
      expect(token.startsWith(API_TOKEN_PREFIX)).toBe(true);
    });

    it('returns a token of the documented length', () => {
      const { token } = generateApiToken();
      expect(token).toHaveLength(API_TOKEN_PREFIX.length + API_TOKEN_RANDOM_LENGTH);
    });

    it('returns a stable prefix of the documented length', () => {
      const { prefix, token } = generateApiToken();
      expect(prefix).toHaveLength(API_TOKEN_DISPLAY_PREFIX_LENGTH);
      expect(token.startsWith(prefix)).toBe(true);
    });

    it('returns a 64-char hex SHA-256 hash', () => {
      const { hash } = generateApiToken();
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces unique tokens on each call', () => {
      const a = generateApiToken();
      const b = generateApiToken();
      expect(a.token).not.toBe(b.token);
      expect(a.hash).not.toBe(b.hash);
    });

    it('avoid ambiguous characters in the random body', () => {
      const { token } = generateApiToken();
      const body = token.slice(API_TOKEN_PREFIX.length);
      expect(body).toMatch(/^[A-HJ-NP-Z2-9]+$/);
    });
  });

  describe('validateApiTokenScopes', () => {
    it('grants on exact scope match', () => {
      expect(validateApiTokenScopes({ scopes: ['read:entries'] }, 'read:entries')).toBe(true);
    });

    it('denies when no scope matches', () => {
      expect(validateApiTokenScopes({ scopes: ['read:entries'] }, 'write:entries')).toBe(false);
    });

    it('grants when token has the wildcard `*`', () => {
      expect(validateApiTokenScopes({ scopes: ['*'] }, 'delete:users')).toBe(true);
    });

    it('grants when token prefix is wildcarded', () => {
      expect(validateApiTokenScopes({ scopes: ['read:*'] }, 'read:entries')).toBe(true);
      expect(validateApiTokenScopes({ scopes: ['read:*'] }, 'read:media')).toBe(true);
      expect(validateApiTokenScopes({ scopes: ['read:*'] }, 'write:entries')).toBe(false);
    });

    it('rejects empty or invalid input', () => {
      // @ts-expect-error: explicit type-pun to test runtime guard.
      expect(validateApiTokenScopes(null, 'read:entries')).toBe(false);
      expect(validateApiTokenScopes({ scopes: [] }, 'read:entries')).toBe(false);
      expect(validateApiTokenScopes({ scopes: ['read:entries'] }, '')).toBe(false);
    });
  });

  describe('parseScopes', () => {
    it('splits a comma-separated list', () => {
      expect(parseScopes('read:entries,write:media')).toEqual(['read:entries', 'write:media']);
    });

    it('trims whitespace and dedupes', () => {
      expect(parseScopes('  read:entries , read:media  ,read:entries')).toEqual([
        'read:entries',
        'read:media',
      ]);
    });

    it('accepts whitespace as a separator', () => {
      expect(parseScopes('read:entries write:media')).toEqual(['read:entries', 'write:media']);
    });

    it('returns empty array on empty input', () => {
      expect(parseScopes('')).toEqual([]);
      expect(parseScopes('   ')).toEqual([]);
    });
  });

  describe('parseScopesResult', () => {
    it('returns Ok for a string', () => {
      const r = parseScopesResult('read:entries,write:media');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual(['read:entries', 'write:media']);
    });

    it('returns Err for non-string input', () => {
      // @ts-expect-error: explicit type-pun to test runtime guard.
      const r = parseScopesResult(123);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toBeInstanceOf(ValidationError);
    });
  });
});
