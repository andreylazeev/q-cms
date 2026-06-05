/**
 * TOTP (Time-based One-Time Password) per RFC 6238 / RFC 4226.
 *
 * - HMAC-SHA1, 6-digit codes, 30-second time step (RFC defaults).
 * - Secrets are 20 random bytes encoded as RFC 4648 base32 (no padding).
 * - Verification tolerates ±`window` steps of clock drift.
 * - Compatible with Google Authenticator, Authy, 1Password, etc.
 *
 * @module totp
 */

import { createHmac, randomBytes } from 'node:crypto';

// ---------------------------------------------------------------------------
// RFC 6238 defaults
// ---------------------------------------------------------------------------

/** Number of digits in the generated code. */
export const TOTP_DIGITS = 6;

/** Time-step size in seconds. */
export const TOTP_STEP_SECONDS = 30;

/** Initial counter value at the Unix epoch. */
export const TOTP_T0 = 0;

/** Length of the secret in bytes before base32 encoding. */
export const TOTP_SECRET_BYTES = 20;

/** Default allowed clock-drift windows on each side of the current step. */
export const TOTP_DEFAULT_WINDOW = 1;

/** RFC 4648 base32 alphabet (uppercase, no padding). */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// ---------------------------------------------------------------------------
// Secret generation
// ---------------------------------------------------------------------------

/**
 * Generate a fresh 20-byte secret, base32-encoded for storage and
 * display (and for use with authenticator apps).
 */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(TOTP_SECRET_BYTES));
}

// ---------------------------------------------------------------------------
// otpauth URI
// ---------------------------------------------------------------------------

/**
 * Build an `otpauth://totp/...` URI suitable for encoding as a QR code.
 *
 * The URI is fully spec-compliant (Google Authenticator accepts it as-is)
 * and uses the issuer-prefixed label convention
 * (`otpauth://totp/Issuer:accountName?...`).
 */
export function buildTotpUri(
  secret: string,
  accountName: string,
  issuer: string,
): string {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('buildTotpUri: secret must be a non-empty string');
  }
  if (typeof accountName !== 'string' || accountName.length === 0) {
    throw new Error('buildTotpUri: accountName must be a non-empty string');
  }
  if (typeof issuer !== 'string' || issuer.length === 0) {
    throw new Error('buildTotpUri: issuer must be a non-empty string');
  }
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({
    secret,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
    issuer,
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Verify a 6-digit TOTP code against the secret, tolerating
 * ±`window` steps of clock drift.
 *
 * @param secret - Base32-encoded shared secret.
 * @param code - User-supplied 6-digit code (whitespace is trimmed).
 * @param window - Allowed drift in steps (default 1 → ±30 s).
 * @returns `true` if any of the codes in the window match.
 */
export function verifyTotpCode(secret: string, code: string, window: number = TOTP_DEFAULT_WINDOW): boolean {
  if (typeof secret !== 'string' || secret.length === 0) return false;
  if (typeof code !== 'string') return false;
  if (!Number.isInteger(window) || window < 0) {
    throw new Error('verifyTotpCode: window must be a non-negative integer');
  }
  const cleaned = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;

  const key = base32Decode(secret);
  if (key.length === 0) return false;

  const counter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
  for (let i = -window; i <= window; i++) {
    if (constantTimeEqual(generateTotp(key, counter + i), cleaned)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Compute TOTP for a given counter value (RFC 4226 HOTP adapted). */
function generateTotp(key: Uint8Array, counter: number): string {
  // 8-byte big-endian counter
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', Buffer.from(key)).update(buf).digest();
  // Dynamic truncation
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binCode =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const modulo = 10 ** TOTP_DIGITS;
  return String(binCode % modulo).padStart(TOTP_DIGITS, '0');
}

/** Constant-time string equality. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// base32
// ---------------------------------------------------------------------------

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]!;
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

function base32Decode(input: string): Uint8Array {
  const cleaned = input.replace(/=+$/g, '').toUpperCase();
  const lookup = new Int8Array(128).fill(-1);
  for (let i = 0; i < BASE32_ALPHABET.length; i++) {
    lookup[BASE32_ALPHABET.charCodeAt(i)] = i;
  }
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i);
    if (code >= 128) return new Uint8Array(0);
    const v = lookup[code] ?? -1;
    if (v < 0) return new Uint8Array(0);
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}
