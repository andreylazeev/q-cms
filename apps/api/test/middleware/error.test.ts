/**
 * Tests for the error middleware.
 *
 * - DomainError → envelope with the right `status` and `code`.
 * - ZodError   → 422 with field-level detail.
 * - Unknown    → 500.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { z, ZodError } from 'zod';
import { DomainError, NotFoundError, ValidationError } from '../../src/lib/stubs/core-shim.ts';
import { errorMiddleware } from '../../src/middleware/error.ts';
import { requestIdMiddleware } from '../../src/middleware/request-id.ts';

function makeApp() {
  const app = new Hono();
  app.use('*', requestIdMiddleware);
  app.onError(errorMiddleware);
  return app;
}

describe('errorMiddleware', () => {
  let app: Hono;
  beforeEach(() => {
    app = makeApp();
  });

  it('maps NotFoundError to 404', async () => {
    app.get('/x', () => {
      throw new NotFoundError('Widget missing');
    });
    const res = await app.request('/x');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { errors: Array<{ status: string; code: string; title: string; detail: string }> };
    expect(body.errors[0]?.status).toBe('404');
    expect(body.errors[0]?.code).toBe('not_found');
    expect(body.errors[0]?.detail).toBe('Widget missing');
  });

  it('maps generic DomainError to its httpStatus', async () => {
    class CustomError extends DomainError {
      constructor() {
        super('Custom', 'CUSTOM', 418);
      }
    }
    app.get('/x', () => {
      throw new CustomError();
    });
    const res = await app.request('/x');
    expect(res.status).toBe(418);
    const body = (await res.json()) as { errors: Array<{ code: string; title: string }> };
    expect(body.errors[0]?.code).toBe('custom');
    expect(body.errors[0]?.title).toBe('Custom');
  });

  it('maps ValidationError to 400', async () => {
    app.get('/x', () => {
      throw new ValidationError('bad');
    });
    const res = await app.request('/x');
    expect(res.status).toBe(400);
  });

  it('maps ZodError to 422 with field detail', async () => {
    const schema = z.object({ name: z.string().min(2) });
    app.post('/x', async (c) => {
      const body = await c.req.json().catch(() => ({}));
      const parsed = schema.parse(body);
      return c.json(parsed);
    });
    const res = await app.request('/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'a' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors: Array<{ code: string; meta: { fields: Record<string, string[]> } }> };
    expect(body.errors[0]?.code).toBe('validation_failed');
    expect(body.errors[0]?.meta.fields['name']).toBeDefined();
  });

  it('returns 500 for unknown errors', async () => {
    app.get('/x', () => {
      throw new Error('boom');
    });
    const res = await app.request('/x');
    expect(res.status).toBe(500);
    const body = (await res.json()) as { errors: Array<{ code: string }> };
    expect(body.errors[0]?.code).toBe('internal_error');
  });

  it('handles ZodError thrown directly', async () => {
    app.get('/x', (c) => {
      const schema = z.string();
      const result = schema.safeParse(123);
      if (!result.success) throw result.error;
      return c.json(result.data);
    });
    const res = await app.request('/x');
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors: Array<{ code: string }> };
    expect(body.errors[0]?.code).toBe('validation_failed');
  });

  it('returns request id in error envelope', async () => {
    app.get('/x', () => {
      throw new ZodError([]);
    });
    const res = await app.request('/x');
    const body = (await res.json()) as { errors: Array<{ id: string }> };
    expect(body.errors[0]?.id).toBeDefined();
  });
});
