/**
 * Password hashing and strength helpers.
 *
 * - {@link hashPassword} wraps bcrypt with the spec-mandated cost of 12.
 * - {@link verifyPassword} uses bcrypt's constant-time comparator.
 * - {@link isStrongPassword} enforces a minimum complexity bar
 *   (≥ 8 chars, at least one letter, at least one digit).
 * - {@link generateRandomPassword} produces URL-safe random strings.
 * - {@link needsRehash} returns `true` when a stored hash was produced at a
 *   cost lower than the current {@link BCRYPT_COST}, signalling the caller
 *   to re-derive the hash on next successful authentication.
 *
 * @module password
 */

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** bcrypt cost factor. Spec §6.1 mandates 12 for the Q-CMS API. */
export const BCRYPT_COST = 12;

/** Minimum acceptable plaintext password length. */
export const MIN_PASSWORD_LENGTH = 8;

/** Length of cryptographically random passwords generated on the server. */
export const DEFAULT_RANDOM_PASSWORD_LENGTH = 16;

/**
 * RFC 4648 base32 alphabet (uppercase, no padding).
 * Excludes digits that look like letters (0, 1, 8, 9) to keep
 * tokens unambiguous when transcribed by humans.
 */
const BASE32_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * Hash a plaintext password with bcrypt.
 *
 * @param plain - The plaintext password. Must be a non-empty string.
 * @returns A bcrypt hash string (`$2b$12$...`).
 * @throws {Error} If `bcrypt` fails (extremely rare; usually OOM).
 */
export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('hashPassword: plaintext must be a non-empty string');
  }
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Verify a plaintext password against a bcrypt hash in constant time.
 *
 * The bcrypt implementation compares the full hash; the early-return on
 * hash length only short-circuits malformed input. Timing differences for
 * well-formed input are bounded by bcrypt's own work factor.
 *
 * @param plain - The plaintext password to test.
 * @param hash - The bcrypt hash to test against.
 * @returns `true` if the password matches, `false` otherwise.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (typeof plain !== 'string' || typeof hash !== 'string') return false;
  if (plain.length === 0 || hash.length === 0) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Returns `true` if the given hash was produced at a bcrypt cost
 * lower than {@link BCRYPT_COST}.
 *
 * Use this after a successful authentication to transparently upgrade
 * the user's stored hash on the next sign-in.
 */
export function needsRehash(hash: string): boolean {
  if (typeof hash !== 'string') return true;
  // bcrypt hash format: $2b$<cost>$<22-char-salt><31-char-hash>
  const match = /^\$2[abxy]?\$(\d{2})\$/.exec(hash);
  if (!match || !match[1]) return true;
  const cost = Number.parseInt(match[1], 10);
  return cost < BCRYPT_COST;
}

// ---------------------------------------------------------------------------
// Strength validation
// ---------------------------------------------------------------------------

/**
 * Check whether a plaintext password meets Q-CMS minimum-strength rules.
 *
 * Rules:
 * - At least {@link MIN_PASSWORD_LENGTH} characters.
 * - At least one ASCII letter (`[A-Za-z]`).
 * - At least one ASCII digit (`[0-9]`).
 *
 * This is intentionally permissive — strong-enough to deter trivial
 * dictionary attacks while remaining usable for the admin SPA. Deploy
 * breached-password screening (e.g. HIBP k-anonymity) as a separate
 * check if stronger guarantees are required.
 */
export function isStrongPassword(plain: string): boolean {
  if (typeof plain !== 'string') return false;
  if (plain.length < MIN_PASSWORD_LENGTH) return false;
  if (!/[A-Za-z]/.test(plain)) return false;
  if (!/[0-9]/.test(plain)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Random password generation
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random password using the base32 alphabet.
 *
 * The output is URL-safe and ambiguous-character-free (`0`, `1`, `8`, `9`
 * are excluded) so it can be transcribed by humans when displayed in the
 * admin UI (e.g. one-time password resets).
 *
 * @param length - Number of base32 characters. Default 16.
 *                 Max 32 — the alphabet has 32 unique symbols, so
 *                 each draw is unbiased up to that length.
 */
export function generateRandomPassword(length: number = DEFAULT_RANDOM_PASSWORD_LENGTH): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('generateRandomPassword: length must be a positive integer');
  }
  if (length > 32) {
    throw new Error('generateRandomPassword: length must be ≤ 32 to preserve uniform distribution');
  }
  // 16 random bytes → up to 32 base32 chars without bias
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    if (byte === undefined) {
      // Defensive: randomBytes always returns length bytes.
      throw new Error('generateRandomPassword: unexpected short read from randomBytes');
    }
    out += BASE32_ALPHABET[byte % BASE32_ALPHABET.length];
  }
  return out;
}
