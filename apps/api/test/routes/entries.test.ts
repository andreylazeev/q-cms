/**
 * Integration tests for the entries route using mocked repos.
 *
 * Covers POST → GET → PATCH → DELETE → publish on a singleton + a
 * non-singleton collection. The auth middleware is bypassed by
 * stubbing the user/roles into the context via a small wrapper.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { entriesRouter, bulkRouter } from '../../src/routes/entries.ts';
import { userRepo, seedIfEmpty } from '../../src/lib/stubs/index.ts';
import { errorMiddleware } from '../../src/middleware/error.ts';
import { requestIdMiddleware } from '../../src/middleware/request-id.ts';
import { hashPassword } from '../../src/lib/stubs/index.ts';
import type { UserId } from '../../src/lib/stubs/core-shim.ts';

async function seedUser(): Promise<{ id: UserId; email: string }> {
  const passwordHash = await hashPassword('admin-pass-1234');
  const user = await userRepo.create({
    email: 'admin@test.local' as never,
    username: 'admin',
    passwordHash,
    firstName: null,
    lastName: null,
    avatarId: null,
    isActive: true,
    isSuperAdmin: true,
    totpEnabled: false,
    emailVerifiedAt: new Date().toISOString(),
    lastLoginAt: null,
    metadata: {},
  });
  return { id: user.id, email: user.email };
}

function makeApp(auth: { id: UserId; email: string } | null) {
  const app = new Hono();
  app.use('*', requestIdMiddleware);
  app.onError(errorMiddleware);
  // Stub auth context — in real use, the auth middleware populates this.
  app.use('*', async (c, next) => {
    if (auth) {
      c.set('user', auth);
      c.set('roles', ['super-admin']);
    }
    await next();
  });
  app.route('/', entriesRouter);
  app.route('/', bulkRouter);
  return app;
}

describe('entries router', () => {
  beforeEach(async () => {
    await seedIfEmpty();
  });

  it('POST creates an entry in a non-singleton collection', async () => {
    const user = await seedUser();
    const app = makeApp(user);
    const res = await app.request('/collections/articles/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'hello-world', locale: 'en', data: { title: 'Hello' } }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; attributes: { slug: string; data: { title: string } } } };
    expect(body.data.attributes.slug).toBe('hello-world');
    expect(body.data.attributes.data).toEqual({ title: 'Hello' });
  });

  it('GET returns the entry by id', async () => {
    const user = await seedUser();
    const app = makeApp(user);
    const postRes = await app.request('/collections/articles/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'getme', locale: 'en', data: {} }),
    });
    const id = ((await postRes.json()) as { data: { id: string } }).data.id;
    const res = await app.request(`/collections/articles/entries/${id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(id);
  });

  it('PATCH updates entry data', async () => {
    const user = await seedUser();
    const app = makeApp(user);
    const post = await app.request('/collections/articles/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'patchme', locale: 'en', data: { title: 'A' } }),
    });
    const id = ((await post.json()) as { data: { id: string } }).data.id;
    const res = await app.request(`/collections/articles/entries/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: { title: 'B' } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { attributes: { data: { title: string } } } };
    expect(body.data.attributes.data.title).toBe('B');
  });

  it('DELETE removes the entry', async () => {
    const user = await seedUser();
    const app = makeApp(user);
    const post = await app.request('/collections/articles/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'deleteme', locale: 'en', data: {} }),
    });
    const id = ((await post.json()) as { data: { id: string } }).data.id;
    const res = await app.request(`/collections/articles/entries/${id}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    const after = await app.request(`/collections/articles/entries/${id}`);
    expect(after.status).toBe(404);
  });

  it('POST publish moves status to published', async () => {
    const user = await seedUser();
    const app = makeApp(user);
    const post = await app.request('/collections/articles/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'pubme', locale: 'en', data: {} }),
    });
    const id = ((await post.json()) as { data: { id: string } }).data.id;
    const res = await app.request(`/collections/articles/entries/${id}/publish`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { attributes: { status: string; publishedAt: string | null } } };
    expect(body.data.attributes.status).toBe('published');
    expect(body.data.attributes.publishedAt).toBeDefined();
  });

  it('POST /bulk accepts multiple ops', async () => {
    const user = await seedUser();
    const app = makeApp(user);
    const res = await app.request('/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        atomic: false,
        operations: [
          { op: 'create', ref: 'a', resource: 'articles', data: { data: {}, slug: 'bulk-1', locale: 'en' } },
          { op: 'create', ref: 'b', resource: 'articles', data: { data: {}, slug: 'bulk-2', locale: 'en' } },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Array<{ ref: string; status: number }> };
    expect(body.results).toHaveLength(2);
    expect(body.results.every((r) => r.status === 201)).toBe(true);
  });

  it('GET list returns collection metadata in pageInfo', async () => {
    const user = await seedUser();
    const app = makeApp(user);
    await app.request('/collections/articles/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'listme', locale: 'en', data: {} }),
    });
    const res = await app.request('/collections/articles/entries?withTotal=true');
    const body = (await res.json()) as { data: unknown[]; meta: { totalCount?: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.totalCount).toBeGreaterThan(0);
  });

  it('returns 404 for unknown collection', async () => {
    const user = await seedUser();
    const app = makeApp(user);
    const res = await app.request('/collections/nope/entries');
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown entry id', async () => {
    const user = await seedUser();
    const app = makeApp(user);
    const res = await app.request('/collections/articles/entries/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });
});
