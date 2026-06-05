import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiClientError, QueryBuilder } from './index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function lastFetchUrl(mock: ReturnType<typeof vi.fn>): string {
  const call = mock.mock.lastCall;
  return call?.[0] instanceof Request
    ? (call[0] as Request).url
    : String(call?.[0] ?? '');
}

function lastFetchInit(mock: ReturnType<typeof vi.fn>): RequestInit | undefined {
  return mock.mock.lastCall?.[1];
}

// ---------------------------------------------------------------------------

describe('ApiClient', () => {
  let client: ApiClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = new ApiClient({ baseUrl: 'https://cms.example.com/', token: 'test-token' });
  });

  // -- constructor & setToken -----------------------------------------------

  it('strips trailing slash from baseUrl', () => {
    expect(client.baseUrl).toBe('https://cms.example.com');
  });

  it('allows updating the token', () => {
    client.setToken('new-token');
    // Verify via a request that uses the new token
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'u1', email: 'a@b.com' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    return client.users.me().then(() => {
      const init = lastFetchInit(fetchMock);
      expect((init?.headers as Headers).get('Authorization')).toBe('Bearer new-token');
    });
  });

  // -- entries --------------------------------------------------------------

  describe('entries', () => {
    it('fetches entries list with pagination', async () => {
      const payload = { data: [{ id: 'e1', collectionId: 'c1' }], pagination: { total: 1, page: 1, limit: 25, totalPages: 1 } };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

      const result = await client.entries('posts').list();
      expect(result).toEqual(payload);
      expect(lastFetchUrl(fetchMock)).toBe('https://cms.example.com/api/entries/posts');
    });

    it('passes query builder params in list', async () => {
      const q = new QueryBuilder().filter('status', 'eq', 'published').sort('createdAt', 'desc').limit(10).select('id', 'title');
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

      await client.entries('posts').list(q);
      const url = lastFetchUrl(fetchMock);
      expect(url).toContain('?filter=');
      expect(url).toContain('sort=');
      expect(url).toContain('limit=10');
      expect(url).toContain('fields=id%2Ctitle');
    });

    it('fetches a single entry by id', async () => {
      const entry = { id: 'e1', collectionId: 'c1', data: {} };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(entry), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await client.entries('posts').get('e1' as any);
      expect(result).toEqual(entry);
      expect(lastFetchUrl(fetchMock)).toBe('https://cms.example.com/api/entries/posts/e1');
    });

    it('creates an entry', async () => {
      const created = { id: 'e2', collectionId: 'c1', data: { title: 'New' } };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(created), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }));

      const result = await client.entries('posts').create({ data: { title: 'New' } });
      expect(result).toEqual(created);
      const init = lastFetchInit(fetchMock);
      expect(init?.method).toBe('POST');
    });

    it('updates an entry', async () => {
      const updated = { id: 'e1', collectionId: 'c1', data: { title: 'Updated' } };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(updated), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await client.entries('posts').update('e1' as any, { data: { title: 'Updated' } });
      expect(result).toEqual(updated);
      const init = lastFetchInit(fetchMock);
      expect(init?.method).toBe('PATCH');
    });

    it('deletes an entry', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await client.entries('posts').delete('e1' as any);
      expect(result).toBeUndefined();
      const init = lastFetchInit(fetchMock);
      expect(init?.method).toBe('DELETE');
    });

    it('passes AbortSignal', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [], pagination: { total: 0, page: 1, limit: 25, totalPages: 0 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
      const controller = new AbortController();
      await client.entries('posts').list(undefined, { signal: controller.signal });
      const init = lastFetchInit(fetchMock);
      expect(init?.signal).toBe(controller.signal);
    });

    it('passes locale in options', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [], pagination: { total: 0, page: 1, limit: 25, totalPages: 0 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
      await client.entries('posts').list(undefined, { locale: 'ru' as never });
      expect(lastFetchUrl(fetchMock)).toContain('locale=ru');
    });
  });

  // -- collections ----------------------------------------------------------

  describe('collections', () => {
    it('lists collections', async () => {
      const payload = { data: [{ id: 'c1', name: 'Posts', slug: 'posts' }], pagination: { total: 1, page: 1, limit: 25, totalPages: 1 } };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      const result = await client.collections.list();
      expect(result).toEqual(payload);
      expect(lastFetchUrl(fetchMock)).toBe('https://cms.example.com/api/collections');
    });

    it('gets a collection by id', async () => {
      const col = { id: 'c1', name: 'Posts', slug: 'posts' };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(col), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      const result = await client.collections.get('c1');
      expect(result).toEqual(col);
    });

    it('finds a collection by slug', async () => {
      const col = { id: 'c1', name: 'Posts', slug: 'posts' };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(col), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      const result = await client.collections.findBySlug('posts' as never);
      expect(result).toEqual(col);
      expect(lastFetchUrl(fetchMock)).toContain('slug=posts');
    });
  });

  // -- users ----------------------------------------------------------------

  describe('users', () => {
    it('fetches current user', async () => {
      const user = { id: 'u1', email: 'me@example.com', status: 'active' };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      const result = await client.users.me();
      expect(result).toEqual(user);
      expect(lastFetchUrl(fetchMock)).toBe('https://cms.example.com/api/users/me');
    });

    it('lists users', async () => {
      const payload = { data: [{ id: 'u1', email: 'a@b.com', status: 'active' }], pagination: { total: 1, page: 1, limit: 25, totalPages: 1 } };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      const result = await client.users.list();
      expect(result).toEqual(payload);
    });
  });

  // -- media ----------------------------------------------------------------

  describe('media', () => {
    it('lists media', async () => {
      const payload = { data: [{ id: 'm1', filename: 'img.png' }], pagination: { total: 1, page: 1, limit: 25, totalPages: 1 } };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      const result = await client.media.list();
      expect(result).toEqual(payload);
      expect(lastFetchUrl(fetchMock)).toBe('https://cms.example.com/api/media');
    });

    it('uploads media as FormData', async () => {
      const media = { id: 'm1', filename: 'photo.jpg' };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(media), { status: 201, headers: { 'Content-Type': 'application/json' } }));

      const file = new Blob(['fake'], { type: 'image/jpeg' });
      const result = await client.media.upload(file, { alt: 'photo' });
      expect(result).toEqual(media);
      const init = lastFetchInit(fetchMock);
      expect(init?.method).toBe('POST');
      expect(init?.body).toBeInstanceOf(FormData);
    });

    it('deletes media', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.media.delete('m1' as any);
      const init = lastFetchInit(fetchMock);
      expect(init?.method).toBe('DELETE');
    });
  });

  // -- roles -----------------------------------------------------------------

  describe('roles', () => {
    it('lists roles', async () => {
      const payload = { data: [{ id: 'r1', name: 'Admin', permissions: [] }], pagination: { total: 1, page: 1, limit: 25, totalPages: 1 } };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      const result = await client.roles.list();
      expect(result).toEqual(payload);
      expect(lastFetchUrl(fetchMock)).toBe('https://cms.example.com/api/roles');
    });
  });

  // -- auth ------------------------------------------------------------------

  describe('auth', () => {
    it('logs in', async () => {
      const payload = { user: { id: 'u1', email: 'a@b.com', status: 'active' }, token: 'jwt-token' };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      const result = await client.auth.login('a@b.com', 'pass');
      expect(result).toEqual(payload);
      const init = lastFetchInit(fetchMock);
      expect(init?.method).toBe('POST');
      expect((init?.body as string)).toContain('"email"');
    });

    it('logs out', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
      await client.auth.logout();
      const init = lastFetchInit(fetchMock);
      expect(init?.method).toBe('POST');
    });

    it('refreshes token', async () => {
      const payload = { token: 'new-jwt' };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      const result = await client.auth.refresh();
      expect(result).toEqual(payload);
      const init = lastFetchInit(fetchMock);
      expect(init?.method).toBe('POST');
    });
  });

  // -- error handling -------------------------------------------------------

  describe('error handling', () => {
    it('throws ApiClientError on 404', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }));

      await expect(client.entries('posts').list()).rejects.toMatchObject({
        status: 404,
        isNotFound: true,
      });
    });

    it('throws ApiClientError on 401', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }));

      await expect(client.users.me()).rejects.toMatchObject({
        status: 401,
        isUnauthorized: true,
      });
    });

    it('throws ApiClientError on 403', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }));

      await expect(client.entries('posts').list()).rejects.toMatchObject({
        status: 403,
        isForbidden: true,
      });
    });

    it('throws ApiClientError on 429', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }));

      await expect(client.entries('posts').list()).rejects.toMatchObject({
        status: 429,
        isRateLimited: true,
      });
    });

    it('throws ApiClientError on 500 with isServerError', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }));

      await expect(client.entries('posts').list()).rejects.toMatchObject({
        status: 500,
        isServerError: true,
      });
    });
  });
});

// ---------------------------------------------------------------------------
// QueryBuilder
// ---------------------------------------------------------------------------

describe('QueryBuilder', () => {
  it('serializes empty to undefined', () => {
    expect(new QueryBuilder().toSearchParams()).toBeUndefined();
  });

  it('serializes filters as JSON', () => {
    const q = new QueryBuilder().filter('status', 'eq', 'published');
    const p = q.toSearchParams()!;
    expect(p.get('filter')).toBe(JSON.stringify([{ field: 'status', operator: 'eq', value: 'published' }]));
  });

  it('serializes sort', () => {
    const q = new QueryBuilder().sort('createdAt', 'desc').sort('title');
    const p = q.toSearchParams()!;
    expect(p.get('sort')).toBe(JSON.stringify([
      { field: 'createdAt', direction: 'desc' },
      { field: 'title', direction: 'asc' },
    ]));
  });

  it('serializes pagination', () => {
    const q = new QueryBuilder().page(2).limit(10);
    const p = q.toSearchParams()!;
    expect(p.get('page')).toBe('2');
    expect(p.get('limit')).toBe('10');
  });

  it('serializes locale', () => {
    const q = new QueryBuilder().locale('ru');
    const p = q.toSearchParams()!;
    expect(p.get('locale')).toBe('ru');
  });

  it('serializes fields', () => {
    const q = new QueryBuilder().select('id', 'title', 'slug');
    const p = q.toSearchParams()!;
    expect(p.get('fields')).toBe('id,title,slug');
  });

  it('serializes include', () => {
    const q = new QueryBuilder().include('author', 'tags');
    const p = q.toSearchParams()!;
    expect(p.get('include')).toBe('author,tags');
  });

  it('combines all params', () => {
    const q = new QueryBuilder()
      .filter('status', 'eq', 'published')
      .page(1)
      .limit(10)
      .locale('en')
      .select('id', 'title')
      .include('author');

    const p = q.toSearchParams()!;
    expect(p.has('filter')).toBe(true);
    expect(p.has('page')).toBe(true);
    expect(p.has('limit')).toBe(true);
    expect(p.has('locale')).toBe(true);
    expect(p.has('fields')).toBe(true);
    expect(p.has('include')).toBe(true);
  });

  it('chains methods fluently', () => {
    const q = new QueryBuilder()
      .filter('a', 'eq', 1)
      .filter('b', 'neq', 2)
      .sort('x')
      .page(3)
      .limit(5)
      .locale('fr')
      .select('id')
      .include('c');

    const p = q.toSearchParams()!;
    expect(p.size).toBe(7);
  });

  it('toPageInput returns undefined when neither page nor limit set', () => {
    expect(new QueryBuilder().toPageInput()).toBeUndefined();
  });

  it('toPageInput defaults page to 1 and limit to 25', () => {
    expect(new QueryBuilder().toPageInput()).toBeUndefined();
    expect(new QueryBuilder().page(2).toPageInput()).toEqual({ page: 2, limit: 25 });
    expect(new QueryBuilder().limit(10).toPageInput()).toEqual({ page: 1, limit: 10 });
    expect(new QueryBuilder().page(2).limit(10).toPageInput()).toEqual({ page: 2, limit: 10 });
  });
});

// ---------------------------------------------------------------------------
// ApiClientError
// ---------------------------------------------------------------------------

describe('ApiClientError', () => {
  it('stores status, body and url', () => {
    const err = new ApiClientError({ status: 404, body: { message: 'Nope' }, url: '/test' });
    expect(err.status).toBe(404);
    expect(err.body).toEqual({ message: 'Nope' });
    expect(err.url).toBe('/test');
    expect(err.message).toContain('404');
    expect(err.message).toContain('/test');
  });

  it('has convenience getters', () => {
    expect(new ApiClientError({ status: 401, body: null, url: '' }).isUnauthorized).toBe(true);
    expect(new ApiClientError({ status: 403, body: null, url: '' }).isForbidden).toBe(true);
    expect(new ApiClientError({ status: 404, body: null, url: '' }).isNotFound).toBe(true);
    expect(new ApiClientError({ status: 429, body: null, url: '' }).isRateLimited).toBe(true);
    expect(new ApiClientError({ status: 500, body: null, url: '' }).isServerError).toBe(true);
    expect(new ApiClientError({ status: 502, body: null, url: '' }).isServerError).toBe(true);
    expect(new ApiClientError({ status: 503, body: null, url: '' }).isServerError).toBe(true);
    expect(new ApiClientError({ status: 400, body: null, url: '' }).isServerError).toBe(false);
  });
});
