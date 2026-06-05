/**
 * Collection metadata routes.
 *
 * Endpoints:
 *   GET /api/v1/collections           — list all collection schemas
 *   GET /api/v1/collections/{slug}    — schema for one collection
 *
 * @module routes/collections
 */

import { Hono } from 'hono';
import { NotFoundError } from '../lib/stubs/core-shim.ts';
import { collectionRepo } from '../lib/stubs/index.ts';
import { serializeResource, serializeCollection } from '../lib/jsonapi.ts';

export const collectionsRouter = new Hono();

/** GET /collections */
collectionsRouter.get('/', async (c) => {
  const items = await collectionRepo.list();
  return c.json(serializeCollection('Collection', items.map((col) => ({
    id: col.id,
    name: col.name,
    slug: col.slug,
    isSingleton: col.isSingleton,
    draftAndPublish: col.draftAndPublish,
    versioning: col.versioning,
    displayName: col.displayName,
    displayNameI18n: col.displayNameI18n,
    createdAt: col.createdAt,
    updatedAt: col.updatedAt,
  })), {
    pageInfo: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null },
    totalCount: items.length,
  }));
});

/** GET /collections/{slug} */
collectionsRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const col = await collectionRepo.findBySlug(slug);
  if (!col) throw new NotFoundError(`Collection '${slug}' not found`);
  return c.json(serializeResource('Collection', col.id, {
    name: col.name,
    slug: col.slug,
    isSingleton: col.isSingleton,
    draftAndPublish: col.draftAndPublish,
    versioning: col.versioning,
    schema: col.schema,
    settings: col.settings,
    displayName: col.displayName,
    displayNameI18n: col.displayNameI18n,
    createdAt: col.createdAt,
    updatedAt: col.updatedAt,
  }));
});
