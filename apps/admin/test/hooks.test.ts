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
