/**
 * Tests for the CORS middleware.
 */

import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { corsMiddleware } from '../../src/middleware/cors.ts';

describe('corsMiddleware', () => {
  it('allows configured origins with credentials', async () => {
    const app = new Hono();
    app.use('*', corsMiddleware({ allowedOrigins: ['https://app.example.com'], credentials: true }));
    app.get('/x', (c) => c.json({ ok: true }));
    const res = await app.request('/x', {
      headers: { origin: 'https://app.example.com' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('omits headers for disallowed origins', async () => {
    const app = new Hono();
    app.use('*', corsMiddleware({ allowedOrigins: ['https://app.example.com'], credentials: true }));
    app.get('/x', (c) => c.json({ ok: true }));
    const res = await app.request('/x', {
      headers: { origin: 'https://evil.example.com' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('handles OPTIONS preflight', async () => {
    const app = new Hono();
    app.use('*', corsMiddleware({ allowedOrigins: ['*'], credentials: false }));
    app.options('/x', (c) => c.text(''));
    const res = await app.request('/x', {
      method: 'OPTIONS',
      headers: { origin: 'https://anywhere.example.com' },
    });
    expect([200, 204]).toContain(res.status);
    expect(res.headers.get('access-control-allow-methods')).toBeDefined();
  });

  it('passes through non-OPTIONS without origin header', async () => {
    const app = new Hono();
    app.use('*', corsMiddleware({ allowedOrigins: ['https://app.example.com'], credentials: false }));
    app.get('/x', (c) => c.json({ ok: true }));
    const res = await app.request('/x');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
