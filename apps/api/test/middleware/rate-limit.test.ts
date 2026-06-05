/**
 * Tests for the rate-limit middleware.
 */

import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { rateLimitMiddleware } from '../../src/middleware/rate-limit.ts';

describe('rateLimitMiddleware', () => {
  it('sets X-RateLimit-* headers on success', async () => {
    const app = new Hono();
    app.use('*', rateLimitMiddleware({ limit: 5, windowSeconds: 60, bucket: 'test-success' }));
    app.get('/x', (c) => c.json({ ok: true }));
    const res = await app.request('/x');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Policy')).toBe('5;w=60');
  });

  it('returns 429 after threshold exhausted', async () => {
    const app = new Hono();
    app.use('*', rateLimitMiddleware({ limit: 2, windowSeconds: 60, bucket: 'test-threshold' }));
    app.get('/x', (c) => c.json({ ok: true }));
    const r1 = await app.request('/x');
    const r2 = await app.request('/x');
    const r3 = await app.request('/x');
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    expect(r3.headers.get('Retry-After')).toBeDefined();
  });
});
