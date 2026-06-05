/**
 * Zod-backed serialization helpers for the page-template DSL.
 *
 * The persisted shape (`TemplateSpec`) and the wire shape (just the
 * spec body) are the same — this module exists primarily to:
 *
 *   1. Validate unknown JSON coming back from the API or stored in
 *      `localStorage` (admin autosave).
 *   2. Provide stable defaults for partial specs.
 *   3. Normalize old versions to the current shape.
 *
 * @module serialize
 */

import { z } from 'zod';
import type { TemplateSection, TemplateSpec } from './types.ts';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const sectionIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, 'Section id must be alphanumeric, dash, or underscore');

const sectionSchema: z.ZodType<TemplateSection, z.ZodTypeDef, unknown> = z.lazy(
  (): z.ZodType<TemplateSection, z.ZodTypeDef, unknown> =>
    z.object({
      id: sectionIdSchema,
      type: z.string().min(1).max(64),
      props: z.record(z.unknown()).default({}),
      children: z.array(z.lazy(() => sectionSchema)).optional(),
    }),
);

export const templateSpecSchema = z.object({
  version: z.literal(1).default(1),
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
  createdAt: z.string().datetime({ offset: true }).optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
});

export type TemplateSpecInput = z.input<typeof templateSpecSchema>;
type TemplateSpecParsed = z.output<typeof templateSpecSchema>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate and normalize an unknown payload into a `TemplateSpec`.
 *
 * Throws a `ZodError` on failure. Callers should `try { } catch { }` and
 * surface the issues via the admin form, or use `safeDeserializeTemplate`
 * for a non-throwing variant.
 */
export function deserializeTemplate(input: unknown): TemplateSpec {
  const parsed = templateSpecSchema.parse(input);
  return finalize(parsed);
}

/** Non-throwing variant — returns either the spec or a structured error. */
export function safeDeserializeTemplate(
  input: unknown,
): { ok: true; spec: TemplateSpec } | { ok: false; error: z.ZodError } {
  const result = templateSpecSchema.safeParse(input);
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true, spec: finalize(result.data) };
}

/**
 * Normalize a parsed spec: ensure timestamps are present and stable
 * ordering of fields. Pure: returns a new object.
 */
function finalize(input: TemplateSpecParsed): TemplateSpec {
  const now = new Date().toISOString();
  const spec: TemplateSpec = {
    version: 1,
    name: input.name,
    slug: input.slug,
    locale: input.locale ?? 'en',
    sections: (input.sections ?? []).map(normalizeSection),
    meta: input.meta ?? {},
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
  if (input.description !== undefined) spec.description = input.description;
  return spec;
}

function normalizeSection(s: TemplateSection): TemplateSection {
  return {
    id: s.id,
    type: s.type,
    props: s.props ?? {},
    ...(s.children && s.children.length > 0
      ? { children: s.children.map(normalizeSection) }
      : {}),
  };
}

/**
 * Build a fresh spec with sensible defaults — used by the admin
 * "create" form.
 */
export function createEmptyTemplate(input: {
  name: string;
  slug: string;
  description?: string;
  locale?: string;
  sections?: TemplateSection[];
}): TemplateSpec {
  const now = new Date().toISOString();
  return {
    version: 1,
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    slug: input.slug,
    locale: input.locale ?? 'en',
    sections: input.sections ?? [],
    meta: {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Mark a spec as updated (returns a new object with the timestamp
 * bumped). Used by the save handler.
 */
export function touchTemplate(spec: TemplateSpec): TemplateSpec {
  return { ...spec, updatedAt: new Date().toISOString() };
}

/**
 * Serialize a spec to a plain JSON-compatible object. Currently a
 * no-op (the spec is already JSON-safe), but kept as a stable
 * API surface for future migration steps.
 */
export function serializeTemplate(spec: TemplateSpec): TemplateSpec {
  return spec;
}
