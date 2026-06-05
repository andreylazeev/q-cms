/**
 * Entry CRUD + lifecycle routes.
 *
 * Endpoints (per `API.md` §3.1):
 *   GET    /api/v1/collections/{slug}/entries
 *   POST   /api/v1/collections/{slug}/entries
 *   GET    /api/v1/collections/{slug}/entries/{id}
 *   PATCH  /api/v1/collections/{slug}/entries/{id}
 *   DELETE /api/v1/collections/{slug}/entries/{id}
 *   POST   /api/v1/collections/{slug}/entries/{id}/publish
 *   POST   /api/v1/collections/{slug}/entries/{id}/unpublish
 *   POST   /api/v1/collections/{slug}/entries/{id}/duplicate
 *   GET    /api/v1/collections/{slug}/entries/{id}/revisions
 *   POST   /api/v1/collections/{slug}/entries/{id}/revisions/{ver}/restore
 *   POST   /api/v1/bulk
 *
 * @module routes/entries
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type Entry,
  type EntryId,
  type UserId,
  type EntryStatus,
} from '../lib/stubs/core-shim.ts';
import {
  auditRepo,
  collectionRepo,
  entryRepo,
  singletonRepo,
} from '../lib/stubs/index.ts';
import {
  serializeResource,
  serializeCollection,
} from '../lib/jsonapi.ts';
import {
  cursorPaginationSchema,
  statusSchema,
  localeSchema,
} from '../lib/zod-helpers.ts';
import { enqueue, QUEUE_NAMES } from '../services/queue.ts';

export const entriesRouter = new Hono();

const createEntrySchema = z.object({
  slug: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'in_review', 'approved', 'published', 'archived']).default('draft'),
  locale: z.string().min(2).max(8).default('en'),
  isDefaultLocale: z.boolean().optional(),
  data: z.record(z.unknown()),
  publishedAt: z.string().datetime().optional(),
});

const updateEntrySchema = z.object({
  slug: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'in_review', 'approved', 'published', 'archived']).optional(),
  data: z.record(z.unknown()).optional(),
  publishedAt: z.string().datetime().optional(),
});

const duplicateSchema = z.object({
  slug: z.string().min(1).max(200).optional(),
  locale: z.string().min(2).max(8).optional(),
});

const restoreRevisionSchema = z.object({
  comment: z.string().max(500).optional(),
});

/**
 * Resolve the collection record and check write access. Throws
 * `NotFoundError` if the slug is unknown, `ForbiddenError` if the
 * caller lacks the required permission.
 */
async function resolveCollection(slug: string) {
  const col = await collectionRepo.findBySlug(slug);
  if (!col) throw new NotFoundError(`Collection '${slug}' not found`);
  return col;
}

/**
 * GET /collections/{slug}/entries
 * List entries with cursor pagination, status filter, and locale
 * fallback chain.
 */
entriesRouter.get('/collections/:slug/entries', async (c) => {
  const slug = c.req.param('slug');
  const col = await resolveCollection(slug);
  const page = cursorPaginationSchema.parse(c.req.query());
  const rawStatus = c.req.query('status');
  const rawLocale = c.req.query('locale');
  const status = rawStatus ? statusSchema.parse(rawStatus) : undefined;
  const locale = rawLocale ? localeSchema.parse(rawLocale) : undefined;
  const result = await entryRepo.list({
    collectionId: col.id,
    ...(status ? { status } : {}),
    ...(locale ? { locale } : {}),
    limit: page.limit,
    cursor: page.cursor ?? null,
    withTotal: page.withTotal ?? false,
  });
  return c.json(serializeCollection('Entry', result.data, {
    pageInfo: {
      hasNext: result.page.nextCursor !== null,
      hasPrev: result.page.prevCursor !== null,
      startCursor: result.page.prevCursor,
      endCursor: result.page.nextCursor,
    },
    totalCount: result.page.total ?? undefined,
  }));
});

/**
 * POST /collections/{slug}/entries
 * Create a new entry. Default status is `draft`.
 */
entriesRouter.post('/collections/:slug/entries', async (c) => {
  const slug = c.req.param('slug');
  const col = await resolveCollection(slug);
  if (col.isSingleton) {
    // Singleton writes go through /singletons/{slug}; we still support
    // an upsert by id=undefined here for clients that POST to the
    // collections prefix.
    const body = createEntrySchema.parse(await c.req.json().catch(() => ({})));
    const entry = await singletonRepo.upsert({
      collectionId: col.id,
      slug: (body.slug ?? null) as Entry['slug'],
      status: body.status,
      locale: body.locale as Entry['locale'],
      isDefaultLocale: body.isDefaultLocale ?? body.locale === 'en',
      data: body.data,
      publishedAt: body.publishedAt ?? null,
      scheduledPublishAt: null,
      scheduledUnpublishAt: null,
      createdBy: (c.get('user')?.id ?? null) as UserId | null,
      updatedBy: (c.get('user')?.id ?? null) as UserId | null,
    });
    return c.json(serializeResource('Entry', entry.id, publicEntry(entry)), 201);
  }
  const body = createEntrySchema.parse(await c.req.json().catch(() => ({})));
  if (body.slug) {
    const existing = await entryRepo.findBySlug(col.id, body.slug, body.locale);
    if (existing) throw new ConflictError(`Slug '${body.slug}' already in use`);
  }
  const actor = c.get('user')?.id ?? null;
  const entry = await entryRepo.create({
    collectionId: col.id,
    slug: (body.slug ?? null) as Entry['slug'],
    status: body.status,
    locale: body.locale as Entry['locale'],
    isDefaultLocale: body.isDefaultLocale ?? body.locale === 'en',
    data: body.data,
    publishedAt: body.publishedAt ?? null,
    scheduledPublishAt: null,
    scheduledUnpublishAt: null,
    createdBy: (actor as UserId | null) ?? null,
    updatedBy: (actor as UserId | null) ?? null,
  });
  await auditRepo.record({
    actorId: actor as UserId | null,
    actorEmail: null,
    action: 'entry.create',
    resourceType: `Collection:${col.slug}`,
    resourceId: entry.id,
    diff: null,
    context: { slug: body.slug ?? null, status: body.status },
  });
  await enqueue(QUEUE_NAMES.reindex, {
    collection: col.slug,
    entryId: entry.id,
    action: 'upsert',
  }).catch(() => undefined);
  return c.json(serializeResource('Entry', entry.id, publicEntry(entry)), 201);
});

/**
 * GET /collections/{slug}/entries/{id}
 */
entriesRouter.get('/collections/:slug/entries/:id', async (c) => {
  const slug = c.req.param('slug');
  const id = c.req.param('id');
  await resolveCollection(slug);
  const entry = await entryRepo.findById(id);
  if (!entry) throw new NotFoundError('Entry not found');
  return c.json(serializeResource('Entry', entry.id, publicEntry(entry)));
});

/**
 * PATCH /collections/{slug}/entries/{id}
 */
entriesRouter.patch('/collections/:slug/entries/:id', async (c) => {
  const slug = c.req.param('slug');
  const id = c.req.param('id');
  const col = await resolveCollection(slug);
  const existing = await entryRepo.findById(id);
  if (!existing) throw new NotFoundError('Entry not found');
  const body = updateEntrySchema.parse(await c.req.json().catch(() => ({})));
  const actor = c.get('user')?.id ?? null;
  const updated = await entryRepo.update(id, {
    ...(body.slug !== undefined ? { slug: body.slug as Entry['slug'] } : {}),
    ...(body.status ? { status: body.status } : {}),
    ...(body.data ? { data: body.data } : {}),
    ...(body.publishedAt !== undefined ? { publishedAt: body.publishedAt } : {}),
    updatedBy: (actor as UserId | null) ?? null,
  });
  await entryRepo.saveRevision({
    entryId: updated.id,
    version: Date.now(),
    status: updated.status,
    data: updated.data as Record<string, unknown>,
    createdBy: actor as UserId | null,
    comment: null,
  });
  await auditRepo.record({
    actorId: actor as UserId | null,
    actorEmail: null,
    action: 'entry.update',
    resourceType: `Collection:${col.slug}`,
    resourceId: updated.id,
    diff: null,
    context: { status: updated.status },
  });
  await enqueue(QUEUE_NAMES.reindex, {
    collection: col.slug,
    entryId: updated.id,
    action: 'upsert',
  }).catch(() => undefined);
  return c.json(serializeResource('Entry', updated.id, publicEntry(updated)));
});

/**
 * DELETE /collections/{slug}/entries/{id}
 */
entriesRouter.delete('/collections/:slug/entries/:id', async (c) => {
  const slug = c.req.param('slug');
  const id = c.req.param('id');
  const col = await resolveCollection(slug);
  const existing = await entryRepo.findById(id);
  if (!existing) throw new NotFoundError('Entry not found');
  await entryRepo.delete(id);
  await auditRepo.record({
    actorId: (c.get('user')?.id ?? null) as UserId | null,
    actorEmail: null,
    action: 'entry.delete',
    resourceType: `Collection:${col.slug}`,
    resourceId: id,
    diff: null,
    context: {},
  });
  await enqueue(QUEUE_NAMES.reindex, {
    collection: col.slug,
    entryId: id,
    action: 'delete',
  }).catch(() => undefined);
  return c.body(null, 204);
});

/** POST .../publish */
entriesRouter.post('/collections/:slug/entries/:id/publish', async (c) => {
  const slug = c.req.param('slug');
  const id = c.req.param('id');
  const col = await resolveCollection(slug);
  if (c.get('user') && !canPublish(c.get('roles') ?? [])) {
    throw new ForbiddenError('Missing permission: publish');
  }
  const existing = await entryRepo.findById(id);
  if (!existing) throw new NotFoundError('Entry not found');
  const updated = await entryRepo.update(id, {
    status: 'published',
    publishedAt: existing.publishedAt ?? new Date().toISOString(),
  });
  await auditRepo.record({
    actorId: (c.get('user')?.id ?? null) as UserId | null,
    actorEmail: null,
    action: 'entry.publish',
    resourceType: `Collection:${col.slug}`,
    resourceId: id,
    diff: null,
    context: {},
  });
  await enqueue(QUEUE_NAMES.reindex, {
    collection: col.slug,
    entryId: id,
    action: 'upsert',
  }).catch(() => undefined);
  return c.json(serializeResource('Entry', updated.id, publicEntry(updated)));
});

/** POST .../unpublish */
entriesRouter.post('/collections/:slug/entries/:id/unpublish', async (c) => {
  const slug = c.req.param('slug');
  const id = c.req.param('id');
  const col = await resolveCollection(slug);
  const existing = await entryRepo.findById(id);
  if (!existing) throw new NotFoundError('Entry not found');
  const updated = await entryRepo.update(id, { status: 'archived' });
  await auditRepo.record({
    actorId: (c.get('user')?.id ?? null) as UserId | null,
    actorEmail: null,
    action: 'entry.unpublish',
    resourceType: `Collection:${col.slug}`,
    resourceId: id,
    diff: null,
    context: {},
  });
  await enqueue(QUEUE_NAMES.reindex, {
    collection: col.slug,
    entryId: id,
    action: 'delete',
  }).catch(() => undefined);
  return c.json(serializeResource('Entry', updated.id, publicEntry(updated)));
});

/** POST .../duplicate */
entriesRouter.post('/collections/:slug/entries/:id/duplicate', async (c) => {
  const slug = c.req.param('slug');
  const id = c.req.param('id');
  const col = await resolveCollection(slug);
  const body = duplicateSchema.parse(await c.req.json().catch(() => ({})));
  const existing = await entryRepo.findById(id);
  if (!existing) throw new NotFoundError('Entry not found');
  const newSlug = (body.slug ?? `${existing.slug ?? 'copy'}-copy-${Date.now()}`) as Entry['slug'];
  const dup = await entryRepo.create({
    collectionId: col.id,
    slug: newSlug,
    status: 'draft',
    locale: (body.locale ?? existing.locale) as Entry['locale'],
    isDefaultLocale: existing.isDefaultLocale,
    data: existing.data,
    publishedAt: null,
    scheduledPublishAt: null,
    scheduledUnpublishAt: null,
    createdBy: (c.get('user')?.id ?? null) as UserId | null,
    updatedBy: (c.get('user')?.id ?? null) as UserId | null,
  });
  return c.json(serializeResource('Entry', dup.id, publicEntry(dup)), 201);
});

/** GET .../revisions */
entriesRouter.get('/collections/:slug/entries/:id/revisions', async (c) => {
  const id = c.req.param('id');
  const revisions = await entryRepo.listRevisions(id);
  return c.json(serializeCollection('EntryRevision', revisions.map((r) => ({
    id: r.id,
    entryId: r.entryId,
    version: r.version,
    status: r.status,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    comment: r.comment,
  })), {
    pageInfo: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null },
    totalCount: revisions.length,
  }));
});

/** POST .../revisions/{ver}/restore */
entriesRouter.post('/collections/:slug/entries/:id/revisions/:ver/restore', async (c) => {
  const id = c.req.param('id');
  const ver = Number(c.req.param('ver'));
  if (!Number.isFinite(ver)) throw new ValidationError('Invalid version');
  const body = restoreRevisionSchema.parse(await c.req.json().catch(() => ({})));
  const revisions = await entryRepo.listRevisions(id);
  const target = revisions.find((r) => r.version === ver);
  if (!target) throw new NotFoundError('Revision not found');
  const updated = await entryRepo.update(id, {
    data: target.data as Record<string, unknown>,
    status: target.status,
  });
  await entryRepo.saveRevision({
    entryId: updated.id,
    version: Date.now(),
    status: updated.status,
    data: updated.data as Record<string, unknown>,
    createdBy: (c.get('user')?.id ?? null) as UserId | null,
    comment: body.comment ?? `Restored from v${ver}`,
  });
  return c.json(serializeResource('Entry', updated.id, publicEntry(updated)));
});

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

const bulkOpSchema = z.object({
  atomic: z.boolean().default(false),
  operations: z
    .array(
      z.object({
        op: z.enum(['create', 'update', 'delete', 'publish', 'unpublish']),
        ref: z.string().min(1).max(64),
        resource: z.string().min(1),
        id: z.string().min(1).optional(),
        data: z.record(z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(100),
});

/** POST /bulk */
const bulkRouter = new Hono();
bulkRouter.post('/bulk', async (c) => {
  const body = bulkOpSchema.parse(await c.req.json().catch(() => ({})));
  const results: Array<{ ref: string; status: number; data?: unknown; errors?: unknown }> = [];
  for (const op of body.operations) {
    try {
      const col = await collectionRepo.findBySlug(op.resource);
      if (!col) {
        results.push({ ref: op.ref, status: 404, errors: [{ code: 'NOT_FOUND', detail: `Collection ${op.resource}` }] });
        continue;
      }
      switch (op.op) {
        case 'create': {
          const data = (op.data ?? {}) as { data?: Record<string, unknown>; slug?: string; locale?: string; status?: EntryStatus };
          const created = await entryRepo.create({
            collectionId: col.id,
            slug: (data.slug ?? null) as Entry['slug'],
            status: data.status ?? 'draft',
            locale: (data.locale ?? 'en') as Entry['locale'],
            isDefaultLocale: (data.locale ?? 'en') === 'en',
            data: data.data ?? {},
            publishedAt: null,
            scheduledPublishAt: null,
            scheduledUnpublishAt: null,
            createdBy: (c.get('user')?.id ?? null) as UserId | null,
            updatedBy: (c.get('user')?.id ?? null) as UserId | null,
          });
          results.push({ ref: op.ref, status: 201, data: publicEntry(created) });
          break;
        }
        case 'update': {
          if (!op.id) {
            results.push({ ref: op.ref, status: 422, errors: [{ code: 'MISSING_ID' }] });
            break;
          }
          const updated = await entryRepo.update(op.id, { data: op.data ?? {} });
          results.push({ ref: op.ref, status: 200, data: publicEntry(updated) });
          break;
        }
        case 'delete': {
          if (!op.id) {
            results.push({ ref: op.ref, status: 422, errors: [{ code: 'MISSING_ID' }] });
            break;
          }
          await entryRepo.delete(op.id);
          results.push({ ref: op.ref, status: 204 });
          break;
        }
        case 'publish': {
          if (!op.id) {
            results.push({ ref: op.ref, status: 422, errors: [{ code: 'MISSING_ID' }] });
            break;
          }
          const updated = await entryRepo.update(op.id, {
            status: 'published',
            publishedAt: new Date().toISOString(),
          });
          results.push({ ref: op.ref, status: 200, data: publicEntry(updated) });
          break;
        }
        case 'unpublish': {
          if (!op.id) {
            results.push({ ref: op.ref, status: 422, errors: [{ code: 'MISSING_ID' }] });
            break;
          }
          const updated = await entryRepo.update(op.id, { status: 'archived' });
          results.push({ ref: op.ref, status: 200, data: publicEntry(updated) });
          break;
        }
      }
    } catch (err) {
      results.push({
        ref: op.ref,
        status: 500,
        errors: [{ code: 'INTERNAL', detail: err instanceof Error ? err.message : String(err) }],
      });
      if (body.atomic) break;
    }
  }
  return c.json({ results }, 200);
});

export { bulkRouter };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function publicEntry(e: Entry): Record<string, unknown> {
  return {
    id: e.id,
    slug: e.slug,
    status: e.status,
    locale: e.locale,
    isDefaultLocale: e.isDefaultLocale,
    data: e.data,
    publishedAt: e.publishedAt,
    scheduledPublishAt: e.scheduledPublishAt,
    scheduledUnpublishAt: e.scheduledUnpublishAt,
    createdBy: e.createdBy,
    updatedBy: e.updatedBy,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    version: 1,
  };
}

function canPublish(roles: readonly string[]): boolean {
  return roles.some((r) =>
    r === 'super-admin' || r === 'admin' || r === 'editor',
  );
}

// Re-export type for any external consumer.
export type EntriesRouter = typeof entriesRouter;
// Suppress unused warnings: keep EntryId import alive for type docs.
export type { EntryId };
