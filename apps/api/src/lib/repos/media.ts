/**
 * Media repository adapter.
 *
 * Wraps `@q-cms/db`'s `MediaRepository` and exposes the same flat
 * interface the route handlers expect.
 *
 * @module lib/repos/media
 */

import { MediaRepository } from '@q-cms/db';
import type { Media, MediaId, MediaVariant, Paginated } from '@q-cms/core';
import { getDb } from '../db.ts';

let cached: MediaRepository | undefined;

function repo(): MediaRepository {
  if (!cached) cached = new MediaRepository(getDb());
  return cached;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MediaRepo {
  list(page: { limit: number; cursor: string | null; withTotal: boolean }): Promise<Paginated<Media>>;
  findById(id: string): Promise<Media | null>;
  create(input: Record<string, unknown>): Promise<Media>;
  update(id: string, patch: Record<string, unknown>): Promise<Media>;
  delete(id: string): Promise<void>;
  listVariants(mediaId: string): Promise<readonly MediaVariant[]>;
}

export const mediaRepo: MediaRepo = {
  async list(page) {
    // Adapt cursor-based pagination to the page-based Paginated return shape.
    const cursorNum = page.cursor ? Number(page.cursor) : 1;
    const result = await repo().list({
      page: cursorNum,
      pageSize: page.limit,
    });
    // Preserve the existing Paginated shape — the route accesses .data and .page.nextCursor etc.
    return result;
  },

  async findById(id) {
    const result = await repo().findById(id as MediaId);
    return result.ok ? result.value : null;
  },

  async create(input: Record<string, unknown>) {
    return repo().create(input);
  },
  async update(id: string, patch: Record<string, unknown>) {
    return repo().update(id, patch);
  },

  async delete(id) {
    await repo().delete(id as MediaId);
  },

  async listVariants(_mediaId) {
    // TODO: The real MediaRepository doesn't expose a `listVariants` method
    // on the repo yet. When it does, call it here.
    return [];
  },
};
