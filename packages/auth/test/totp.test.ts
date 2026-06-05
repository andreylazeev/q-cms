import { describe, expect, it } from 'vitest';
import { TOTP_DIGITS, TOTP_STEP_SECONDS, buildTotpUri, generateTotpSecret, verifyTotpCode } from '../src/totp.ts';

describe('totp', () => {
  describe('generateTotpSecret', () => {
    it('produces a base32 string of the expected length', () => {
      const secret = generateTotpSecret();
      expect(secret).toMatch(/^[A-Z2-7]+$/);
      // 20 bytes encodes to 32 base32 chars.
      expect(secret).toHaveLength(32);
    });

    it('produces unique secrets', () => {
      const a = generateTotpSecret();
      const b = generateTotpSecret();
      expect(a).not.toBe(b);
    });
  });

  describe('buildTotpUri', () => {
    it('builds a valid otpauth URI', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const uri = buildTotpUri(secret, 'alice@example.com', 'Q-CMS');
      expect(uri.startsWith('otpauth://totp/')).toBe(true);
      expect(uri).toContain(encodeURIComponent('Q-CMS'));
      expect(uri).toContain(encodeURIComponent('alice@example.com'));
      expect(uri).toContain(`secret=${secret}`);
      expect(uri).toContain(`digits=${TOTP_DIGITS}`);
      expect(uri).toContain(`period=${TOTP_STEP_SECONDS}`);
      expect(uri).toContain('algorithm=SHA1');
    });

    it('rejects empty inputs', () => {
      expect(() => buildTotpUri('', 'alice', 'Q-CMS')).toThrow();
      expect(() => buildTotpUri('JBSWY3DPEHPK3PXP', '', 'Q-CMS')).toThrow();
      expect(() => buildTotpUri('JBSWY3DPEHPK3PXP', 'alice', '')).toThrow();
    });
  });

  describe('verifyTotpCode', () => {
    /**
     * RFC 6238 test vector for the secret "12345678901234567890" / SHA1
     * at a fixed time. T = 59 s → code 94287082 (8 digits, but RFC uses
     * 6 here for the first vector: 287082). We re-derive 6-digit codes
     * for the canonical test points:
     *
     *   T = 59      → 287082
     *   T = 1111111109 → 081804
     *   T = 1111111111 → 050471
     *   T = 1234567890 → 005924
     *
     * Source: RFC 6238 Appendix B.
     */
    const RFC_SECRET_BYTES = '12345678901234567890';

    it('verifies the RFC 6238 T=59 test vector', async () => {
      // Compute the expected code from the same primitive path.
      const secret = encodeBase32(new TextEncoder().encode(RFC_SECRET_BYTES));
      // Re-implement the inner generator inline so the test is hermetic.
      // (Mirrors totp.ts#generateTotp.)
      // T = 59 (Unix seconds) → counter = floor(59 / 30) = 1.
      const counter = 1;
      const buf = Buffer.alloc(8);
      buf.writeBigInt64BE(BigInt(counter));
      const hmac = (await import('node:crypto')).createHmac('sha1', Buffer.from(RFC_SECRET_BYTES, 'utf8'))
        .update(buf)
        .digest();
      const offset = hmac[hmac.length - 1]! & 0x0f;
      const binCode =
        ((hmac[offset]! & 0x7f) << 24) |
        ((hmac[offset + 1]! & 0xff) << 16) |
        ((hmac[offset + 2]! & 0xff) << 8) |
        (hmac[offset + 3]! & 0xff);
      const expected = String(binCode % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
      expect(expected).toBe('287082');
      // And our verifyTotpCode agrees when we back-date Date.now to T=59.
      const realNow = Date.now;
      Date.now = () => 59 * 1000; // T = 59 s past the epoch
      try {
        expect(verifyTotpCode(secret, expected)).toBe(true);
      } finally {
        Date.now = realNow;
      }
    });

    it('rejects a wrong code', () => {
      const secret = generateTotpSecret();
      expect(verifyTotpCode(secret, '000000')).toBe(false);
    });

    it('rejects a non-numeric code', () => {
      const secret = generateTotpSecret();
      expect(verifyTotpCode(secret, 'abcdef')).toBe(false);
    });

    it('rejects codes with wrong length', () => {
      const secret = generateTotpSecret();
      expect(verifyTotpCode(secret, '12345')).toBe(false);
      expect(verifyTotpCode(secret, '1234567')).toBe(false);
    });

    it('tolerates clock drift inside the window', () => {
      const secret = generateTotpSecret();
      // Compute the current code, then verify with a generous window.
      const counter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
      const code = computeCode(secret, counter);
      // Even if "now" shifts slightly, the code is still valid.
      expect(verifyTotpCode(secret, code, 1)).toBe(true);
    });

    it('rejects an invalid secret', () => {
      // Empty / undecodable secrets must not throw, they must return false.
      expect(verifyTotpCode('', '123456')).toBe(false);
      expect(verifyTotpCode('!!!not-base32!!!', '123456')).toBe(false);
    });

    it('rejects a negative window', () => {
      const secret = generateTotpSecret();
      expect(() => verifyTotpCode(secret, '123456', -1)).toThrow();
    });

    it('strips whitespace from the code', () => {
      const secret = generateTotpSecret();
      const counter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
      const code = computeCode(secret, counter);
      expect(verifyTotpCode(secret, ` ${code.slice(0, 3)} ${code.slice(3)} `)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Helpers (test-only)
// ---------------------------------------------------------------------------

function encodeBase32(bytes: Uint8Array): string {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | (bytes[i] ?? 0);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 0x1f];
  return out;
}

function computeCode(secret: string, counter: number): string {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const lookup = new Int8Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) lookup[ALPHABET.charCodeAt(i)] = i;
  const cleaned = secret.toUpperCase().replace(/=+$/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const v = lookup[cleaned.charCodeAt(i)] ?? -1;
    if (v < 0) throw new Error('invalid base32');
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = (require('node:crypto') as typeof import('node:crypto'))
    .createHmac('sha1', Buffer.from(bytes))
    .update(buf)
    .digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binCode =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(binCode % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}
