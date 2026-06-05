/**
 * Collection repository — queries the `collections` table directly.
 *
 * TODO: Replace with a dedicated `CollectionRepository` in `@q-cms/db`
 * once one exists so this module only adapts, not queries.
 *
 * @module lib/repos/collections
 */

import { eq } from 'drizzle-orm';
import { schema } from '@q-cms/db';
import { collectionId, type CollectionId } from '@q-cms/core/branded';
import type { Collection, Iso8601, Json } from '@q-cms/core';
import { getDb } from '../db.ts';

const { collections: collectionsTable } = schema;

// ---------------------------------------------------------------------------
// Row → Domain
// ---------------------------------------------------------------------------

interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  isSingleton: boolean;
  draftAndPublish: boolean;
  versioning: boolean;
  schema: Json;
  settings: Json;
  displayName: string;
  displayNameI18n: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

function mapCollection(row: CollectionRow): Collection {
  return {
    id: collectionId(row.id),
    name: row.name,
    slug: row.slug,
    isSingleton: row.isSingleton,
    draftAndPublish: row.draftAndPublish,
    versioning: row.versioning,
    schema: row.schema,
    settings: row.settings,
    displayName: row.displayName,
    displayNameI18n: row.displayNameI18n,
    createdAt: row.createdAt.toISOString() as Iso8601,
    updatedAt: row.updatedAt.toISOString() as Iso8601,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CollectionRepo {
  list(): Promise<readonly Collection[]>;
  findBySlug(slug: string): Promise<Collection | null>;
  findById(id: string): Promise<Collection | null>;
}

export const collectionRepo: CollectionRepo = {
  async list() {
    const db = getDb();
    const rows = await db.select().from(collectionsTable).orderBy(collectionsTable.name);
    return rows.map((r) => mapCollection(r as never));
  },

  async findBySlug(slug) {
    const db = getDb();
    const rows = await db
      .select()
      .from(collectionsTable)
      .where(eq(collectionsTable.slug, slug))
      .limit(1);
    return rows.length > 0 ? mapCollection(rows[0] as never) : null;
  },

  async findById(id) {
    const db = getDb();
    const rows = await db
      .select()
      .from(collectionsTable)
      .where(eq(collectionsTable.id, id as CollectionId))
      .limit(1);
    return rows.length > 0 ? mapCollection(rows[0] as never) : null;
  },
};
