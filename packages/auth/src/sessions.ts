/**
 * Server-side session helpers.
 *
 * - {@link createSessionId} mints a new branded `SessionId` from a v4 UUID.
 * - {@link hashToken} computes a SHA-256 hex digest for at-rest token
 *   storage (so a database leak does not yield usable session tokens).
 * - {@link validateSession} enforces expiry and revocation.
 *
 * @module sessions
 */

import { createHash, randomUUID } from 'node:crypto';
import type { SessionId } from '@q-cms/core/branded';
import { sessionId as brandSessionId } from '@q-cms/core/branded';
import { Err, Ok, type Result } from '@q-cms/core/result';
import { UnauthorizedError } from '@q-cms/core/errors';
import type { Session } from '@q-cms/core/types';

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

/**
 * Mint a fresh, branded {@link SessionId} from a cryptographically random
 * UUID. Node 22's `crypto.randomUUID` is the source — the brand only
 * constrains shape, not version.
 */
export function createSessionId(): SessionId {
  return brandSessionId(randomUUID());
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * Hash a session token with SHA-256 and return the hex digest.
 *
 * SHA-256 is appropriate here because the input is itself a high-entropy
 * random token (it isn't a user-chosen password). The hash is stored in
 * the database so that a database leak does not directly yield usable
 * session tokens.
 */
export function hashToken(token: string): string {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('hashToken: token must be a non-empty string');
  }
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Verify a session is still usable.
 *
 * Returns `Err(UnauthorizedError)` when:
 * - the session is revoked (`revokedAt` is set),
 * - the session has expired (`expiresAt` ≤ now),
 * - the session is structurally invalid (missing required fields).
 *
 * @param session - The session row from the database.
 * @param now - Optional override for the current time (useful in tests).
 */
export function validateSession(
  session: Session,
  now: Date = new Date(),
): Result<Session, UnauthorizedError> {
  if (!session || typeof session !== 'object') {
    return Err(new UnauthorizedError('Invalid session: not an object'));
  }
  if (session.revokedAt !== null) {
    return Err(new UnauthorizedError('Session has been revoked', { id: session.id }));
  }
  const expiresAt = new Date(session.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return Err(new UnauthorizedError('Session has an invalid expiresAt', { id: session.id }));
  }
  if (expiresAt.getTime() <= now.getTime()) {
    return Err(new UnauthorizedError('Session has expired', { id: session.id }));
  }
  return Ok(session);
}
