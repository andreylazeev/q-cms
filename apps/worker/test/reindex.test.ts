/**
 * Tests for the reindex worker.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import { processReindexJob } from '../src/workers/reindex.ts';
import type { ReindexJobData } from '../src/workers/reindex.ts';
import { __stubInternals, searchClient } from '../src/stubs/db.ts';
import type { Entry, EntryId, CollectionId, UserId } from '@q-cms/core';

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  const now = new Date().toISOString();
  return {
    id: 'e-1' as EntryId,
    collectionId: 'articles' as CollectionId,
    slug: 'hello',
    status: 'published',
    locale: 'en',
    isDefaultLocale: true,
    data: { title: 'Hello', excerpt: 'world', description: 'lorem' },
    publishedAt: now,
    scheduledPublishAt: null,
    scheduledUnpublishAt: null,
    createdBy: null as unknown as UserId,
    updatedBy: null as unknown as UserId,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeJob(data: ReindexJobData, id = 'job-1'): Job<ReindexJobData> {
  return { id, data } as unknown as Job<ReindexJobData>;
}

describe('reindex worker', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __stubInternals.reset();
    void searchClient.clear();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 202 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches the entry, flattens data, and indexes it', async () => {
    const entry = makeEntry();
    __stubInternals.putEntry(entry);
    await processReindexJob(makeJob({ collection: 'articles', entryId: entry.id, locale: 'en' }));
    const docs = await searchClient.list('articles');
    expect(docs).toHaveLength(1);
    const doc = docs[0] as { id: string; title?: string };
    expect(doc.id).toBe(`${entry.id}::en`);
    expect(doc.title).toBe('Hello');
  });

  it('skips a missing entry without erroring', async () => {
    await expect(
      processReindexJob(makeJob({ collection: 'articles', entryId: 'nope', locale: 'en' })),
    ).resolves.toBeUndefined();
    const docs = await searchClient.list('articles');
    expect(docs).toHaveLength(0);
  });

  it('rejects jobs missing required fields', async () => {
    await expect(
      processReindexJob(makeJob({ collection: '', entryId: 'x', locale: 'en' })),
    ).rejects.toThrow(/required/);
  });

  it('does not call Meilisearch when MEILI_URL is empty', async () => {
    const previous = process.env.MEILI_URL;
    delete process.env.MEILI_URL;
    try {
      const entry = makeEntry();
      __stubInternals.putEntry(entry);
      await processReindexJob(makeJob({ collection: 'articles', entryId: entry.id, locale: 'en' }));
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      if (previous !== undefined) process.env.MEILI_URL = previous;
    }
  });
});
