/**
 * JSON:API 1.1 serialization helpers.
 *
 * The Q-CMS API speaks a JSON:API-flavoured dialect. These helpers
 * shape resources and collections into the envelope described in
 * API.md §3.3.
 *
 * @module lib/jsonapi
 */

/** A single resource. */
export interface JsonApiResource<T = Record<string, unknown>> {
  id: string;
  type: string;
  attributes: T;
  relationships?: Record<string, JsonApiRelationship>;
  meta?: Record<string, unknown>;
}

/** A relationship block (data may be null, a single ref, or an array). */
export interface JsonApiRelationship {
  data: { id: string; type: string } | { id: string; type: string }[] | null;
  meta?: Record<string, unknown>;
}

/** Top-level single-resource envelope. */
export interface JsonApiSingleResponse<T = Record<string, unknown>> {
  data: JsonApiResource<T>;
  included?: JsonApiResource[];
  meta?: Record<string, unknown>;
}

/** Top-level collection envelope. */
export interface JsonApiCollectionResponse<T = Record<string, unknown>> {
  data: Array<JsonApiResource<T>>;
  included?: JsonApiResource[];
  meta?: {
    pageInfo?: {
      hasNext: boolean;
      hasPrev: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
    totalCount?: number;
    [k: string]: unknown;
  };
}

/** Top-level error envelope (API.md §3.4). */
export interface JsonApiErrorResponse {
  errors: Array<{
    id?: string;
    status: string;
    code: string;
    title: string;
    detail?: string;
    source?: { pointer?: string; parameter?: string };
    meta?: Record<string, unknown>;
  }>;
}

/**
 * Wrap a single domain object into a JSON:API resource.
 *
 * @param type - Resource type (e.g. `Article`, `User`).
 * @param id - Resource id.
 * @param attributes - Domain attributes (already JSON-safe).
 * @param opts - Optional `relationships`/`meta`/`included`.
 */
export function serializeResource(
  type: string,
  id: string,
  attributes: Record<string, unknown>,
  opts: {
    relationships?: Record<string, JsonApiRelationship>;
    meta?: Record<string, unknown>;
    included?: JsonApiResource[];
  } = {},
): JsonApiSingleResponse {
  const resource: JsonApiResource = { id, type, attributes };
  if (opts.relationships) resource.relationships = opts.relationships;
  if (opts.meta) resource.meta = opts.meta;

  const response: JsonApiSingleResponse = { data: resource };
  if (opts.included && opts.included.length > 0) response.included = opts.included;
  return response;
}

/**
 * Wrap a list of domain objects into a JSON:API collection envelope.
 *
 * @param type - Resource type.
 * @param items - Domain objects (must each have `id` and be JSON-safe).
 * @param opts - Optional page info / included / extra meta.
 */
export function serializeCollection<T extends { id: string }>(
  type: string,
  items: readonly T[],
  opts: {
    pageInfo?: JsonApiCollectionResponse['meta'] extends infer M
      ? M extends { pageInfo?: infer P }
        ? P
        : never
      : never;
    totalCount?: number | undefined;
    extraMeta?: Record<string, unknown>;
    included?: JsonApiResource[];
    toAttributes?: (item: T) => Record<string, unknown>;
  } = {},
): JsonApiCollectionResponse {
  const toAttrs = opts.toAttributes ?? ((item: T) => stripId(item as Record<string, unknown>));
  const data = items.map((item) => {
    const resource: JsonApiResource = {
      id: item.id,
      type,
      attributes: toAttrs(item),
    };
    return resource;
  });

  const response: JsonApiCollectionResponse = { data };
  if (opts.included && opts.included.length > 0) response.included = opts.included;
  if (opts.pageInfo || opts.totalCount !== undefined || opts.extraMeta) {
    response.meta = {};
    if (opts.pageInfo) response.meta['pageInfo'] = opts.pageInfo;
    if (opts.totalCount !== undefined) response.meta['totalCount'] = opts.totalCount;
    if (opts.extraMeta) Object.assign(response.meta, opts.extraMeta);
  }
  return response;
}

/**
 * Parse a JSON:API body, returning the primary resource (or `null` if
 * the request targets a collection-style write).
 */
export function parseResourceBody<T = Record<string, unknown>>(
  body: unknown,
): { type: string; id?: string; attributes: T; relationships?: Record<string, unknown>; meta?: Record<string, unknown> } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { data?: unknown };
  if (!b.data) return null;
  const data = b.data as { id?: string; type?: string; attributes?: T; relationships?: Record<string, unknown>; meta?: Record<string, unknown> };
  if (typeof data.type !== 'string') return null;
  return {
    type: data.type,
    ...(data.id !== undefined ? { id: data.id } : {}),
    attributes: (data.attributes ?? {}) as T,
    ...(data.relationships ? { relationships: data.relationships } : {}),
    ...(data.meta ? { meta: data.meta } : {}),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function stripId(item: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...rest } = item;
  return rest;
}
