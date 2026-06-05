/**
 * Personal Access Token (PAT) helpers.
 *
 * - {@link generateApiToken} mints a new `qcs_…` token and returns the
 *   plaintext (shown once to the user) alongside a SHA-256 hash and
 *   short prefix for at-rest storage and UI display.
 * - {@link validateApiTokenScopes} checks that a stored token grants
 *   a required scope. A wildcard `*` scope grants everything.
 * - {@link parseScopes} normalizes a comma-separated scope string.
 *
 * @module api-tokens
 */

import { createHash, randomBytes } from 'node:crypto';
import { ValidationError } from '@q-cms/core/errors';
import { Err, Ok, type Result } from '@q-cms/core/result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Public token prefix; users recognise tokens by this. */
export const API_TOKEN_PREFIX = 'qcs_';

/** Number of random characters after the prefix. */
export const API_TOKEN_RANDOM_LENGTH = 32;

/** Length of the short prefix stored for display (e.g. `qcs_AB12…`). */
export const API_TOKEN_DISPLAY_PREFIX_LENGTH = 8;

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Mint a fresh API token.
 *
 * Returns the plaintext token (the only copy the server will ever see),
 * its SHA-256 hex hash (for at-rest verification), and a short display
 * prefix (for the admin UI).
 *
 * The random part uses `crypto.randomBytes` and the RFC 4648 base32
 * alphabet (no padding, ambiguous characters excluded).
 */
export function generateApiToken(): {
  readonly token: string;
  readonly hash: string;
  readonly prefix: string;
} {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(API_TOKEN_RANDOM_LENGTH);
  let body = '';
  for (let i = 0; i < API_TOKEN_RANDOM_LENGTH; i++) {
    const byte = bytes[i];
    if (byte === undefined) {
      throw new Error('generateApiToken: unexpected short read from randomBytes');
    }
    body += alphabet[byte % alphabet.length];
  }
  const token = `${API_TOKEN_PREFIX}${body}`;
  const hash = createHash('sha256').update(token, 'utf8').digest('hex');
  const prefix = token.slice(0, API_TOKEN_DISPLAY_PREFIX_LENGTH);
  return { token, hash, prefix };
}

// ---------------------------------------------------------------------------
// Scope validation
// ---------------------------------------------------------------------------

/**
 * A stored API token shape — just what we need to check scopes.
 */
export interface ApiTokenScopeSubject {
  readonly scopes: readonly string[];
}

/**
 * Check that a stored token has a given scope.
 *
 * The required scope uses `:`-separated segments. Match rules:
 * - Exact match against any of the token's scopes grants.
 * - A trailing `:*` segment acts as a wildcard prefix
 *   (e.g. `read:*` matches `read:entries`).
 * - A literal `*` scope on the token grants everything.
 *
 * @returns `true` if the token's scopes satisfy the requirement.
 */
export function validateApiTokenScopes(
  token: ApiTokenScopeSubject,
  required: string,
): boolean {
  if (!token || !Array.isArray(token.scopes)) return false;
  if (typeof required !== 'string' || required.length === 0) return false;
  for (const scope of token.scopes) {
    if (scope === '*') return true;
    if (scope === required) return true;
    if (scope.endsWith(':*')) {
      const prefix = scope.slice(0, -2);
      if (required === prefix || required.startsWith(`${prefix}:`)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Scope parsing
// ---------------------------------------------------------------------------

/**
 * Normalize a comma- or whitespace-separated scope string into a
 * deduplicated, trimmed array of scope tokens.
 *
 * Examples:
 * - `"read:entries,write:media"` → `["read:entries", "write:media"]`
 * - `"read:entries  read:media"` → `["read:entries", "read:media"]`
 *
 * @returns A deduplicated list of scope strings.
 */
export function parseScopes(input: string): string[] {
  if (typeof input !== 'string') return [];
  const seen: string[] = [];
  const seenSet = new Set<string>();
  for (const raw of input.split(/[,\s]+/)) {
    const trimmed = raw.trim();
    if (trimmed.length > 0 && !seenSet.has(trimmed)) {
      seenSet.add(trimmed);
      seen.push(trimmed);
    }
  }
  return seen;
}

// ---------------------------------------------------------------------------
// Result-flavored wrapper
// ---------------------------------------------------------------------------

/**
 * Parse a scope list with explicit error handling. Same semantics as
 * {@link parseScopes}, but returns `Err(ValidationError)` for non-string
 * input rather than silently treating it as empty.
 */
export function parseScopesResult(
  input: unknown,
): Result<string[], ValidationError> {
  if (typeof input !== 'string') {
    return Err(new ValidationError('parseScopes: input must be a string', { input }));
  }
  return Ok(parseScopes(input));
}
