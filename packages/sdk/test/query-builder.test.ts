import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup.ts';
import { createClient } from '../src/index.ts';

const BASE = 'https://cms.test.example';

describe('QueryBuilder', () => {
  it('serializes chained filters, populate, sort, and pagination into the URL', async () => {
    let observed = '';
    server.use(
      http.get(`${BASE}/api/v1/collections/articles/entries`, ({ request }) => {
        observed = request.url;
        return HttpResponse.json({
          data: [],
          meta: {
            pageInfo: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null, limit: 5, total: 0 },
            totalCount: 0,
          },
        });
      }),
    );
    const cms = createClient({ baseUrl: BASE, token: 't' });
    await cms
      .entries('articles')
      .where({ status: 'published', title: { contains: 'hello' }, deletedAt: null })
      .populate(['author', 'tags'])
      .fields(['id', 'title', 'author.name'])
      .sort('-publishedAt')
      .limit(5)
      .locale('en')
      .status('published')
      .withTotal()
      .get();
    const url = new URL(observed);
    expect(url.searchParams.get('filter[status]')).toBe('published');
    expect(url.searchParams.get('filter[title]')).toBe('contains.hello');
    expect(url.searchParams.get('filter[deletedAt]')).toBe('isNull');
    expect(url.searchParams.get('populate')).toBe('author,tags');
    expect(url.searchParams.get('fields')).toBe('id,title,author.name');
    expect(url.searchParams.get('sort')).toBe('-publishedAt');
    expect(url.searchParams.get('page[limit]')).toBe('5');
    expect(url.searchParams.get('locale')).toBe('en');
    expect(url.searchParams.get('status')).toBe('published');
    expect(url.searchParams.get('page[withTotal]')).toBe('true');
  });

  it('getOne throws when zero rows match', async () => {
    server.use(
      http.get(`${BASE}/api/v1/collections/articles/entries`, () =>
        HttpResponse.json({
          data: [],
          meta: {
            pageInfo: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null, limit: 2, total: 0 },
            totalCount: 0,
          },
        }),
      ),
    );
    const cms = createClient({ baseUrl: BASE, token: 't' });
    await expect(cms.entries('articles').where({ slug: 'missing' }).getOne()).rejects.toThrow(
      /no entry matched/,
    );
  });

  it('getOne throws when more than one row matches', async () => {
    server.use(
      http.get(`${BASE}/api/v1/collections/articles/entries`, () =>
        HttpResponse.json({
          data: [
            { id: '00000000-0000-4000-8000-000000000001', attributes: { title: 'A' } },
            { id: '00000000-0000-4000-8000-000000000002', attributes: { title: 'B' } },
          ],
          meta: {
            pageInfo: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null, limit: 2, total: 2 },
            totalCount: 2,
          },
        }),
      ),
    );
    const cms = createClient({ baseUrl: BASE, token: 't' });
    await expect(cms.entries('articles').where({ status: 'published' }).getOne()).rejects.toThrow(
      /expected exactly one/,
    );
  });

  it('create/update/delete/publish route to the right URLs', async () => {
    const calls: { method: string; path: string; body: unknown }[] = [];
    server.use(
      http.post(`${BASE}/api/v1/collections/articles/entries`, async ({ request }) => {
        calls.push({ method: 'POST', path: '/collections/articles/entries', body: await request.json() });
        return HttpResponse.json({ data: { id: '1', attributes: { title: 'n' } } }, { status: 201 });
      }),
      http.patch(`${BASE}/api/v1/collections/articles/entries/uuid-1`, async ({ request }) => {
        calls.push({ method: 'PATCH', path: '/collections/articles/entries/uuid-1', body: await request.json() });
        return HttpResponse.json({ data: { id: '1', attributes: { title: 'u' } } });
      }),
      http.delete(`${BASE}/api/v1/collections/articles/entries/uuid-1`, () => {
        calls.push({ method: 'DELETE', path: '/collections/articles/entries/uuid-1', body: null });
        return new HttpResponse(null, { status: 204 });
      }),
      http.post(`${BASE}/api/v1/collections/articles/entries/uuid-1/publish`, () => {
        calls.push({ method: 'POST', path: '/collections/articles/entries/uuid-1/publish', body: null });
        return HttpResponse.json({ data: { id: '1', meta: { status: 'published' } } });
      }),
    );
    const cms = createClient({ baseUrl: BASE, token: 't' });
    const created = await cms.entries('articles').create({ title: 'n' });
    expect(created.id).toBe('1');
    const updated = await cms.entries('articles').update('uuid-1', { title: 'u' });
    expect(updated.id).toBe('1');
    await cms.entries('articles').delete('uuid-1');
    await cms.entries('articles').publish('uuid-1');
    expect(calls.map((c) => c.method)).toEqual(['POST', 'PATCH', 'DELETE', 'POST']);
  });
});
