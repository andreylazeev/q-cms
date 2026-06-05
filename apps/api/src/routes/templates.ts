/**
 * User-defined page-template routes.
 *
 * Endpoints:
 *   GET    /api/v1/templates
 *   GET    /api/v1/templates/:id
 *   POST   /api/v1/templates
 *   PATCH  /api/v1/templates/:id
 *   DELETE /api/v1/templates/:id
 *
 * The persisted shape is the same `TemplateSpec` defined by
 * `@q-cms/templates`. We re-validate on every write so the database
 * can never contain malformed specs.
 *
 * @module routes/templates
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../lib/stubs/core-shim.ts';
import { templateRepo } from '../lib/stubs/index.ts';
import { serializeResource, serializeCollection } from '../lib/jsonapi.ts';
import { createEmptyTemplate, touchTemplate, type TemplateSection, type TemplateSpec } from '@q-cms/templates';

export const templatesRouter = new Hono();

// ---------------------------------------------------------------------------
// Zod schemas — local, narrow shapes for the HTTP surface.
// The full `TemplateSpec` is validated by the templates package itself.
// ---------------------------------------------------------------------------

const sectionSchema: z.ZodType<TemplateSection, z.ZodTypeDef, unknown> = z.lazy(
  (): z.ZodType<TemplateSection, z.ZodTypeDef, unknown> =>
    z.object({
      id: z.string().min(1).max(128),
      type: z.string().min(1).max(64),
      props: z.record(z.unknown()).default({}),
      children: z.array(sectionSchema).optional(),
    }),
);

const templateInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  slug: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9-]+$/, 'Slug must be kebab-case'),
  locale: z.string().min(2).max(16).default('en'),
  sections: z.array(sectionSchema).default([]),
  meta: z.record(z.unknown()).default({}),
});

const updateInputSchema = templateInputSchema.partial();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireUserId(c: { get: (k: 'user') => { id: string } | undefined }): string {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');
  return user.id;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** GET /templates */
templatesRouter.get('/', async (c) => {
  requireUserId(c);
  const items = await templateRepo.list();
  return c.json(
    serializeCollection(
      'Template',
      items.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description ?? null,
        locale: t.locale,
        sectionCount: t.sections.length,
        updatedAt: t.updatedAt,
        createdAt: t.createdAt,
      })),
      {
        pageInfo: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null },
        totalCount: items.length,
      },
    ),
  );
});

/** GET /templates/:id */
templatesRouter.get('/:id', async (c) => {
  requireUserId(c);
  const id = c.req.param('id');
  const found = await templateRepo.findById(id);
  if (!found) throw new NotFoundError(`Template '${id}' not found`);
  return c.json(serializeResource('Template', found.id, publicTemplate(found)));
});

/** POST /templates */
templatesRouter.post('/', async (c) => {
  const actorId = requireUserId(c);
  const body = templateInputSchema.parse(await c.req.json().catch(() => ({})));
  const existing = await templateRepo.findBySlug(body.slug);
  if (existing) throw new ConflictError(`Template slug '${body.slug}' is already in use`);
  const spec = createEmptyTemplate({
    name: body.name,
    slug: body.slug,
    ...(body.description !== undefined ? { description: body.description } : {}),
    locale: body.locale,
    sections: body.sections,
  });
  const created = await templateRepo.create({
    name: spec.name,
    slug: spec.slug,
    description: spec.description ?? null,
    locale: spec.locale,
    sections: spec.sections.map(templateSectionToRecordSection),
    meta: spec.meta,
    createdBy: actorId,
  });
  return c.json(serializeResource('Template', created.id, publicTemplate(created)), 201);
});

/** PATCH /templates/:id */
templatesRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await templateRepo.findById(id);
  if (!existing) throw new NotFoundError(`Template '${id}' not found`);
  const body = updateInputSchema.parse(await c.req.json().catch(() => ({})));
  if (body.slug && body.slug !== existing.slug) {
    const dup = await templateRepo.findBySlug(body.slug);
    if (dup && dup.id !== id) {
      throw new ConflictError(`Template slug '${body.slug}' is already in use`);
    }
  }
  const next = specToTemplateRecordPatch(
    touchTemplate({
      ...templateRecordToSpec(existing),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.slug !== undefined ? { slug: body.slug } : {}),
      ...(body.locale !== undefined ? { locale: body.locale } : {}),
      ...(body.sections !== undefined ? { sections: body.sections } : {}),
      ...(body.meta !== undefined ? { meta: body.meta } : {}),
    }),
  );
  const updated = await templateRepo.update(id, next);
  return c.json(serializeResource('Template', updated.id, publicTemplate(updated)));
});

/** DELETE /templates/:id */
templatesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await templateRepo.findById(id);
  if (!existing) throw new NotFoundError(`Template '${id}' not found`);
  await templateRepo.delete(id);
  return c.body(null, 204);
});

interface TemplateRecordSection {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: ReadonlyArray<TemplateRecordSection>;
}

function templateRecordToSpec(t: {
  slug: string;
  name: string;
  description: string | null;
  locale: string;
  sections: ReadonlyArray<TemplateRecordSection>;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}): TemplateSpec {
  return {
    version: 1,
    name: t.name,
    ...(t.description !== null ? { description: t.description } : {}),
    slug: t.slug,
    locale: t.locale,
    sections: t.sections.map(cloneSection),
    meta: t.meta,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function cloneSection(section: TemplateRecordSection): TemplateSection {
  return {
    id: section.id,
    type: section.type,
    props: section.props,
    ...(section.children !== undefined ? { children: section.children.map(cloneSection) } : {}),
  };
}

function specToTemplateRecordPatch(spec: TemplateSpec): {
  name: string;
  slug: string;
  description: string | null;
  locale: string;
  sections: TemplateRecordSection[];
  meta: Record<string, unknown>;
  updatedAt: string;
} {
  return {
    name: spec.name,
    slug: spec.slug,
    description: spec.description ?? null,
    locale: spec.locale,
    sections: spec.sections.map(templateSectionToRecordSection),
    meta: spec.meta,
    updatedAt: spec.updatedAt,
  };
}

function templateSectionToRecordSection(section: TemplateSection): TemplateRecordSection {
  return {
    id: section.id,
    type: section.type,
    props: section.props,
    ...(section.children !== undefined ? { children: section.children.map(templateSectionToRecordSection) } : {}),
  };
}

function publicTemplate(t: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  locale: string;
  sections: ReadonlyArray<unknown>;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}): Record<string, unknown> {
  return {
    slug: t.slug,
    name: t.name,
    description: t.description,
    locale: t.locale,
    sections: t.sections,
    meta: t.meta,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
