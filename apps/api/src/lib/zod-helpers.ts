/**
 * Reusable Zod schemas for common query parameters.
 *
 * These translate RQL semantics (filter[status]=published,
 * sort=-publishedAt, page[limit]=20) into typed shapes consumable by
 * the route handlers.
 *
 * @module lib/zod-helpers
 */

import { z } from 'zod';

/** Operator set per API.md §3.2. */
export const filterOperatorSchema = z.enum([
  'eq',
  'ne',
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
  'between',
  'overlaps',
]);

/** Single filter clause: `field`, `op`, optional `value`. */
export const filterClauseSchema = z.object({
  field: z.string().min(1),
  op: filterOperatorSchema,
  value: z.unknown().optional(),
});

/**
 * Generic filter object. Accepts:
 *  - shorthand: `{ status: 'published' }` (becomes eq)
 *  - operator:  `{ status: { eq: 'published' } }`
 *  - nested:    `{ and: [...], or: [...] }`
 */
export const filterSchema: z.ZodType<FilterInput> = z.lazy(
  (): z.ZodType<FilterInput> =>
    z
      .object({
        and: z.array(z.lazy((): z.ZodType<FilterInput> => filterSchema)).optional(),
        or: z.array(z.lazy((): z.ZodType<FilterInput> => filterSchema)).optional(),
      })
      .passthrough() as z.ZodType<FilterInput>,
);

export type FilterInput = {
  and?: FilterInput[];
  or?: FilterInput[];
  [field: string]: unknown;
};

/** Cursor-based pagination input (default). */
export const cursorPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
  withTotal: z.coerce.boolean().optional(),
});

/** Offset-based legacy pagination input. */
export const offsetPaginationSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Backwards-compatible alias used by the task spec. */
export const paginationSchema = cursorPaginationSchema;

/**
 * Sort input. Examples:
 *  - `sort=-publishedAt,title`   (parsed into `[{field:'publishedAt',direction:'desc'},{field:'title',direction:'asc'}]`)
 *  - `sort=[{"field":"x","direction":"asc"}]` (JSON form)
 */
export const sortFieldSchema = z.string().min(1).max(128);
export const sortDirectionSchema = z.enum(['asc', 'desc']);

export const sortSchema = z
  .union([
    z.string().transform((raw) => parseSortString(raw)),
    z
      .array(
        z.object({
          field: sortFieldSchema,
          direction: sortDirectionSchema,
        }),
      )
      .max(5),
  ])
  .default([]);

function parseSortString(raw: string): Array<{ field: string; direction: 'asc' | 'desc' }> {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((s) => {
      if (s.startsWith('-')) return { field: s.slice(1), direction: 'desc' as const };
      if (s.startsWith('+')) return { field: s.slice(1), direction: 'asc' as const };
      return { field: s, direction: 'asc' as const };
    });
}

export type SortInput = ReadonlyArray<{ field: string; direction: 'asc' | 'desc' }>;

/** Locale selector: `ru` or fallback chain `ru,en`. */
export const localeSchema = z
  .string()
  .min(2)
  .max(64)
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.string().min(2)).min(1).max(8));

/** Entry status selector. `*` is admin-only and resolved by the route. */
export const statusSchema = z
  .string()
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
  .pipe(
    z.array(
      z.enum(['draft', 'in_review', 'approved', 'published', 'archived', '*']),
    ),
  );

/** Comma-separated field projection, e.g. `id,title,author.name`. */
export const fieldsSchema = z
  .string()
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.string().min(1)).max(64));

/** Comma-separated populate spec. */
export const populateSchema = z
  .string()
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.string().min(1)).max(32));
