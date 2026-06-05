/**
 * Entry repository adapter.
 *
 * Wraps `@q-cms/db`'s `EntryRepository` and maps its API to match the
 * flat interface the route handlers expect (null for "not found" instead
 * of `Result`, cursor-based pagination pass-through, etc.).
 *
 * @module lib/repos/entries
 */

import {
  EntryRepository,
  type CreateEntryInput,
  type ListEntriesInput,
  type UpdateEntryInput,
} from '@q-cms/db';
import type {
  CollectionId,
  Entry,
  EntryId,
  EntryRevision,
  EntryStatus,
  Locale,
  Paginated,
  Slug,
  UserId,
} from '@q-cms/core';
import { getDb } from '../db.ts';

let cached: EntryRepository | undefined;

function repo(): EntryRepository {
  if (!cached) cached = new EntryRepository(getDb());
  return cached;
}

// ---------------------------------------------------------------------------
// EntryRepo — matches the stub interface
// ---------------------------------------------------------------------------

export interface EntryRepo {
  list(query: {
    collectionId: string;
    /** Comma-separated statuses or a single status value. */
    status?: string;
    /** Comma-separated locales or a single locale value. */
    locale?: string;
    limit: number;
    cursor: string | null;
    withTotal: boolean;
  }): Promise<Paginated<Entry>>;
  findById(id: string): Promise<Entry | null>;
  findBySlug(collectionId: string, slug: string, locale: string): Promise<Entry | null>;
  create(input: Record<string, unknown>): Promise<Entry>;
  update(id: string, patch: Record<string, unknown>): Promise<Entry>;
  delete(id: string): Promise<void>;
  listRevisions(entryId: string): Promise<readonly EntryRevision[]>;
  saveRevision(revision: {
    entryId: string;
    version: number;
    status: EntryStatus;
    data: Record<string, unknown>;
    createdBy?: string | null;
    comment?: string | null;
  }): Promise<EntryRevision>;
  publish(id: string, by?: string | null): Promise<Entry>;
  unpublish(id: string, by?: string | null): Promise<Entry>;
}

export const entryRepo: EntryRepo = {
  async list({ collectionId, status, locale, limit, cursor, withTotal }) {
    const query: ListEntriesInput = {
      collectionId: collectionId as CollectionId,
      page: { limit, cursor, withTotal },
    };
    if (typeof status === 'string' && status.length > 0) {
      query.status = status as EntryStatus;
    }
    if (typeof locale === 'string' && locale.length > 0) {
      query.locale = locale as Locale;
    }
    return repo().list(query);
  },

  async findById(id) {
    const result = await repo().findById(id as EntryId);
    return result.ok ? result.value : null;
  },

  async findBySlug(collectionId, slug, locale) {
    // DB repo takes (collectionId, locale, slug) — note swapped order
    const result = await repo().findBySlug(
      collectionId as CollectionId,
      locale as Locale,
      slug as Slug,
    );
    return result.ok ? result.value : null;
  },

  async create(input) {
    return repo().create(input as unknown as CreateEntryInput);
  },

  async update(id, patch) {
    return repo().update(id as EntryId, patch as unknown as UpdateEntryInput);
  },

  async delete(id) {
    await repo().delete(id as EntryId);
  },

  async listRevisions(entryId) {
    const revisions = await repo().getRevisions(entryId as EntryId);
    return revisions.map((r) => ({
      id: r.id,
      entryId: entryId as EntryId,
      version: r.version,
      status: 'published' as EntryStatus,
      data: {},
      createdAt: r.createdAt.toISOString() as EntryRevision['createdAt'],
      createdBy: null,
      comment: null,
    }));
  },

  async saveRevision(rev) {
    const snapshot: Parameters<EntryRepository['addRevision']>[1] = {
      status: rev.status,
      data: rev.data,
      createdBy: (rev.createdBy ?? null) as UserId | null,
      comment: rev.comment ?? null,
    };
    const result = await repo().addRevision(rev.entryId as EntryId, snapshot);
    return {
      id: result.id,
      entryId: rev.entryId as EntryId,
      version: result.version,
      status: rev.status,
      data: rev.data,
      createdAt: new Date().toISOString() as EntryRevision['createdAt'],
      createdBy: (rev.createdBy ?? null) as UserId | null,
      comment: rev.comment ?? null,
    };
  },

  async publish(id, by) {
    return repo().publish(id as EntryId, by == null ? null : (by as UserId));
  },

  async unpublish(id, by) {
    return repo().unpublish(id as EntryId, by == null ? null : (by as UserId));
  },
};
