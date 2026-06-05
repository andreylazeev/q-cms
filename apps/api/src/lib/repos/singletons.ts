/**
 * Singleton repository — singletons are just entries in singleton
 * collections, so this delegates to `EntryRepository`.
 *
 * @module lib/repos/singletons
 */

import { EntryRepository } from '@q-cms/db';
import type { Entry, EntryId, EntryStatus, UserId } from '@q-cms/core';
import { getDb } from '../db.ts';

let cached: EntryRepository | undefined;

function repo(): EntryRepository {
  if (!cached) cached = new EntryRepository(getDb());
  return cached;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SingletonRepo {
  find(collectionId: string, locale: string): Promise<Entry | null>;
  upsert(entry: {
    collectionId: string;
    slug: string | null;
    status: EntryStatus;
    locale: Entry['locale'];
    isDefaultLocale: boolean;
    data: Record<string, unknown>;
    publishedAt: string | null;
    scheduledPublishAt: string | null;
    scheduledUnpublishAt: string | null;
    createdBy: UserId | null;
    updatedBy: UserId | null;
    id?: string;
  }): Promise<Entry>;
}

export const singletonRepo: SingletonRepo = {
  async find(collectionId, locale) {
    // List entries for the collection filtered by locale, take the first.
    const result = await repo().list({
      collectionId: collectionId as Entry['collectionId'],
      locale: locale as Entry['locale'],
      page: { limit: 1, cursor: null, withTotal: false },
    });
    return result.data.length > 0 ? result.data[0] : null;
  },

  async upsert(input) {
    // Check if a singleton already exists for this collection+locale pair.
    const existing = await singletonRepo.find(input.collectionId, input.locale);
    if (existing) {
      return repo().update(existing.id as EntryId, {
        data: input.data,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        updatedBy: input.updatedBy,
      });
    }
    return repo().create({
      collectionId: input.collectionId as Entry['collectionId'],
      slug: input.slug as Entry['slug'],
      status: input.status,
      locale: input.locale,
      isDefaultLocale: input.isDefaultLocale,
      data: input.data,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
      scheduledPublishAt: input.scheduledPublishAt ? new Date(input.scheduledPublishAt) : null,
      scheduledUnpublishAt: input.scheduledUnpublishAt ? new Date(input.scheduledUnpublishAt) : null,
      createdBy: input.createdBy,
      updatedBy: input.updatedBy,
    });
  },
};
