/**
 * Public read-only content API.
 *
 * Mounted at `/api/v1/public/*` and exempted from the auth/rbac
 * middleware. Returns only **published** entries from any collection
 * and is meant to power a public-facing site (blog, docs, marketing
 * pages) that does not require authentication.
 *
 * The data shape matches what the SDK expects, so a public site can
 * be wired up with the same client used by the admin app.
 *
 * @module routes/public
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  collectionRepo,
  entryRepo,
  singletonRepo,
} from '../lib/stubs/index.ts';
import {
  serializeResource,
  serializeCollection,
} from '../lib/jsonapi.ts';
import { NotFoundError } from '../lib/stubs/core-shim.ts';
import { cursorPaginationSchema, localeSchema } from '../lib/zod-helpers.ts';

export const publicRouter = new Hono();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const listQuerySchema = cursorPaginationSchema.extend({
  locale: localeSchema.optional(),
  status: z.string().optional(),
});

const publicListQuerySchema = listQuerySchema.omit({ status: true }).extend({
  locale: localeSchema.optional(),
});

// ---------------------------------------------------------------------------
// Site-level
// ---------------------------------------------------------------------------

/**
 * GET /public/site
 * Returns the singleton site settings (name, default locale, supported
 * locales, etc.). Used to render the site header / footer.
 */
publicRouter.get('/site', async (c) => {
  const site = await singletonRepo.find('site', 'en');
  return c.json(
    site
      ? serializeResource('SiteSettings', 'site', {
          siteName: (site.data as { siteName?: string }).siteName ?? 'Q-CMS Demo',
          siteDescription:
            (site.data as { siteDescription?: string }).siteDescription ?? null,
          defaultLocale:
            (site.data as { defaultLocale?: string }).defaultLocale ?? 'en',
          supportedLocales:
            (site.data as { supportedLocales?: string[] }).supportedLocales ?? ['en'],
        })
      : serializeResource('SiteSettings', 'site', {
          siteName: 'Q-CMS Demo',
          siteDescription: 'A block-first, API-first headless CMS.',
          defaultLocale: 'en',
          supportedLocales: ['en', 'ru', 'de'],
        }),
  );
});

/**
 * GET /public/collections
 * Lists the collection schemas a public site can render.
 */
publicRouter.get('/collections', async (c) => {
  const items = await collectionRepo.list();
  return c.json(
    serializeCollection(
      'Collection',
      items.map((col) => ({
        id: col.id,
        name: col.name,
        slug: col.slug,
        isSingleton: col.isSingleton,
        displayName: col.displayName,
        displayNameI18n: col.displayNameI18n,
      })),
      {
        pageInfo: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null },
        totalCount: items.length,
      },
    ),
  );
});

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

/**
 * GET /public/entries
 * Lists **published** entries across all collections, newest first.
 * Powers the home page / blog index.
 */
publicRouter.get('/entries', async (c) => {
  const q = publicListQuerySchema.parse(c.req.query());
  const collections = await collectionRepo.list();

  const all: Array<{ id: string; slug: string; collectionId: string; status: string; data: unknown; publishedAt: string | null; updatedAt: string; createdAt: string; }> = [];
  for (const col of collections) {
    if (col.isSingleton) continue;
    const { data: items } = await entryRepo.list({
      collectionId: col.id,
      status: ['published'],
      limit: 50,
      cursor: null,
      withTotal: false,
    });
    for (const e of items) {
      if (q.locale && e.locale !== q.locale) continue;
      all.push({
        id: String(e.id),
        slug: e.slug ?? '',
        collectionId: String(e.collectionId),
        status: String(e.status),
        data: e.data,
        publishedAt: e.publishedAt,
        updatedAt: e.updatedAt,
        createdAt: e.createdAt,
      });
    }
  }
  all.sort((a, b) => {
    const ad = a.publishedAt ?? a.updatedAt;
    const bd = b.publishedAt ?? b.updatedAt;
    return bd.localeCompare(ad);
  });

  return c.json(
    serializeCollection(
      'Entry',
      all.map((e) => ({
        ...e,
        id: e.id,
      })),
      {
        pageInfo: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null },
        totalCount: all.length,
      },
    ),
  );
});

/**
 * GET /public/entries/:collection/:slug
 * Returns a single **published** entry. Used by individual article
 * pages.
 */
publicRouter.get('/entries/:collection/:slug', async (c) => {
  const slug = c.req.param('slug');
  const collection = c.req.param('collection');
  const col = await collectionRepo.findBySlug(collection);
  if (!col) throw new NotFoundError(`Collection '${collection}' not found`);

  const entry = await entryRepo.findBySlug(col.id, slug, 'en');
  if (!entry || entry.status !== 'published') {
    throw new NotFoundError(`Entry '${collection}/${slug}' not found`);
  }
  return c.json(
    serializeResource('Entry', String(entry.id), {
      slug: entry.slug,
      status: entry.status,
      locale: entry.locale,
      data: entry.data,
      publishedAt: entry.publishedAt,
      updatedAt: entry.updatedAt,
    }),
  );
});

/**
 * GET /public/entries/:collection
 * Lists **published** entries for one collection.
 */
publicRouter.get('/entries/:collection', async (c) => {
  const collection = c.req.param('collection');
  const col = await collectionRepo.findBySlug(collection);
  if (!col) throw new NotFoundError(`Collection '${collection}' not found`);

  const q = publicListQuerySchema.parse(c.req.query());
  const { data: items, page } = await entryRepo.list({
    collectionId: col.id,
    status: ['published'],
    limit: 50,
    cursor: q.cursor ?? null,
    withTotal: true,
  });

  const filtered = q.locale
    ? items.filter((e) => e.locale === q.locale)
    : items;

  return c.json(
    serializeCollection(
      'Entry',
      filtered.map((e) => ({
        id: String(e.id),
        slug: e.slug,
        status: e.status,
        locale: e.locale,
        collectionId: e.collectionId,
        data: e.data,
        publishedAt: e.publishedAt,
        updatedAt: e.updatedAt,
      })),
      {
        pageInfo: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null },
        totalCount: page?.total ?? filtered.length,
      },
    ),
  );
});
