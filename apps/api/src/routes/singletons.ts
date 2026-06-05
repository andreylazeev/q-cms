/**
 * Singleton routes.
 *
 * Endpoints:
 *   GET  /api/v1/singletons/{slug}   — fetch a singleton
 *   PUT  /api/v1/singletons/{slug}   — create-or-replace a singleton
 *
 * @module routes/singletons
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { NotFoundError, type Entry, type UserId } from '../lib/stubs/core-shim.ts';
import { collectionRepo, singletonRepo, auditRepo } from '../lib/stubs/index.ts';
import { serializeResource } from '../lib/jsonapi.ts';
export const singletonsRouter = new Hono();
const localeParamSchema = z.string().min(2).max(8).default('en');

const upsertSingletonSchema = z.object({
  locale: z.string().min(2).max(8).default('en'),
  data: z.record(z.unknown()),
});

/** GET /singletons/{slug} */
singletonsRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const locale = localeParamSchema.parse(c.req.query('locale') ?? 'en');
  const col = await collectionRepo.findBySlug(slug);
  if (!col) throw new NotFoundError(`Singleton '${slug}' not found`);
  if (!col.isSingleton) throw new NotFoundError(`'${slug}' is not a singleton collection`);
  const entry = await singletonRepo.find(col.id, locale);
  if (!entry) {
    // Return empty placeholder so the editor can render an empty form.
    return c.json({
      data: {
        id: col.id,
        type: col.name,
        attributes: { locale, data: {}, version: 0, status: 'draft' },
      },
    });
  }
  return c.json(serializeResource(col.name, entry.id, publicEntry(entry)));
});

/** PUT /singletons/{slug} */
singletonsRouter.put('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const body = upsertSingletonSchema.parse(await c.req.json().catch(() => ({})));
  const col = await collectionRepo.findBySlug(slug);
  if (!col) throw new NotFoundError(`Singleton '${slug}' not found`);
  if (!col.isSingleton) throw new NotFoundError(`'${slug}' is not a singleton collection`);
  const actor = c.get('user')?.id ?? null;
  const entry = await singletonRepo.upsert({
    collectionId: col.id,
    slug: null,
    status: 'published',
    locale: body.locale as Entry['locale'],
    isDefaultLocale: body.locale === 'en',
    data: body.data,
    publishedAt: new Date().toISOString(),
    scheduledPublishAt: null,
    scheduledUnpublishAt: null,
    createdBy: (actor as UserId | null) ?? null,
    updatedBy: (actor as UserId | null) ?? null,
  });
  await auditRepo.record({
    actorId: actor as UserId | null,
    actorEmail: null,
    action: 'singleton.update',
    resourceType: `Singleton:${col.slug}`,
    resourceId: entry.id,
    diff: null,
    context: { locale: body.locale },
  });
  return c.json(serializeResource(col.name, entry.id, publicEntry(entry)));
});

function publicEntry(e: Entry): Record<string, unknown> {
  return {
    locale: e.locale,
    data: e.data,
    publishedAt: e.publishedAt,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    version: 1,
    status: e.status,
  };
}
