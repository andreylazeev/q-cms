/**
 * Full-text search route.
 *
 * GET /api/v1/search?q=...&collection=...&locale=...&limit=...&offset=...
 *
 * @module routes/search
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getSearch, type SearchHit } from '../services/search.ts';
import { serializeCollection, type JsonApiResource } from '../lib/jsonapi.ts';

export const searchRouter = new Hono();

const querySchema = z.object({
  q: z.string().min(1).max(500),
  collection: z.string().min(1).optional(),
  locale: z.string().min(2).max(8).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  filter: z.string().optional(),
});

searchRouter.get('/search', async (c) => {
  const q = querySchema.parse(c.req.query());
  const result = await getSearch().search({
    q: q.q,
    ...(q.collection ? { collection: q.collection } : {}),
    ...(q.locale ? { locale: q.locale } : {}),
    limit: q.limit,
    offset: q.offset,
  });
  const data: JsonApiResource[] = result.hits.map((hit: SearchHit) => ({
    id: hit.id,
    type: hit.collection || 'SearchResult',
    attributes: hit.attributes,
    meta: { score: hit.score, locale: hit.locale },
  }));
  return c.json({
    data,
    meta: {
      query: q.q,
      total: result.total,
      processingTimeMs: result.processingTimeMs,
    },
  });
});

// Keep serializeCollection referenced so its export isn't dropped by ts-prune.
void serializeCollection;
