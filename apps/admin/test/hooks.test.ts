import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApiClient, resetApiClient } from '../src/lib/api-client';

/**
 * These tests exercise the api-client stub directly. They do not
 * mount React components — that requires `@testing-library/react`
 * which is intentionally not part of the admin app's dependency
 * tree in this scaffold. Hooks that wrap these calls are validated
 * via typecheck (they're thin TanStack Query wrappers).
 */

describe('api-client stub', () => {
  beforeEach(() => {
    resetApiClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a singleton client', () => {
    const a = getApiClient();
    const b = getApiClient();
    expect(a).toBe(b);
  });

  it('returns a paginated empty list for entries', async () => {
    const client = getApiClient();
    const res = await client.entries('Article').list();
    expect(res.data).toEqual([]);
    expect(res.meta.totalCount).toBe(0);
  });

  it('returns null for a missing entry', async () => {
    const client = getApiClient();
    const entry = await client.entries('Article').get('missing');
    expect(entry).toBeNull();
  });

  it('creates an entry with the supplied data', async () => {
    const client = getApiClient();
    const created = await client.entries('Article').create({ title: 'Hello' });
    expect(created.data).toEqual({ title: 'Hello' });
  });

  it('sends entry updates and publishes to the API', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/v1/collections/authors/entries/e_authors')) {
        return new Response(
          JSON.stringify({
            data: {
              id: 'e_authors',
              type: 'Entry',
              attributes: {
                id: 'e_authors',
                collectionId: 'authors',
                slug: 'sofia-volkova',
                status: 'published',
                locale: 'en',
                isDefaultLocale: true,
                data: { name: 'Sofia Edited' },
                publishedAt: null,
                scheduledPublishAt: null,
                scheduledUnpublishAt: null,
                createdBy: 'u_admin',
                updatedBy: 'u_admin',
                createdAt: '2026-04-01T09:00:00.000Z',
                updatedAt: '2026-06-05T11:00:00.000Z',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/v1/collections/authors/entries/e_authors/publish')) {
        return new Response(
          JSON.stringify({
            data: {
              id: 'e_authors',
              type: 'Entry',
              attributes: {
                id: 'e_authors',
                collectionId: 'authors',
                slug: 'sofia-volkova',
                status: 'published',
                locale: 'en',
                isDefaultLocale: true,
                data: { name: 'Sofia Edited' },
                publishedAt: '2026-06-05T11:00:00.000Z',
                scheduledPublishAt: null,
                scheduledUnpublishAt: null,
                createdBy: 'u_admin',
                updatedBy: 'u_admin',
                createdAt: '2026-04-01T09:00:00.000Z',
                updatedAt: '2026-06-05T11:00:00.000Z',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = getApiClient();
    await client.entries('authors').update('e_authors', { name: 'Sofia Edited' });
    await client.entries('authors').publish('e_authors');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/v1/collections/authors/entries/e_authors',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ data: { name: 'Sofia Edited' } }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/v1/collections/authors/entries/e_authors/publish',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('loads entries from the API so saved content survives reloads', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              id: 'e_authors',
              type: 'Entry',
              attributes: {
                id: 'e_authors',
                collectionId: 'authors',
                slug: 'sofia-volkova',
                status: 'published',
                locale: 'en',
                isDefaultLocale: true,
                data: { name: 'Sofia Volkova', content: 'Persisted paragraph' },
                publishedAt: '2026-06-05T11:00:00.000Z',
                scheduledPublishAt: null,
                scheduledUnpublishAt: null,
                createdBy: 'u_admin',
                updatedBy: 'u_admin',
                createdAt: '2026-04-01T09:00:00.000Z',
                updatedAt: '2026-06-05T11:00:00.000Z',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const entry = await getApiClient().entries('authors').get('e_authors');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/collections/authors/entries/e_authors',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }),
    );
    expect(entry?.data).toEqual({ name: 'Sofia Volkova', content: 'Persisted paragraph' });
  });

  it('lists demo collections and users (stub is pre-seeded)', async () => {
    const client = getApiClient();
    const collections = await client.collections.list();
    const users = await client.users.list();
    expect(Array.isArray(collections)).toBe(true);
    expect(collections.length).toBeGreaterThan(0);
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
  });

  it('logs the user in and stores the token', async () => {
    const client = getApiClient();
    const result = await client.auth.login({ email: 'a@b.c', password: 'pw' });
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
    client.setToken(result.token);
    expect(client.config.token).toBe(result.token);
  });
});
