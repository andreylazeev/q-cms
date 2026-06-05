/**
 * Media repository — CRUD plus variant management.
 *
 * Policy: see `./_shared.ts`. Reads return `Result`; writes throw on
 * irrecoverable errors and map unique violations to `ConflictError`.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { NotFoundError } from '@q-cms/core/errors';
import type { Result } from '@q-cms/core/result';
import { mediaId as brandMediaId, type MediaId, type UserId } from '@q-cms/core/branded';
import type { Media, MediaType, Paginated } from '@q-cms/core/types';

import type { DrizzleClient } from '../client.ts';
import {
  media,
  mediaVariants,
  type MediaRow,
  type MediaVariantRow,
} from '../schema/index.ts';
import { toDomainError, tryFind } from './_shared.ts';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Input for `MediaRepository.create`. */
export interface CreateMediaInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  storageKey: string;
  type: MediaType;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  altText?: string | null;
  caption?: string | null;
  folderId?: string | null;
  uploadedBy?: UserId | null;
  metadata?: Record<string, unknown>;
}

/** Input for `MediaRepository.update`. */
export interface UpdateMediaInput {
  filename?: string;
  altText?: string | null;
  caption?: string | null;
  folderId?: string | null;
  isProcessed?: boolean;
  virusScanned?: boolean;
  metadata?: Record<string, unknown>;
}

/** Input for `MediaRepository.list`. */
export interface ListMediaInput {
  type?: MediaType;
  folderId?: string;
  page?: number;
  pageSize?: number;
}

/** Input for `MediaRepository.addVariant`. */
export interface AddVariantInput {
  variantName: string;
  format: string;
  sizeBytes: number;
  storageKey: string;
  width?: number | null;
  height?: number | null;
}

// ---------------------------------------------------------------------------
// Row → Domain mapping
// ---------------------------------------------------------------------------

function mapMedia(row: MediaRow): Media {
  return {
    id: brandMediaId(row.id),
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    checksumSha256: row.checksumSha256,
    storageKey: row.storageKey,
    type: row.type,
    width: row.width,
    height: row.height,
    duration: row.duration !== null ? Number(row.duration) : null,
    altText: row.altText,
    caption: row.caption,
    focalPoint: parseFocalPoint(row.focalPoint),
    folderId: row.folderId,
    uploadedBy: (row.uploadedBy ?? null) as UserId | null,
    metadata: row.metadata as Record<string, unknown>,
    isProcessed: row.isProcessed === 'true',
    virusScanned: row.virusScanned === 'true',
    createdAt: row.createdAt.toISOString() as Media['createdAt'],
    updatedAt: row.updatedAt.toISOString() as Media['updatedAt'],
  };
}

/** Parse a `POINT` stored as `"x,y"` text into an `{x, y}` object. */
function parseFocalPoint(value: string | null): { x: number; y: number } | null {
  if (!value) return null;
  const parts = value.split(',');
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return { x, y };
}

function mapVariant(row: MediaVariantRow) {
  return {
    id: row.id,
    mediaId: brandMediaId(row.mediaId),
    variantName: row.variantName,
    width: row.width,
    height: row.height,
    format: row.format,
    sizeBytes: row.sizeBytes,
    storageKey: row.storageKey,
    createdAt: row.createdAt.toISOString() as string,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class MediaRepository {
  private readonly db: DrizzleClient;

  constructor(db: DrizzleClient) {
    this.db = db;
  }

  /** Find a media record by primary key. */
  async findById(id: MediaId): Promise<Result<Media, NotFoundError>> {
    return tryFind<Media>(async () => {
      const rows = await this.db
        .select()
        .from(media)
        .where(eq(media.id, id))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return mapMedia(row);
    }, 'Media');
  }

  /** List media with simple filters. */
  async list(input: ListMediaInput = {}): Promise<Paginated<Media>> {
    const conditions = [];
    if (input.type) conditions.push(eq(media.type, input.type));
    if (input.folderId) conditions.push(eq(media.folderId, input.folderId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const pageSize = input.pageSize ?? 20;
    const page = input.page ?? 1;
    const offset = (page - 1) * pageSize;

    const rows = await this.db
      .select()
      .from(media)
      .where(where)
      .orderBy(desc(media.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(media)
      .where(where);
    const total = totalRows[0]?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: rows.map(mapMedia),
      page: {
        nextCursor: page < totalPages ? String(page + 1) : null,
        prevCursor: page > 1 ? String(page - 1) : null,
        limit: pageSize,
        total,
      },
    };
  }

  /** Insert a new media record. */
  async create(input: CreateMediaInput): Promise<Media> {
    try {
      const [row] = await this.db
        .insert(media)
        .values({
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          checksumSha256: input.checksumSha256,
          storageKey: input.storageKey,
          type: input.type,
          width: input.width ?? null,
          height: input.height ?? null,
          duration: input.duration !== undefined && input.duration !== null
            ? String(input.duration)
            : null,
          altText: input.altText ?? null,
          caption: input.caption ?? null,
          folderId: input.folderId ?? null,
          uploadedBy: input.uploadedBy ?? null,
          metadata: input.metadata ?? {},
          isProcessed: 'false',
          virusScanned: 'false',
        })
        .returning();
      if (!row) throw new Error('insert returned no row');
      return mapMedia(row);
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Patch a media record; returns `NotFoundError` if missing. */
  async update(id: MediaId, patch: UpdateMediaInput): Promise<Media> {
    try {
      const updates: Partial<typeof media.$inferInsert> = {};
      if (patch.filename !== undefined) updates.filename = patch.filename;
      if (patch.altText !== undefined) updates.altText = patch.altText;
      if (patch.caption !== undefined) updates.caption = patch.caption;
      if (patch.folderId !== undefined) updates.folderId = patch.folderId;
      if (patch.isProcessed !== undefined)
        updates.isProcessed = patch.isProcessed ? 'true' : 'false';
      if (patch.virusScanned !== undefined)
        updates.virusScanned = patch.virusScanned ? 'true' : 'false';
      if (patch.metadata !== undefined) updates.metadata = patch.metadata;
      updates.updatedAt = new Date();

      const [row] = await this.db
        .update(media)
        .set(updates)
        .where(eq(media.id, id))
        .returning();
      if (!row) throw new NotFoundError('Media not found', { id });
      return mapMedia(row);
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Hard delete a media record (cascades to variants / tag assignments). */
  async delete(id: MediaId): Promise<void> {
    try {
      const result = await this.db
        .delete(media)
        .where(eq(media.id, id))
        .returning();
      if (result.length === 0) throw new NotFoundError('Media not found', { id });
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Add a new variant for a media record. */
  async addVariant(mediaIdValue: MediaId, input: AddVariantInput) {
    try {
      const [row] = await this.db
        .insert(mediaVariants)
        .values({
          mediaId: mediaIdValue,
          variantName: input.variantName,
          format: input.format,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
          width: input.width ?? null,
          height: input.height ?? null,
        })
        .returning();
      if (!row) throw new Error('insert returned no row');
      return mapVariant(row);
    } catch (cause) {
      throw toDomainError(cause);
    }
  }
}
