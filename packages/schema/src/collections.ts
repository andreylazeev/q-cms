/**
 * Collection builder.
 *
 * The `collection()` function is a type-safe identity — it returns the
 * input unchanged but narrows the type to `CollectionConfig`. This gives
 * great autocomplete without runtime overhead.
 */

import type { FieldMap } from "./types.ts";

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

/** Single-field index: a field name or a composite tuple. */
export type CollectionIndex = string | readonly string[];

/** Configuration returned by the `collection()` builder. */
export interface CollectionConfig {
  /** Human-readable label shown in the admin UI. */
  title: string;
  /** URL-safe path segment (e.g. `"articles"`). */
  slug: string;
  /** Enable draft + publish workflow for this collection. */
  draftAndPublish?: boolean;
  /** Keep revision history for entries in this collection. */
  versioning?: boolean;
  /** Only a single entry exists (e.g. site settings). */
  singleton?: boolean;
  /** Field definitions. */
  fields: FieldMap;
  /** Database indexes (field names or composite tuples). */
  indexes?: readonly CollectionIndex[];
  /** Expose this collection in the admin UI (default: true). */
  admin?: boolean;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Define a collection.
 *
 * @example
 * ```ts
 * const Article = collection({
 *   title: "Article",
 *   slug: "articles",
 *   draftAndPublish: true,
 *   versioning: true,
 *   fields: { title: { type: "text", required: true } },
 * });
 * ```
 */
export function collection(config: CollectionConfig): CollectionConfig {
  return config;
}
