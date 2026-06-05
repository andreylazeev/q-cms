/**
 * Tests for the scheduled-publish worker.
 *
 * Uses vi.mock for BullMQ and ioredis to avoid real Redis connections.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import type { ScheduledPublishJobData } from '../src/workers/scheduled-publish.ts';
import { __stubInternals, entryRepo } from '../src/stubs/db.ts';
import type { Entry, EntryId, CollectionId, UserId } from '@q-cms/core';

// Mock BullMQ and ioredis before any imports
vi.mock('bullmq', () => {
  const queueMock = {
    add: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };
  return {
    Queue: vi.fn().mockImplementation(() => queueMock),
    Worker: vi.fn(),
  };
});

vi.mock('ioredis', () => {
  const quit = vi.fn().mockResolvedValue('OK');
  return {
    default: vi.fn().mockImplementation(() => ({ quit })),
  };
});

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  const now = new Date().toISOString();
  return {
    id: ('e-' + Math.random().toString(16).slice(2, 6)) as EntryId,
    collectionId: 'c-1' as CollectionId,
    slug: null,
    status: 'draft',
    locale: 'en',
    isDefaultLocale: true,
    data: {},
    publishedAt: null,
    scheduledPublishAt: null,
    scheduledUnpublishAt: null,
    createdBy: null as unknown as UserId,
    updatedBy: null as unknown as UserId,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeJob(data: ScheduledPublishJobData, id = 'job-1'): Job<ScheduledPublishJobData> {
  return { id, data } as unknown as Job<ScheduledPublishJobData>;
}

describe('scheduled-publish worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __stubInternals.reset();
  });

  it('finds due entries and marks them published', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const due = makeEntry({ scheduledPublishAt: past });
    const future = makeEntry({ scheduledPublishAt: new Date(Date.now() + 60_000).toISOString() });
    const noSchedule = makeEntry();
    const alreadyPublished = makeEntry({ status: 'published', scheduledPublishAt: past, publishedAt: past });
    __stubInternals.putEntry(due);
    __stubInternals.putEntry(future);
    __stubInternals.putEntry(noSchedule);
    __stubInternals.putEntry(alreadyPublished);

    const { processScheduledPublishJob, resetReindexQueue } = await import('../src/workers/scheduled-publish.ts');
    resetReindexQueue();

    const result = await processScheduledPublishJob(makeJob({}));
    expect(result.published).toBe(1);
    expect(result.reindexEnqueued).toBe(1);

    const published = await entryRepo.findById(due.id);
    expect(published?.status).toBe('published');
    expect(published?.publishedAt).not.toBeNull();
  });

  it('respects the provided `now` override', async () => {
    const target = new Date('2026-06-05T12:00:00Z');
    const beforeTarget = new Date(target.getTime() - 60_000).toISOString();
    const afterTarget = new Date(target.getTime() + 60_000).toISOString();
    const due1 = makeEntry({ id: 'a' as EntryId, scheduledPublishAt: beforeTarget });
    const due2 = makeEntry({ id: 'b' as EntryId, scheduledPublishAt: afterTarget });
    __stubInternals.putEntry(due1);
    __stubInternals.putEntry(due2);

    const { processScheduledPublishJob, resetReindexQueue } = await import('../src/workers/scheduled-publish.ts');
    resetReindexQueue();

    const result = await processScheduledPublishJob(makeJob({ now: target.toISOString() }));
    expect(result.published).toBe(1);
  });

  it('handles an empty queue gracefully', async () => {
    const { processScheduledPublishJob, resetReindexQueue } = await import('../src/workers/scheduled-publish.ts');
    resetReindexQueue();

    const result = await processScheduledPublishJob(makeJob({}));
    expect(result.published).toBe(0);
    expect(result.reindexEnqueued).toBe(0);
  });
});
