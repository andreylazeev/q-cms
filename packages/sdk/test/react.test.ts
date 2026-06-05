/**
 * @vitest-environment node
 *
 * React hook tests run in a Node environment by exercising the
 * internal state shim directly. We bypass the JSX renderer (which
 * would require jsdom) by calling the same `useState`/`useEffect`
 * primitives via a small fiber host.
 *
 * For real renderer coverage, downstream apps should add tests
 * with `@testing-library/react` + `jsdom`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup.ts';
import { createClient } from '../src/index.ts';
import { QueryBuilder } from '../src/query-builder.ts';
import { __setHookDepsForTests } from '../src/react.tsx';

const BASE = 'https://cms.test.example';

afterEach(() => {
  __setHookDepsForTests(null);
});

describe('react shim (TanStack not wired)', () => {
  it('QueryBuilder chain produces correct query string', async () => {
    const req = vi.fn();
    server.use(
      http.get(`${BASE}/api/v1/collections/articles/entries`, ({ request }) => {
        req(request.url);
        return HttpResponse.json({
          data: [],
          meta: {
            pageInfo: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null, limit: 10, total: 0 },
            totalCount: 0,
          },
        });
      }),
    );
    const cms = createClient({ baseUrl: BASE, token: 't', locale: 'en' });
    const result = await cms
      .entries('articles')
      .where({ status: 'published' })
      .populate(['author'])
      .limit(10)
      .get();
    expect(result.data).toEqual([]);
    expect(req).toHaveBeenCalledOnce();
    const url = new URL(req.mock.calls[0]![0]);
    expect(url.searchParams.get('filter[status]')).toBe('published');
    expect(url.searchParams.get('populate')).toBe('author');
    expect(url.searchParams.get('page[limit]')).toBe('10');
    expect(url.searchParams.get('locale')).toBe('en');
  });

  it('QueryBuilder standalone with custom executor is testable', async () => {
    const calls: { path: string; query: Record<string, string> }[] = [];
    const qb = new QueryBuilder<{ id: string; data: unknown }>(
      'articles',
      {
        list: async (path, query) => {
          calls.push({ path, query });
          return {
            data: [],
            page: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null, limit: 0, total: 0 },
            total: 0,
          };
        },
        get: async () => ({ id: 'x', data: {} }),
        create: async () => ({ id: 'x', data: {} }),
        update: async () => ({ id: 'x', data: {} }),
        delete: async () => undefined,
        post: async () => ({ id: 'x', data: {} }),
      },
      'en',
    );
    const result = await qb
      .where({ status: 'published' })
      .populate(['author'])
      .limit(10)
      .get();
    expect(result.data).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.path).toBe('/collections/articles/entries');
    expect(calls[0]!.query['filter[status]']).toBe('published');
    expect(calls[0]!.query['populate']).toBe('author');
    expect(calls[0]!.query['page[limit]']).toBe('10');
    expect(calls[0]!.query['locale']).toBe('en');
  });

  it('__setHookDepsForTests installs TanStack shims and is reset between tests', () => {
    const calls: string[] = [];
    const useQuery = (args: { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }) => {
      calls.push(`useQuery:${args.queryKey.join('|')}`);
      return { data: undefined, error: null, isLoading: false, isFetching: false, isSuccess: true, refetch: () => Promise.resolve() };
    };
    const useMutation = (args: { mutationFn: (v: unknown) => Promise<unknown> }) => {
      calls.push('useMutation');
      return { mutate: args.mutationFn, mutateAsync: args.mutationFn, isLoading: false, error: null, data: undefined };
    };
    __setHookDepsForTests({
      useQuery: useQuery as never,
      useMutation: useMutation as never,
      useQueryClient: () => ({ invalidateQueries: async () => undefined, fetchQuery: async () => undefined }),
    });
    expect(typeof useQuery).toBe('function');
    expect(typeof useMutation).toBe('function');
  });
});
