import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup.ts';
import {
  QcmsAuthError,
  QcmsError,
  QcmsNotFoundError,
  QcmsRateLimitError,
  QcmsServerError,
  QcmsValidationError,
  createClient,
} from '../src/index.ts';

const BASE = 'https://cms.test.example';

describe('QcmsClient', () => {
  it('sends a Bearer Authorization header when a token is configured', async () => {
    let captured: Request | null = null;
    server.use(
      http.get(`${BASE}/api/v1/auth/me`, ({ request }) => {
        captured = request;
        return HttpResponse.json({
          data: {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'a@b.test',
            username: null,
            passwordHash: null,
            firstName: null,
            lastName: null,
            avatarId: null,
            isActive: true,
            isSuperAdmin: false,
            totpEnabled: false,
            emailVerifiedAt: null,
            lastLoginAt: null,
            metadata: null,
            createdAt: '2026-06-01T00:00:00Z',
            updatedAt: '2026-06-01T00:00:00Z',
          },
        });
      }),
    );
    const cms = createClient({ baseUrl: BASE, token: 'jwt-abc' });
    const me = await cms.auth.me();
    expect(me.email).toBe('a@b.test');
    expect(captured).not.toBeNull();
    expect(captured!.headers.get('authorization')).toBe('Bearer jwt-abc');
    expect(captured!.headers.get('x-client')).toMatch(/@q-cms\/sdk\//);
  });

  it('uses apiKey when no token is set', async () => {
    let auth: string | null = null;
    server.use(
      http.get(`${BASE}/api/v1/auth/me`, ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json({ data: null });
      }),
    );
    const cms = createClient({ baseUrl: BASE, apiKey: 'qcs_xyz' });
    const me = await cms.auth.me();
    expect(me).toBeNull();
    expect(auth).toBe('Bearer qcs_xyz');
  });

  it('parses a paginated list response and exposes totalCount', async () => {
    server.use(
      http.get(`${BASE}/api/v1/collections/articles/entries`, () => {
        return HttpResponse.json({
          data: [
            {
              id: '00000000-0000-4000-8000-000000000010',
              type: 'Article',
              attributes: { title: 'Hello' },
              meta: { status: 'published', locale: 'en', version: 1 },
            },
            {
              id: '00000000-0000-4000-8000-000000000011',
              type: 'Article',
              attributes: { title: 'World' },
              meta: { status: 'published', locale: 'en', version: 1 },
            },
          ],
          meta: {
            pageInfo: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null, limit: 20, total: 2 },
            totalCount: 2,
          },
        }, { status: 200 });
      }),
    );
    const cms = createClient({ baseUrl: BASE, token: 't', maxRetries: 0 });
    const { data, meta } = await cms
      .entries('articles')
      .where({ status: 'published' })
      .get();
    expect(data).toHaveLength(2);
    expect(meta.totalCount).toBe(2);
    expect(meta.pageInfo.hasNext).toBe(false);
  });

  it('maps 401 → QcmsAuthError', async () => {
    server.use(
      http.get(`${BASE}/api/v1/auth/me`, () =>
        HttpResponse.json(
          {
            errors: [{ code: 'unauthorized', title: 'Unauthorized', detail: 'Token expired' }],
          },
          { status: 401 },
        ),
      ),
    );
    const cms = createClient({ baseUrl: BASE, token: 'bad' });
    await expect(cms.auth.me()).rejects.toBeInstanceOf(QcmsAuthError);
  });

  it('maps 404 → QcmsNotFoundError', async () => {
    server.use(
      http.get(`${BASE}/api/v1/users/abc`, () =>
        HttpResponse.json(
          { errors: [{ code: 'not_found', title: 'Not Found' }] },
          { status: 404 },
        ),
      ),
    );
    const cms = createClient({ baseUrl: BASE, token: 't' });
    await expect(cms.users.findById('abc')).rejects.toBeInstanceOf(QcmsNotFoundError);
  });

  it('maps 422 → QcmsValidationError with field map', async () => {
    server.use(
      http.post(`${BASE}/api/v1/users`, () =>
        HttpResponse.json(
          {
            errors: [
              {
                code: 'validation_failed',
                title: 'Validation failed',
                detail: 'Invalid input',
                meta: { fields: { email: ['must be a valid email'] } },
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    const cms = createClient({ baseUrl: BASE, token: 't' });
    try {
      await cms.users.create({ email: 'nope' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(QcmsValidationError);
      expect((err as QcmsValidationError).fields).toEqual({ email: ['must be a valid email'] });
    }
  });

  it('maps 429 → QcmsRateLimitError and parses Retry-After', async () => {
    server.use(
      http.get(`${BASE}/api/v1/auth/me`, () =>
        HttpResponse.json(
          { errors: [{ code: 'rate_limited', title: 'Too Many Requests' }] },
          { status: 429, headers: { 'Retry-After': '7' } },
        ),
      ),
    );
    const cms = createClient({ baseUrl: BASE, token: 't' });
    try {
      await cms.auth.me();
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(QcmsRateLimitError);
      expect((err as QcmsRateLimitError).retryAfter).toBe(7);
    }
  });

  it('retries 5xx up to maxRetries and then throws QcmsServerError', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/v1/auth/me`, () => {
        calls++;
        return new HttpResponse('boom', { status: 500 });
      }),
    );
    const cms = createClient({ baseUrl: BASE, token: 't', maxRetries: 2, initialBackoffMs: 1 });
    await expect(cms.auth.me()).rejects.toBeInstanceOf(QcmsServerError);
    // Initial attempt + 2 retries = 3 total
    expect(calls).toBe(3);
  });

  it('does not retry 4xx', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/v1/auth/me`, () => {
        calls++;
        return new HttpResponse('nope', { status: 404 });
      }),
    );
    const cms = createClient({ baseUrl: BASE, token: 't', maxRetries: 5, initialBackoffMs: 1 });
    await expect(cms.auth.me()).rejects.toBeInstanceOf(QcmsNotFoundError);
    expect(calls).toBe(1);
  });

  it('honors AbortSignal', async () => {
    server.use(
      http.get(`${BASE}/api/v1/auth/me`, async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json({ data: null });
      }),
    );
    const cms = createClient({ baseUrl: BASE, token: 't', timeoutMs: 50 });
    await expect(cms.auth.me()).rejects.toBeInstanceOf(QcmsError);
  });
});
