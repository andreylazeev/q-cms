/**
 * Content tables: `collections`, `entries`, `entry_revisions`,
 * `entry_relations`, `entry_comments`.
 *
 * Mirrors DATA_MODEL.md §2.
 *
 * Notes on `entries`:
 * - `title` and `search_vector` are PostgreSQL GENERATED ALWAYS AS … STORED
 *   columns populated from `data->>'title'`, `data->>'excerpt'`, and
 *   `data->>'description'`. We model them as read-only Drizzle columns
 *   that always pull from the underlying SQL expression — the application
 *   layer treats them as derived.
 * - Status is a `pgEnum` matching `EntryStatus` in @q-cms/core.
 */

import {
  customType,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { users } from './auth.ts';

// ---------------------------------------------------------------------------
// Custom types
// ---------------------------------------------------------------------------

const jsonb = customType<{ data: unknown; driverData: unknown }>({
  dataType() {
    return 'jsonb';
  },
  toDriver(value: unknown): string {
    return JSON.stringify(value ?? null);
  },
  fromDriver(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') return value ? JSON.parse(value) : null;
    return value;
  },
});

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Matches `EntryStatus` in @q-cms/core/types. */
export const entryStatusEnum = pgEnum('entry_status', [
  'draft',
  'in_review',
  'approved',
  'published',
  'archived',
]);

// ---------------------------------------------------------------------------
// collections
// ---------------------------------------------------------------------------

export const collections = pgTable(
  'collections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    slug: text('slug').notNull().unique(),
    isSingleton: text('is_singleton').notNull().default('false'),
    draftAndPublish: text('draft_and_publish').notNull().default('true'),
    versioning: text('versioning').notNull().default('true'),
    schema: jsonb('schema').notNull().default({}),
    settings: jsonb('settings').notNull().default({}),
    displayName: text('display_name').notNull(),
    displayNameI18n: jsonb('display_name_i18n').notNull().default({}),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
);

export type CollectionRow = typeof collections.$inferSelect;
export type CollectionInsert = typeof collections.$inferInsert;

// ---------------------------------------------------------------------------
// entries
// ---------------------------------------------------------------------------

export const entries = pgTable(
  'entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    slug: text('slug'),
    status: entryStatusEnum('status').notNull().default('draft'),
    locale: text('locale').notNull(),
    isDefaultLocale: text('is_default_locale').notNull().default('false'),
    data: jsonb('data').notNull().default({}),
    /**
     * `title` is `GENERATED ALWAYS AS (data->>'title') STORED`.
     * We model it as a `text` column flagged `generatedAlwaysAs` so the
     * generator emits the DDL; INSERTs/updates must NOT supply a value.
     */
    title: text('title').generatedAlwaysAs(
      sql`(${sql.raw('data')} ->> 'title')`,
    ),
    /**
     * `search_vector` is `GENERATED ALWAYS AS (...) STORED` using TSVECTOR.
     * Drizzle's TSVECTOR support is not first-class in v0.36; we declare
     * the column as `customType` so the generated SQL uses the
     * `tsvector` data type. The `generatedAlwaysAs` expression uses
     * `setweight(to_tsvector(...))` with weights A/B/C for
     * `title` / `excerpt` / `description`.
     */
    searchVector: customType<{ data: string; driverData: string }>({
      dataType() {
        return 'tsvector';
      },
    })('search_vector').generatedAlwaysAs(
      sql`(
        setweight(to_tsvector('simple', coalesce(${sql.raw('data')} ->> 'title', '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(${sql.raw('data')} ->> 'excerpt', '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(${sql.raw('data')} ->> 'description', '')), 'C')
      )`,
    ),
    publishedAt: timestamptz('published_at'),
    scheduledPublishAt: timestamptz('scheduled_publish_at'),
    scheduledUnpublishAt: timestamptz('scheduled_unpublish_at'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    collectionSlugLocaleUq: uniqueIndex('uq_entries_collection_slug_locale').on(
      t.collectionId,
      t.locale,
      t.slug,
    ),
    collectionStatusIdx: index('idx_entries_collection_status').on(
      t.collectionId,
      t.status,
      t.publishedAt.desc(),
    ),
    publishedIdx: index('idx_entries_published')
      .on(t.collectionId, t.locale, t.publishedAt.desc())
      .where(sql`status = 'published'`),
    searchIdx: index('idx_entries_search').using('gin', t.searchVector),
    dataGinIdx: index('idx_entries_data_gin').using('gin', sql`${t.data} jsonb_path_ops`),
    localeIdx: index('idx_entries_locale').on(t.locale),
    createdByIdx: index('idx_entries_created_by').on(t.createdBy).where(sql`created_by IS NOT NULL`),
    scheduledIdx: index('idx_entries_scheduled')
      .on(t.scheduledPublishAt)
      .where(sql`scheduled_publish_at IS NOT NULL AND status = 'draft'`),
  }),
);

export type EntryRow = typeof entries.$inferSelect;
export type EntryInsert = typeof entries.$inferInsert;

// ---------------------------------------------------------------------------
// entry_revisions
// ---------------------------------------------------------------------------

export const entryRevisions = pgTable(
  'entry_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    status: entryStatusEnum('status').notNull(),
    data: jsonb('data').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    comment: text('comment'),
  },
  (t) => ({
    entryVersionUq: uniqueIndex('uq_revisions_entry_version').on(t.entryId, t.version),
    entryIdx: index('idx_revisions_entry').on(t.entryId, t.version.desc()),
  }),
);

export type EntryRevisionRow = typeof entryRevisions.$inferSelect;
export type EntryRevisionInsert = typeof entryRevisions.$inferInsert;

// ---------------------------------------------------------------------------
// entry_relations
// ---------------------------------------------------------------------------

export const entryRelations = pgTable(
  'entry_relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    field: text('field').notNull(),
    relationType: text('relation_type').notNull().default('direct'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => ({
    sourceTargetFieldUq: uniqueIndex('uq_relations_source_target_field').on(
      t.sourceId,
      t.targetId,
      t.field,
    ),
    sourceIdx: index('idx_relations_source').on(t.sourceId),
    targetIdx: index('idx_relations_target').on(t.targetId),
    fieldIdx: index('idx_relations_field').on(t.field),
  }),
);

export type EntryRelationRow = typeof entryRelations.$inferSelect;
export type EntryRelationInsert = typeof entryRelations.$inferInsert;

// ---------------------------------------------------------------------------
// entry_comments
// ---------------------------------------------------------------------------

export const entryComments = pgTable(
  'entry_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    blockId: text('block_id'),
    threadId: uuid('thread_id').references(
      (): AnyPgColumn => entryComments.id,
      { onDelete: 'cascade' },
    ),
    body: text('body').notNull(),
    resolvedAt: timestamptz('resolved_at'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => ({
    entryIdx: index('idx_comments_entry').on(t.entryId).where(sql`resolved_at IS NULL`),
  }),
);

export type EntryCommentRow = typeof entryComments.$inferSelect;
export type EntryCommentInsert = typeof entryComments.$inferInsert;
