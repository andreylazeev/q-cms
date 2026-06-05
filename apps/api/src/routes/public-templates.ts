/**
 * Public read-only template surface.
 *
 * Mounted at `/api/v1/public/templates/*`. No auth. Used by the
 * static site's template engine to fetch a template spec by slug.
 *
 * @module routes/public-templates
 */

import { Hono } from 'hono';
import { NotFoundError } from '../lib/stubs/core-shim.ts';
import { templateRepo } from '../lib/stubs/index.ts';
import { serializeResource } from '../lib/jsonapi.ts';

export const publicTemplatesRouter = new Hono();

/**
 * GET /public/templates/:slug
 *
 * Returns the spec for a single template by its slug. Returns 404
 * when the slug does not exist — the public site falls back to
 * its static markup in that case.
 */
publicTemplatesRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const template = await templateRepo.findBySlug(slug);
  if (!template) throw new NotFoundError(`Template '${slug}' not found`);
  return c.json(
    serializeResource('Template', template.id, {
      slug: template.slug,
      name: template.name,
      description: template.description,
      locale: template.locale,
      sections: template.sections,
      meta: template.meta,
      updatedAt: template.updatedAt,
    }),
  );
});
