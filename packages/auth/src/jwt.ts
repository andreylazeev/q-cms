/**
 * JWT signing and verification (HS256) for Q-CMS.
 *
 * Wraps the `jose` library and produces {@link Result}-flavored errors
 * so call sites can branch without try/catch noise. Both access and
 * refresh tokens share the same payload shape; the role of each is
 * determined by `ttl` and the `typ` header claim.
 *
 * @module jwt
 */

import { jwtVerify, SignJWT } from 'jose';
import { Err, Ok, type Result } from '@q-cms/core/result';
import { UnauthorizedError } from '@q-cms/core/errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Standard Q-CMS JWT payload.
 *
 * - `sub` — subject (user id, string form of `UserId`).
 * - `email` — user's email.
 * - `roles` — role names granted to the user.
 * - `scopes` — API scopes for token-level authorization.
 * - `iat` — issued-at (epoch seconds).
 * - `exp` — expiration (epoch seconds).
 */
export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly scopes: readonly string[];
  readonly iat: number;
  readonly exp: number;
}

/** Options for signing a JWT. */
export interface SignOptions {
  /** HMAC-SHA256 secret. Must be at least 32 bytes for HS256. */
  readonly secret: string;
  /** Time-to-live in seconds (e.g. 900 for 15-minute access tokens). */
  readonly ttl: number;
  /** Optional `typ` header (defaults to `JWT`). */
  readonly typ?: 'JWT' | 'refresh';
}

/** Options for verifying a JWT. */
export interface VerifyOptions {
  /** HMAC-SHA256 secret used to sign the token. */
  readonly secret: string;
  /** Required `typ` header; mismatches are rejected. */
  readonly typ?: 'JWT' | 'refresh';
  /**
   * Maximum allowed clock skew, in seconds, when validating `exp`/`iat`.
   * Defaults to 0.
   */
  readonly clockTolerance?: number;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Convert a UTF-8 string secret into a `Uint8Array` suitable for `jose`.
 * Encoded once and cached per-call (callers should hoist to a higher
 * scope if performance-critical).
 */
function toSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Coerce an unknown value into the `JwtPayload` shape. Throws when the
 * value is missing required fields or has the wrong runtime type.
 */
function toJwtPayload(value: unknown): JwtPayload {
  if (typeof value !== 'object' || value === null) {
    throw new Error('payload is not an object');
  }
  const v = value as Record<string, unknown>;
  if (typeof v['sub'] !== 'string') throw new Error('payload.sub must be a string');
  if (typeof v['email'] !== 'string') throw new Error('payload.email must be a string');
  if (!Array.isArray(v['roles']) || !v['roles'].every((r) => typeof r === 'string')) {
    throw new Error('payload.roles must be an array of strings');
  }
  if (!Array.isArray(v['scopes']) || !v['scopes'].every((s) => typeof s === 'string')) {
    throw new Error('payload.scopes must be an array of strings');
  }
  if (typeof v['iat'] !== 'number') throw new Error('payload.iat must be a number');
  if (typeof v['exp'] !== 'number') throw new Error('payload.exp must be a number');
  return {
    sub: v['sub'] as string,
    email: v['email'] as string,
    roles: v['roles'] as string[],
    scopes: v['scopes'] as string[],
    iat: v['iat'] as number,
    exp: v['exp'] as number,
  };
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

/**
 * Sign a JWT with HS256. `iat` and `exp` are populated from the current
 * time and `ttl`; the rest of the payload is forwarded verbatim.
 *
 * @param payload - Claims to embed (without `iat`/`exp`).
 * @param options - Secret and TTL.
 */
export async function signAccessToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  options: SignOptions,
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    roles: [...payload.roles],
    scopes: [...payload.scopes],
  })
    .setProtectedHeader({ alg: 'HS256', typ: options.typ ?? 'JWT' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${options.ttl}s`)
    .sign(toSecretKey(options.secret));
}

/**
 * Sign a refresh token. Identical to {@link signAccessToken} but stamps
 * the `typ` header as `refresh` so verifiers can reject the wrong kind.
 */
export async function signRefreshToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  options: Omit<SignOptions, 'typ'>,
): Promise<string> {
  return signAccessToken(payload, { ...options, typ: 'refresh' });
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Verify an access token and return its claims. Errors are mapped to
 * {@link UnauthorizedError} so the API layer can translate them to 401
 * without leaking the underlying jose reason.
 */
export async function verifyAccessToken(
  token: string,
  options: Omit<VerifyOptions, 'typ'>,
): Promise<Result<JwtPayload, UnauthorizedError>> {
  return verifyJwt(token, { ...options, typ: 'JWT' });
}

/**
 * Verify a refresh token. Rejects tokens whose `typ` is not `refresh`.
 */
export async function verifyRefreshToken(
  token: string,
  options: Omit<VerifyOptions, 'typ'>,
): Promise<Result<JwtPayload, UnauthorizedError>> {
  return verifyJwt(token, { ...options, typ: 'refresh' });
}

async function verifyJwt(
  token: string,
  options: VerifyOptions,
): Promise<Result<JwtPayload, UnauthorizedError>> {
  if (typeof token !== 'string' || token.length === 0) {
    return Err(new UnauthorizedError('JWT verification failed: empty token'));
  }
  const verifyOptions: Parameters<typeof jwtVerify>[2] = {
    algorithms: ['HS256'],
    clockTolerance: options.clockTolerance ?? 0,
  };
  if (options.typ !== undefined) {
    verifyOptions.typ = options.typ;
  }
  try {
    const { payload } = await jwtVerify(token, toSecretKey(options.secret), verifyOptions);
    return Ok(toJwtPayload(payload));
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return Err(new UnauthorizedError(`JWT verification failed: ${reason}`));
  }
}

// ---------------------------------------------------------------------------
// Bearer header
// ---------------------------------------------------------------------------

/**
 * Extract the raw token from an HTTP `Authorization: Bearer ...` header.
 *
 * The header value must be a single non-empty string starting with
 * `Bearer ` (case-insensitive). The token is returned *unverified* —
 * callers must pass it through {@link verifyAccessToken} or
 * {@link verifyRefreshToken}.
 */
export function extractBearerToken(
  authHeader: string | undefined,
): Result<string, UnauthorizedError> {
  if (typeof authHeader !== 'string' || authHeader.length === 0) {
    return Err(new UnauthorizedError('Missing Authorization header'));
  }
  const trimmed = authHeader.trim();
  const prefix = trimmed.slice(0, 7).toLowerCase();
  if (prefix !== 'bearer ') {
    return Err(new UnauthorizedError('Authorization header must use Bearer scheme'));
  }
  const token = trimmed.slice(7).trim();
  if (token.length === 0) {
    return Err(new UnauthorizedError('Bearer token is empty'));
  }
  return Ok(token);
}
