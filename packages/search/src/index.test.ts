import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Meilisearch as MeiliSearchType } from 'meilisearch';
import {
  createClient,
  MeilisearchClient,
  SearchError,
  type SearchConfig,
  type SearchOptions,
  type SearchResult,
  type IndexSettings,
  type SearchStats,
} from './index.ts';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockIndex = {
  search: vi.fn(),
  addDocuments: vi.fn(),
  deleteDocument: vi.fn(),
  deleteDocuments: vi.fn(),
  updateSettings: vi.fn(),
};

const mockClient = {
  index: vi.fn(() => mockIndex),
  getStats: vi.fn(),
};

vi.mock('meilisearch', () => ({
  Meilisearch: vi.fn(function (this: typeof mockClient) {
    return mockClient;
  }),
}));

const { Meilisearch } = vi.mocked(
  await import('meilisearch'),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSearchResponse<T>(
  overrides: Partial<{
    hits: T[];
    estimatedTotalHits: number;
    processingTimeMs: number;
    query: string;
    limit: number;
    offset: number;
    facetDistribution: Record<string, Record<string, number>>;
  }>,
): {
  hits: T[];
  estimatedTotalHits: number;
  processingTimeMs: number;
  query: string;
  limit: number;
  offset: number;
  facetDistribution?: Record<string, Record<string, number>>;
} {
  return {
    hits: [],
    estimatedTotalHits: 0,
    processingTimeMs: 1,
    query: '',
    limit: 20,
    offset: 0,
    ...overrides,
  };
}

function mockEnqueuedTask() {
  return { waitTask: vi.fn().mockResolvedValue({ status: 'succeeded' }) };
}

interface TestDoc {
  id: string;
  title: string;
  status: string;
  createdAt: number;
}

const sampleDoc: TestDoc = {
  id: 'doc-1',
  title: 'Hello World',
  status: 'published',
  createdAt: 1717000000000,
};

const sampleDocs: TestDoc[] = [
  sampleDoc,
  { id: 'doc-2', title: 'Second Post', status: 'draft', createdAt: 1717000001000 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createClient', () => {
  it('creates a MeilisearchClient instance with host', () => {
    const client = createClient({ host: 'http://127.0.0.1:7700' });
    expect(client).toBeInstanceOf(MeilisearchClient);
    expect(Meilisearch).toHaveBeenCalledWith({
      host: 'http://127.0.0.1:7700',
      apiKey: undefined,
      timeout: undefined,
    });
  });

  it('passes apiKey to Meilisearch constructor', () => {
    createClient({ host: 'http://127.0.0.1:7700', apiKey: 'secret' });
    expect(Meilisearch).toHaveBeenCalledWith({
      host: 'http://127.0.0.1:7700',
      apiKey: 'secret',
      timeout: undefined,
    });
  });

  it('passes timeout to Meilisearch constructor', () => {
    createClient({ host: 'http://127.0.0.1:7700', timeout: 5000 });
    expect(Meilisearch).toHaveBeenCalledWith({
      host: 'http://127.0.0.1:7700',
      apiKey: undefined,
      timeout: 5000,
    });
  });
});

describe('MeilisearchClient.indexDocument', () => {
  it('adds a single document and waits for indexing', async () => {
    const task = mockEnqueuedTask();
    mockIndex.addDocuments.mockResolvedValueOnce(task);
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    await client.indexDocument('entries', sampleDoc);

    expect(mockClient.index).toHaveBeenCalledWith('entries');
    expect(mockIndex.addDocuments).toHaveBeenCalledWith([sampleDoc]);
    expect(task.waitTask).toHaveBeenCalledOnce();
  });

  it('wraps connection errors as SearchError', async () => {
    mockIndex.addDocuments.mockRejectedValueOnce(new Error('Connection refused'));
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    await expect(
      client.indexDocument('entries', sampleDoc),
    ).rejects.toThrow(SearchError);

    await expect(
      client.indexDocument('entries', sampleDoc),
    ).rejects.toThrow('Failed to index document into "entries"');
  });

  it('preserves original error details in meta', async () => {
    mockIndex.addDocuments.mockRejectedValueOnce(new Error('Boom'));
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    let caught: unknown;
    try {
      await client.indexDocument('entries', sampleDoc);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(SearchError);
    expect((caught as SearchError).meta).toMatchObject({
      originalMessage: 'Boom',
    });
  });
});

describe('MeilisearchClient.indexDocuments', () => {
  it('adds multiple documents and waits for indexing', async () => {
    const task = mockEnqueuedTask();
    mockIndex.addDocuments.mockResolvedValueOnce(task);
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    await client.indexDocuments('entries', sampleDocs);

    expect(mockIndex.addDocuments).toHaveBeenCalledWith(sampleDocs);
    expect(task.waitTask).toHaveBeenCalledOnce();
  });

  it('no-ops on empty array', async () => {
    const client = createClient({ host: 'http://127.0.0.1:7700' });
    await client.indexDocuments('entries', []);
    expect(mockIndex.addDocuments).not.toHaveBeenCalled();
  });

  it('wraps errors as SearchError', async () => {
    mockIndex.addDocuments.mockRejectedValueOnce(new Error('Timeout'));
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    await expect(
      client.indexDocuments('entries', sampleDocs),
    ).rejects.toThrow(SearchError);
  });
});

describe('MeilisearchClient.deleteDocument', () => {
  it('deletes a single document by id and waits', async () => {
    const task = mockEnqueuedTask();
    mockIndex.deleteDocument.mockResolvedValueOnce(task);
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    await client.deleteDocument('entries', 'doc-1');

    expect(mockIndex.deleteDocument).toHaveBeenCalledWith('doc-1');
    expect(task.waitTask).toHaveBeenCalledOnce();
  });

  it('handles numeric ids', async () => {
    const task = mockEnqueuedTask();
    mockIndex.deleteDocument.mockResolvedValueOnce(task);
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    await client.deleteDocument('entries', 42);

    expect(mockIndex.deleteDocument).toHaveBeenCalledWith(42);
  });

  it('wraps errors as SearchError', async () => {
    mockIndex.deleteDocument.mockRejectedValueOnce(new Error('Not found'));
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });

    await expect(
      client.deleteDocument('entries', 'doc-1'),
    ).rejects.toThrow(SearchError);
  });
});

describe('MeilisearchClient.deleteDocuments', () => {
  it('deletes multiple documents in batch and waits', async () => {
    const task = mockEnqueuedTask();
    mockIndex.deleteDocuments.mockResolvedValueOnce(task);
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    await client.deleteDocuments('entries', ['doc-1', 'doc-2']);

    expect(mockIndex.deleteDocuments).toHaveBeenCalledWith(['doc-1', 'doc-2']);
    expect(task.waitTask).toHaveBeenCalledOnce();
  });

  it('no-ops on empty array', async () => {
    const client = createClient({ host: 'http://127.0.0.1:7700' });
    await client.deleteDocuments('entries', []);
    expect(mockIndex.deleteDocuments).not.toHaveBeenCalled();
  });

  it('wraps errors as SearchError', async () => {
    mockIndex.deleteDocuments.mockRejectedValueOnce(new Error('Bulk error'));
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    await expect(
      client.deleteDocuments('entries', ['doc-1']),
    ).rejects.toThrow(SearchError);
  });
});

describe('MeilisearchClient.search', () => {
  it('returns typed search results', async () => {
    const hits: TestDoc[] = [sampleDoc];
    mockIndex.search.mockResolvedValueOnce(
      mockSearchResponse({ hits, estimatedTotalHits: 1, query: 'hello' }),
    );
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    const result = await client.search<TestDoc>('entries', 'hello');

    const typed: SearchResult<TestDoc> = result;
    expect(typed.hits).toEqual(hits);
    expect(typed.hits[0]!.title).toBe('Hello World');
    expect(typed.totalHits).toBe(1);
    expect(typed.query).toBe('hello');
    expect(typed.processingTimeMs).toBe(1);
    expect(typed.offset).toBe(0);
    expect(typed.limit).toBe(20);
  });

  it('passes filters and sort options', async () => {
    mockIndex.search.mockResolvedValueOnce(mockSearchResponse({}));
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    const options: SearchOptions = {
      filter: "status = 'published'",
      sort: ['createdAt:desc'],
      facets: ['status'],
      limit: 10,
      offset: 20,
    };

    await client.search<TestDoc>('entries', '', options);

    expect(mockIndex.search).toHaveBeenCalledWith('', {
      filter: options.filter,
      sort: options.sort,
      facets: options.facets,
      limit: options.limit,
      offset: options.offset,
    });
  });

  it('passes page-based pagination', async () => {
    mockIndex.search.mockResolvedValueOnce({
      ...mockSearchResponse({}),
      page: 2,
      hitsPerPage: 5,
      totalPages: 4,
      totalHits: 20,
    });
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    const result = await client.search<TestDoc>('entries', 'test', {
      hitsPerPage: 5,
      page: 2,
    });

    expect(mockIndex.search).toHaveBeenCalledWith('test', {
      hitsPerPage: 5,
      page: 2,
    });
    expect(result.totalHits).toBe(20);
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(4);
  });

  it('includes facetDistribution when requested', async () => {
    const facetDist = { status: { published: 5, draft: 2 } };
    mockIndex.search.mockResolvedValueOnce(
      mockSearchResponse({ facetDistribution: facetDist }),
    );
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    const result = await client.search<TestDoc>('entries', '', {
      facets: ['status'],
    });

    expect(result.facetDistribution).toEqual(facetDist);
  });

  it('omits undefined options from search params', async () => {
    mockIndex.search.mockResolvedValueOnce(mockSearchResponse({}));
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    await client.search<TestDoc>('entries', 'test', { limit: 10 });

    const callArgs = mockIndex.search.mock.calls[0]![1] as Record<string, unknown>;
    expect(callArgs).toHaveProperty('limit', 10);
    expect(callArgs).not.toHaveProperty('filter');
    expect(callArgs).not.toHaveProperty('sort');
    expect(callArgs).not.toHaveProperty('facets');
  });

  it('works without options', async () => {
    mockIndex.search.mockResolvedValueOnce(mockSearchResponse({}));
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    await client.search<TestDoc>('entries', 'test');

    expect(mockIndex.search).toHaveBeenCalledWith('test', undefined);
  });

  it('falls back to estimatedTotalHits when totalHits is absent', async () => {
    mockIndex.search.mockResolvedValueOnce(
      mockSearchResponse({ hits: [sampleDoc], estimatedTotalHits: 42 }),
    );
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    const result = await client.search<TestDoc>('entries', '');

    expect(result.totalHits).toBe(42);
  });

  it('falls back to hits.length when both totalHits and estimatedTotalHits are absent', async () => {
    mockIndex.search.mockResolvedValueOnce({
      hits: [sampleDoc, sampleDocs[1]!],
      processingTimeMs: 1,
      query: '',
      limit: 20,
      offset: 0,
    });
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    const result = await client.search<TestDoc>('entries', '');

    expect(result.totalHits).toBe(2);
  });

  it('wraps errors as SearchError', async () => {
    mockIndex.search.mockRejectedValueOnce(new Error('Index not found'));
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });

    await expect(client.search('entries', 'test')).rejects.toThrow(SearchError);
    await expect(client.search('entries', 'test')).rejects.toThrow(
      'Search failed for index "entries"',
    );
  });
});

describe('MeilisearchClient.configureIndex', () => {
  it('updates settings and waits', async () => {
    const task = mockEnqueuedTask();
    mockIndex.updateSettings.mockResolvedValueOnce(task);
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    const settings: IndexSettings = {
      searchableAttributes: ['title', 'body'],
      filterableAttributes: ['status', 'collectionId'],
      sortableAttributes: ['createdAt', 'updatedAt'],
      rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
    };

    await client.configureIndex('entries', settings);

    expect(mockIndex.updateSettings).toHaveBeenCalledWith(settings);
    expect(task.waitTask).toHaveBeenCalledOnce();
  });

  it('wraps errors as SearchError', async () => {
    mockIndex.updateSettings.mockRejectedValueOnce(new Error('Forbidden'));
    mockClient.index.mockReturnValue(mockIndex);

    const client = createClient({ host: 'http://127.0.0.1:7700' });

    await expect(
      client.configureIndex('entries', {}),
    ).rejects.toThrow(SearchError);
  });
});

describe('MeilisearchClient.getStats', () => {
  it('returns instance-wide stats', async () => {
    const stats: SearchStats = {
      databaseSize: 123456,
      lastUpdate: '2026-06-05T12:00:00Z',
      indexes: {
        entries: {
          numberOfDocuments: 42,
          isIndexing: false,
          fieldDistribution: { id: 42, title: 42 },
        },
      },
    };
    mockClient.getStats.mockResolvedValueOnce(stats);

    const client = createClient({ host: 'http://127.0.0.1:7700' });
    const result = await client.getStats();

    expect(mockClient.getStats).toHaveBeenCalledOnce();
    expect(result).toEqual(stats);
    expect(result.indexes['entries']!.numberOfDocuments).toBe(42);
  });

  it('wraps errors as SearchError', async () => {
    mockClient.getStats.mockRejectedValueOnce(new Error('Down'));

    const client = createClient({ host: 'http://127.0.0.1:7700' });

    const statsPromise = client.getStats();
    await expect(statsPromise).rejects.toThrow(SearchError);
    await expect(statsPromise).rejects.toThrow(
      'Failed to retrieve search stats',
    );
  });
});

describe('SearchError', () => {
  it('extends DomainError with SEARCH_ERROR code', () => {
    const err = new SearchError('Test error');
    expect(err.code).toBe('SEARCH_ERROR');
    expect(err.httpStatus).toBe(502);
    expect(err.message).toBe('Test error');
  });
});

describe('Re-exports', () => {
  it('exports createClient as a function', () => {
    expect(typeof createClient).toBe('function');
  });

  it('exports MeilisearchClient as a class', () => {
    expect(typeof MeilisearchClient).toBe('function');
  });
});
