/**
 * Media tables: `media`, `media_variants`, `media_folders`, `media_tags`,
 * `media_tag_assignments`.
 *
 * Mirrors DATA_MODEL.md §3.
 *
 * Notes:
 * - `media.focal_point` is a `POINT` — modeled as text and converted at the
 *   application layer to keep Drizzle portable.
 * - `media_folders.path` is `LTREE` — modeled as text for portability.
 */

import {
  bigint,
  customType,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { users } from './auth.ts';

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

export const mediaTypeEnum = pgEnum('media_type', [
  'image',
  'video',
  'audio',
  'document',
  'other',
]);

// ---------------------------------------------------------------------------
// media
// ---------------------------------------------------------------------------

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    checksumSha256: text('checksum_sha256').notNull(),
    storageKey: text('storage_key').notNull(),
    type: mediaTypeEnum('type').notNull(),
    width: integer('width'),
    height: integer('height'),
    duration: numeric('duration', { precision: 10, scale: 3 }),
    altText: text('alt_text'),
    caption: text('caption'),
    /** `POINT` modeled as `text` ("x,y") — application-layer parsing. */
    focalPoint: text('focal_point'),
    folderId: uuid('folder_id'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').notNull().default({}),
    isProcessed: text('is_processed').notNull().default('false'),
    virusScanned: text('virus_scanned').notNull().default('false'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    typeIdx: index('idx_media_type').on(t.type, t.createdAt.desc()),
    checksumIdx: index('idx_media_checksum').on(t.checksumSha256),
    folderIdx: index('idx_media_folder').on(t.folderId),
    uploaderIdx: index('idx_media_uploader').on(t.uploadedBy),
  }),
);

export type MediaRow = typeof media.$inferSelect;
export type MediaInsert = typeof media.$inferInsert;
// Re-export `$inferSelect`/`$inferInsert` aliases consumed by repositories.

// ---------------------------------------------------------------------------
// media_variants
// ---------------------------------------------------------------------------

export const mediaVariants = pgTable(
  'media_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    variantName: text('variant_name').notNull(),
    width: integer('width'),
    height: integer('height'),
    format: text('format').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storageKey: text('storage_key').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => ({
    mediaNameFormatUq: uniqueIndex('uq_variants_media_name_format').on(
      t.mediaId,
      t.variantName,
      t.format,
    ),
    mediaIdx: index('idx_variants_media').on(t.mediaId),
  }),
);

export type MediaVariantRow = typeof mediaVariants.$inferSelect;
export type MediaVariantInsert = typeof mediaVariants.$inferInsert;

// ---------------------------------------------------------------------------
// media_folders
// ---------------------------------------------------------------------------

export const mediaFolders = pgTable(
  'media_folders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    parentId: uuid('parent_id'),
    /** `LTREE` path modeled as text; GIST index is added via raw SQL. */
    path: text('path').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => ({
    pathIdx: index('idx_folders_path').on(t.path),
  }),
);

export type MediaFolderRow = typeof mediaFolders.$inferSelect;
export type MediaFolderInsert = typeof mediaFolders.$inferInsert;

// ---------------------------------------------------------------------------
// media_tags
// ---------------------------------------------------------------------------

export const mediaTags = pgTable(
  'media_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    slug: text('slug').notNull().unique(),
  },
);

export type MediaTagRow = typeof mediaTags.$inferSelect;
export type MediaTagInsert = typeof mediaTags.$inferInsert;

// ---------------------------------------------------------------------------
// media_tag_assignments
// ---------------------------------------------------------------------------

export const mediaTagAssignments = pgTable(
  'media_tag_assignments',
  {
    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => mediaTags.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.mediaId, t.tagId] }),
  }),
);

export type MediaTagAssignmentRow = typeof mediaTagAssignments.$inferSelect;
export type MediaTagAssignmentInsert = typeof mediaTagAssignments.$inferInsert;
