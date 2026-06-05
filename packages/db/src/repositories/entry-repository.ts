/**
 * Entry repository — CRUD + publish/unpublish + revisions.
 */

import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import {
  NotFoundError,
  ValidationError,
} from '@q-cms/core/errors';
import type { Result } from '@q-cms/core/result';
import {
  collectionId as brandCollectionId,
  entryId as brandEntryId,
  locale as brandLocale,
  slug as brandSlug,
  type CollectionId,
  type EntryId,
  type Locale,
  type UserId,
  type Slug,
} from '@q-cms/core/branded';
import type {
  Entry,
  EntryStatus,
  Filter,
  Paginated,
  PageInput,
  Sort,
} from '@q-cms/core/types';

import type { DrizzleClient } from '../client.ts';
import { entries, entryRevisions } from '../schema/index.ts';
import { toDomainError, tryFind } from './_shared.ts';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateEntryInput {
  collectionId: CollectionId;
  slug?: Slug | null;
  status?: EntryStatus;
  locale: Locale;
  isDefaultLocale?: boolean;
  data: Record<string, unknown>;
  publishedAt?: Date | null;
  scheduledPublishAt?: Date | null;
  scheduledUnpublishAt?: Date | null;
  createdBy?: UserId | null;
  updatedBy?: UserId | null;
}

export interface UpdateEntryInput {
  slug?: Slug | null;
  status?: EntryStatus;
  isDefaultLocale?: boolean;
  data?: Record<string, unknown>;
  publishedAt?: Date | null;
  scheduledPublishAt?: Date | null;
  scheduledUnpublishAt?: Date | null;
  updatedBy?: UserId | null;
}

export interface ListEntriesInput {
  collectionId?: CollectionId;
  status?: EntryStatus;
  locale?: Locale;
  filter?: readonly Filter[];
  sort?: readonly Sort[];
  page?: PageInput;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

interface EntryRow {
  id: string;
  collectionId: string;
  slug: string | null;
  status: EntryStatus;
  locale: string;
  isDefaultLocale: string;
  data: unknown;
  publishedAt: Date | null;
  scheduledPublishAt: Date | null;
  scheduledUnpublishAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapEntry(row: EntryRow): Entry {
  return {
    id: brandEntryId(row.id),
    collectionId: brandCollectionId(row.collectionId),
    slug: row.slug ? brandSlug(row.slug) : null,
    status: row.status,
    locale: brandLocale(row.locale),
    isDefaultLocale: row.isDefaultLocale === 'true',
    data: row.data,
    publishedAt: row.publishedAt
      ? (row.publishedAt.toISOString() as Entry['publishedAt'])
      : null,
    scheduledPublishAt: row.scheduledPublishAt
      ? (row.scheduledPublishAt.toISOString() as Entry['scheduledPublishAt'])
      : null,
    scheduledUnpublishAt: row.scheduledUnpublishAt
      ? (row.scheduledUnpublishAt.toISOString() as Entry['scheduledUnpublishAt'])
      : null,
    createdBy: row.createdBy ? (row.createdBy as UserId) : null,
    updatedBy: row.updatedBy ? (row.updatedBy as UserId) : null,
    createdAt: row.createdAt.toISOString() as Entry['createdAt'],
    updatedAt: row.updatedAt.toISOString() as Entry['updatedAt'],
  };
}

// ---------------------------------------------------------------------------
// Filter / sort translation
// ---------------------------------------------------------------------------

const FILTER_OPERATORS = new Set([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'nin',
  'contains',
  'startsWith',
  'endsWith',
  'isNull',
  'isNotNull',
]);

/**
 * Build a `WHERE` clause from a list of {@link Filter} objects. Only
 * known columns and operators are accepted; anything else surfaces as a
 * `ValidationError` so callers don't silently filter on nothing.
 */
function buildWhere(filters: readonly Filter[] | undefined): SQL | undefined {
  if (!filters || filters.length === 0) return undefined;
  const clauses: SQL[] = [];
  for (const f of filters) {
    if (!FILTER_OPERATORS.has(f.op)) {
      throw new ValidationError(`Unsupported filter operator: ${f.op}`, { op: f.op });
    }
    const col = sql`${sql.raw(f.field)}`;
    switch (f.op) {
      case 'eq':
        clauses.push(sql`${col} = ${f.value ?? null}`);
        break;
      case 'neq':
        clauses.push(sql`${col} <> ${f.value ?? null}`);
        break;
      case 'gt':
        clauses.push(sql`${col} > ${f.value ?? null}`);
        break;
      case 'gte':
        clauses.push(sql`${col} >= ${f.value ?? null}`);
        break;
      case 'lt':
        clauses.push(sql`${col} < ${f.value ?? null}`);
        break;
      case 'lte':
        clauses.push(sql`${col} <= ${f.value ?? null}`);
        break;
      case 'in':
        clauses.push(sql`${col} = ANY(${f.value ?? []})`);
        break;
      case 'nin':
        clauses.push(sql`${col} <> ALL(${f.value ?? []})`);
        break;
      case 'contains':
        clauses.push(sql`${col}::text ILIKE ${`%${String(f.value ?? '')}%`}`);
        break;
      case 'startsWith':
        clauses.push(sql`${col}::text LIKE ${`${String(f.value ?? '')}%`}`);
        break;
      case 'endsWith':
        clauses.push(sql`${col}::text LIKE ${`%${String(f.value ?? '')}`}`);
        break;
      case 'isNull':
        clauses.push(sql`${col} IS NULL`);
        break;
      case 'isNotNull':
        clauses.push(sql`${col} IS NOT NULL`);
        break;
    }
  }
  return and(...clauses);
}

function buildOrder(sort: readonly Sort[] | undefined): SQL | undefined {
  if (!sort || sort.length === 0) {
    return desc(entries.createdAt);
  }
  const clauses = sort.map((s) => {
    const col = sql`${sql.raw(s.field)}`;
    return s.direction === 'asc' ? sql`${col} ASC` : sql`${col} DESC`;
  });
  return clauses.length === 1 ? clauses[0] : sql.join(clauses, sql`, `);
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_LIMIT = 20;

export class EntryRepository {
  private readonly db: DrizzleClient;

  constructor(db: DrizzleClient) {
    this.db = db;
  }

  async findById(id: EntryId): Promise<Result<Entry, NotFoundError>> {
    return tryFind<Entry>(async () => {
      const rows = await this.db
        .select()
        .from(entries)
        .where(eq(entries.id, id))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return mapEntry(row as EntryRow);
    }, 'Entry');
  }

  async findBySlug(
    collectionIdValue: CollectionId,
    localeValue: Locale,
    slugValue: Slug,
  ): Promise<Result<Entry, NotFoundError>> {
    return tryFind<Entry>(async () => {
      const rows = await this.db
        .select()
        .from(entries)
        .where(
          and(
            eq(entries.collectionId, collectionIdValue),
            eq(entries.locale, localeValue),
            eq(entries.slug, slugValue),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return mapEntry(row as EntryRow);
    }, 'Entry');
  }

  async list(input: ListEntriesInput): Promise<Paginated<Entry>> {
    try {
      const limit = Math.min(Math.max(input.page?.limit ?? DEFAULT_PAGE_LIMIT, 1), 100);
      const offset = input.page?.cursor ? Number(input.page.cursor) : 0;

      const whereParts: SQL[] = [];
      if (input.collectionId) {
        whereParts.push(eq(entries.collectionId, input.collectionId));
      }
      if (input.status) {
        whereParts.push(eq(entries.status, input.status));
      }
      if (input.locale) {
        whereParts.push(eq(entries.locale, input.locale));
      }
      const filterClause = buildWhere(input.filter);
      if (filterClause) whereParts.push(filterClause);

      const whereExpr = whereParts.length === 0
        ? undefined
        : whereParts.length === 1
          ? whereParts[0]
          : and(...whereParts);

      const orderExpr = buildOrder(input.sort) ?? desc(entries.createdAt);

      const baseQuery = this.db
        .select()
        .from(entries)
        .where(whereExpr as SQL | undefined)
        .orderBy(orderExpr as any)
        .limit(limit)
        .offset(offset);

      const rows = await baseQuery;

      let total: number | null = null;
      if (input.page?.withTotal) {
        const countResult = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(entries)
          .where(whereExpr as SQL | undefined);
        total = countResult[0]?.count ?? 0;
      }

      const nextOffset = rows.length === limit ? String(offset + limit) : null;

      return {
        data: rows.map((r) => mapEntry(r as EntryRow)),
        page: {
          nextCursor: nextOffset,
          prevCursor: offset > 0 ? String(Math.max(0, offset - limit)) : null,
          limit,
          total,
        },
      };
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  async create(input: CreateEntryInput): Promise<Entry> {
    try {
      const [row] = await this.db
        .insert(entries)
        .values({
          collectionId: input.collectionId,
          slug: input.slug ?? null,
          status: input.status ?? 'draft',
          locale: input.locale,
          isDefaultLocale: input.isDefaultLocale ? 'true' : 'false',
          data: input.data as unknown as object,
          publishedAt: input.publishedAt ?? null,
          scheduledPublishAt: input.scheduledPublishAt ?? null,
          scheduledUnpublishAt: input.scheduledUnpublishAt ?? null,
          createdBy: input.createdBy ?? null,
          updatedBy: input.updatedBy ?? null,
        })
        .returning();
      if (!row) throw new Error('insert returned no row');
      return mapEntry(row as EntryRow);
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  async update(id: EntryId, patch: UpdateEntryInput): Promise<Entry> {
    try {
      const updates: Partial<typeof entries.$inferInsert> = {};
      if (patch.slug !== undefined) updates.slug = patch.slug;
      if (patch.status !== undefined) updates.status = patch.status;
      if (patch.isDefaultLocale !== undefined)
        updates.isDefaultLocale = patch.isDefaultLocale ? 'true' : 'false';
      if (patch.data !== undefined) updates.data = patch.data as unknown as object;
      if (patch.publishedAt !== undefined) updates.publishedAt = patch.publishedAt;
      if (patch.scheduledPublishAt !== undefined)
        updates.scheduledPublishAt = patch.scheduledPublishAt;
      if (patch.scheduledUnpublishAt !== undefined)
        updates.scheduledUnpublishAt = patch.scheduledUnpublishAt;
      if (patch.updatedBy !== undefined) updates.updatedBy = patch.updatedBy;
      updates.updatedAt = new Date();

      const [row] = await this.db
        .update(entries)
        .set(updates)
        .where(eq(entries.id, id))
        .returning();
      if (!row) throw new NotFoundError('Entry not found', { id });
      return mapEntry(row as EntryRow);
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  async delete(id: EntryId): Promise<void> {
    try {
      const result = await this.db
        .delete(entries)
        .where(eq(entries.id, id))
        .returning();
      if (result.length === 0) throw new NotFoundError('Entry not found', { id });
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Transition to `published`; sets `publishedAt = now()` if absent. */
  async publish(id: EntryId, by: UserId | null = null): Promise<Entry> {
    const existing = await this.findById(id);
    if (!existing.ok) {
      throw new NotFoundError('Entry not found', { id });
    }
    const now = new Date();
    return this.update(id, {
      status: 'published',
      publishedAt: existing.value.publishedAt ? null : now,
      updatedBy: by,
    });
  }

  /** Transition to `draft`; clears `publishedAt`. */
  async unpublish(id: EntryId, by: UserId | null = null): Promise<Entry> {
    return this.update(id, {
      status: 'draft',
      publishedAt: null,
      updatedBy: by,
    });
  }

  /** Append a revision snapshot. */
  async addRevision(
    entryIdValue: EntryId,
    snapshot: {
      status: EntryStatus;
      data: Record<string, unknown>;
      createdBy?: UserId | null;
      comment?: string | null;
    },
  ): Promise<{ id: string; version: number }> {
    try {
      const [latest] = await this.db
        .select({ version: entryRevisions.version })
        .from(entryRevisions)
        .where(eq(entryRevisions.entryId, entryIdValue))
        .orderBy(desc(entryRevisions.version))
        .limit(1);
      const nextVersion = (latest?.version ?? 0) + 1;

      const [row] = await this.db
        .insert(entryRevisions)
        .values({
          entryId: entryIdValue,
          version: nextVersion,
          status: snapshot.status,
          data: snapshot.data as unknown as object,
          createdBy: snapshot.createdBy ?? null,
          comment: snapshot.comment ?? null,
        })
        .returning();
      if (!row) throw new Error('insert returned no row');
      return { id: row.id, version: row.version };
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Fetch revision history (newest first). */
  async getRevisions(
    entryIdValue: EntryId,
    limit = 50,
  ): Promise<readonly { id: string; version: number; createdAt: Date }[]> {
    const rows = await this.db
      .select({
        id: entryRevisions.id,
        version: entryRevisions.version,
        createdAt: entryRevisions.createdAt,
      })
      .from(entryRevisions)
      .where(eq(entryRevisions.entryId, entryIdValue))
      .orderBy(desc(entryRevisions.version))
      .limit(limit);
    return rows;
  }
}
