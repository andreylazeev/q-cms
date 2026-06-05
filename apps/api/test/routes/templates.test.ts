/**
 * Integration tests for the templates route using the in-memory stub.
 *
 * Covers list / get / create / patch / delete, plus the public
 * read-only endpoint that powers the static-site template engine.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { templatesRouter } from '../../src/routes/templates.ts';
import { publicTemplatesRouter } from '../../src/routes/public-templates.ts';
import { errorMiddleware } from '../../src/middleware/error.ts';
import { requestIdMiddleware } from '../../src/middleware/request-id.ts';

const ADMIN = { id: 'u_admin' as never, email: 'admin@test.local' };
type TemplateResource = {
  id: string;
  attributes: {
    name: string;
    slug: string;
    sections: unknown[];
  };
};

type TemplateResponse = { data: TemplateResource };
type TemplateListResponse = { data: TemplateResource[] };

function makeProtectedApp() {
  const app = new Hono();
  app.use('*', requestIdMiddleware);
  app.onError(errorMiddleware);
  app.use('*', async (c, next) => {
    c.set('user', ADMIN);
    c.set('roles', ['super-admin']);
    await next();
  });
  app.route('/', templatesRouter);
  return app;
}

function makePublicApp() {
  const app = new Hono();
  app.use('*', requestIdMiddleware);
  app.onError(errorMiddleware);
  app.route('/', publicTemplatesRouter);
  return app;
}

beforeEach(async () => {
  const { seedIfEmpty } = await import('../../src/lib/stubs/index.ts');
  await seedIfEmpty();
});

describe('templates router (protected)', () => {
  it('lists the seeded templates', async () => {
    const app = makeProtectedApp();
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as TemplateListResponse;
    const data = body.data;
    const slugs = data.map((d) => d.attributes.slug).sort();
    expect(slugs).toContain('home-default');
    expect(slugs).toContain('article-default');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const app = new Hono();
    app.use('*', requestIdMiddleware);
    app.onError(errorMiddleware);
    app.route('/', templatesRouter);
    const res = await app.request('/');
    expect(res.status).toBe(401);
  });

  it('creates a new template', async () => {
    const app = makeProtectedApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Landing v2',
        slug: 'landing-v2',
        description: 'A/B test variant',
        sections: [
          { id: 'a', type: 'hero', props: { headline: 'Hi' } },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as TemplateResponse;
    expect(body.data.attributes.slug).toBe('landing-v2');
    expect(body.data.attributes.sections).toHaveLength(1);
  });

  it('rejects a duplicate slug with 409', async () => {
    const app = makeProtectedApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Dup', slug: 'home-default' }),
    });
    expect(res.status).toBe(409);
  });

  it('rejects a bad slug with 422', async () => {
    const app = makeProtectedApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bad', slug: 'Has Spaces' }),
    });
    expect(res.status).toBe(422);
  });

  it('patches a template name', async () => {
    const app = makeProtectedApp();
    // Create a throwaway template.
    const created = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Before', slug: 'before' }),
    });
    const createdBody = (await created.json()) as TemplateResponse;
    const id = createdBody.data.id;
    const res = await app.request(`/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'After' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as TemplateResponse;
    expect(body.data.attributes.name).toBe('After');
  });

  it('returns 404 for an unknown id', async () => {
    const app = makeProtectedApp();
    const res = await app.request('/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('deletes a template', async () => {
    const app = makeProtectedApp();
    const created = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Trash', slug: 'trash' }),
    });
    const createdBody = (await created.json()) as TemplateResponse;
    const id = createdBody.data.id;
    const del = await app.request(`/${id}`, { method: 'DELETE' });
    expect(del.status).toBe(204);
    const get = await app.request(`/${id}`);
    expect(get.status).toBe(404);
  });
});

describe('public templates router (no auth)', () => {
  it('returns the spec for a seeded template', async () => {
    const app = makePublicApp();
    const res = await app.request('/home-default');
    expect(res.status).toBe(200);
    const body = (await res.json()) as TemplateResponse;
    const attrs = body.data.attributes;
    expect(attrs.slug).toBe('home-default');
    expect(Array.isArray(attrs.sections)).toBe(true);
  });

  it('returns 404 for an unknown slug', async () => {
    const app = makePublicApp();
    const res = await app.request('/never-made');
    expect(res.status).toBe(404);
  });
});
