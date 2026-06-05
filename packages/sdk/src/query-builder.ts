/**
 * Fluent, chainable query builder for Q-CMS entries.
 *
 * A {@link QueryBuilder} is created by `client.entries(slug)`. It
 * accumulates filter / populate / sort / pagination state as you
 * chain methods, then translates the final state into a URL when
 * `.get()`, `.getOne()`, etc. are invoked.
 *
 * @module query-builder
 */

import type {
  EntryStatus,
  Locale,
  PageInfo,
  Paginated,
  QcmsFilter,
  QcmsFilterObject,
  QcmsPopulateSpec,
  QcmsSortClause,
  QcmsWhereClause,
  SdkEntry,
} from './types.ts';

// ---------------------------------------------------------------------------
// Public shape
// ---------------------------------------------------------------------------

/** Operations supported by the query builder. */
export interface QueryExecutor {
  /** Execute a GET against the collection's list endpoint. */
  list(
    path: string,
    query: Record<string, string>,
  ): Promise<{ data: SdkEntry[]; page: PageInfo; total: number | null }>;
  /** Execute a GET against a single resource. */
  get(path: string, query: Record<string, string>): Promise<SdkEntry>;
  /** Execute a POST to create. */
  create(path: string, body: unknown): Promise<SdkEntry>;
  /** Execute a PATCH to update. */
  update(path: string, body: unknown): Promise<SdkEntry>;
  /** Execute a DELETE. */
  delete(path: string): Promise<void>;
  /** POST to /publish. */
  post(path: string, body?: unknown): Promise<SdkEntry>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default page size for `.get()`. */
const DEFAULT_LIMIT = 20;
/** Hard cap to prevent runaway responses. */
const MAX_LIMIT = 100;

/**
 * Flatten a free-form filter object into the typed {@link QcmsFilter}
 * representation. Strings/booleans/numbers become `eq`; nested
 * objects are treated as `{ op: value }` (e.g. `{ contains: 'hi' }`).
 */
function flattenFilters(
  where: readonly QcmsWhereClause[] | undefined,
): QcmsFilter[] {
  if (!where || where.length === 0) return [];
  const out: QcmsFilter[] = [];
  for (const clause of where) {
    if (typeof clause === 'string') {
      out.push({ field: '$raw', op: 'eq', value: clause });
      continue;
    }
    const objClause = clause as { field?: unknown; op?: unknown };
    if (typeof objClause.field === 'string' && typeof objClause.op === 'string') {
      out.push(objClause as unknown as QcmsFilter);
      continue;
    }
    for (const [field, value] of Object.entries(clause as QcmsFilterObject)) {
      if (value === null) {
        out.push({ field, op: 'isNull' });
        continue;
      }
      if (typeof value === 'object' && !Array.isArray(value)) {
        for (const [op, opValue] of Object.entries(value as Record<string, unknown>)) {
          out.push({ field, op: op as QcmsFilter['op'], value: opValue });
        }
        continue;
      }
      if (Array.isArray(value)) {
        out.push({ field, op: 'in', value });
        continue;
      }
      out.push({ field, op: 'eq', value });
    }
  }
  return out;
}

/** Serialize filters to the `filter[…]=[op.]value` RQL shape. */
function serializeFilters(filters: readonly QcmsFilter[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i]!;
    if (f.field === '$raw' && typeof f.value === 'string') {
      // Pass through raw RQL: caller is responsible for formatting.
      result[`_raw_${i}`] = f.value;
      continue;
    }
    const key = `filter[${f.field}]`;
    if (f.op === 'isNull' || f.op === 'isNotNull') {
      result[key] = f.op;
      continue;
    }
    const value = Array.isArray(f.value) ? f.value.join(',') : String(f.value);
    result[key] = f.op === 'eq' ? value : `${f.op}.${value}`;
  }
  return result;
}

/** Serialize populate — comma-joined field paths by default. */
function serializePopulate(populate: readonly (string | QcmsPopulateSpec)[]): string {
  return populate
    .map((p) => (typeof p === 'string' ? p : p.field))
    .join(',');
}

/** Serialize sort — `-field` for desc, `field` for asc. */
function serializeSort(sort: readonly (string | QcmsSortClause)[]): string {
  return sort
    .map((s) => (typeof s === 'string' ? s : `${s.direction === 'desc' ? '-' : ''}${s.field}`))
    .join(',');
}

/** Encode a status union. */
function serializeStatus(status: EntryStatus | readonly EntryStatus[] | undefined): string | undefined {
  if (!status) return undefined;
  if (Array.isArray(status)) {
    return (status as readonly EntryStatus[]).slice().join(',');
  }
  return status as string;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Mutable builder used by {@link QcmsClient.entries}. Every chain
 * method returns `this` for fluent composition.
 */
export class QueryBuilder<T extends SdkEntry = SdkEntry> {
  private readonly _filters: QcmsFilter[] = [];
  private _populate: (string | QcmsPopulateSpec)[] = [];
  private _fields: string[] = [];
  private _sort: (string | QcmsSortClause)[] = [];
  private _limit: number = DEFAULT_LIMIT;
  private _offset: number | undefined;
  private _cursor: string | undefined;
  private _locale: Locale | string | undefined;
  private _status: EntryStatus | readonly EntryStatus[] | undefined;
  private _withTotal = false;

  constructor(
    private readonly collectionSlug: string,
    private readonly executor: QueryExecutor,
    defaultLocale: Locale | string | undefined,
  ) {
    this._locale = defaultLocale;
  }

  // -------------------------------------------------------------------------
  // Chainable setters
  // -------------------------------------------------------------------------

  /** Add a where clause (filter). Chainable; multiple calls accumulate. */
  where(filter: QcmsWhereClause): this {
    this._filters.push(...flattenFilters([filter]));
    return this;
  }

  /** Set populate relations. Replaces any previous value. */
  populate(spec: readonly (string | QcmsPopulateSpec)[]): this {
    this._populate = [...spec];
    return this;
  }

  /** Set fields projection. Replaces any previous value. */
  fields(spec: readonly string[]): this {
    this._fields = [...spec];
    return this;
  }

  /** Set sort order. Use `-field` for desc or pass a typed object. */
  sort(spec: string | readonly (string | QcmsSortClause)[]): this {
    this._sort = Array.isArray(spec) ? [...spec] : [spec];
    return this;
  }

  /** Maximum number of records to return. */
  limit(n: number): this {
    this._limit = Math.max(1, Math.min(MAX_LIMIT, Math.trunc(n)));
    return this;
  }

  /** Offset for legacy offset-based pagination. */
  offset(n: number): this {
    this._offset = Math.max(0, Math.trunc(n));
    this._cursor = undefined;
    return this;
  }

  /** Cursor for cursor-based pagination. */
  cursor(c: string): this {
    this._cursor = c;
    this._offset = undefined;
    return this;
  }

  /** Override the locale for this query. */
  locale(l: Locale | string): this {
    this._locale = l;
    return this;
  }

  /** Restrict returned entries to specific status values. */
  status(s: EntryStatus | readonly EntryStatus[]): this {
    this._status = s;
    return this;
  }

  /** Ask the server to include a `totalCount` (costly COUNT(*)). */
  withTotal(): this {
    this._withTotal = true;
    return this;
  }

  // -------------------------------------------------------------------------
  // Terminal operations
  // -------------------------------------------------------------------------

  /** Materialize the current state into a URL query string. */
  protected buildQuery(): Record<string, string> {
    const q: Record<string, string> = { ...serializeFilters(this._filters) };
    if (this._populate.length > 0) q['populate'] = serializePopulate(this._populate);
    if (this._fields.length > 0) q['fields'] = this._fields.join(',');
    if (this._sort.length > 0) q['sort'] = serializeSort(this._sort);
    q['page[limit]'] = String(this._limit);
    if (this._cursor) q['page[cursor]'] = this._cursor;
    if (this._offset !== undefined) q['page[offset]'] = String(this._offset);
    if (this._locale) q['locale'] = String(this._locale);
    const status = serializeStatus(this._status);
    if (status) q['status'] = status;
    if (this._withTotal) q['page[withTotal]'] = 'true';
    return q;
  }

  /** Return the path used for collection-level operations. */
  protected collectionPath(): string {
    return `/collections/${encodeURIComponent(this.collectionSlug)}/entries`;
  }

  /** Encode a resource id (or slug) for the URL. */
  protected encodeId(id: string): string {
    return encodeURIComponent(id);
  }

  /** Execute the query and return a paginated envelope. */
  async get(): Promise<Paginated<T>> {
    const response = await this.executor.list(this.collectionPath(), this.buildQuery());
    return {
      data: response.data as unknown as readonly T[],
      meta: {
        pageInfo: response.page,
        totalCount: response.total ?? response.data.length,
      },
    };
  }

  /**
   * Execute the query and return exactly one entry.
   *
   * @throws {@link QcmsValidationError} if zero or 2+ entries are returned.
   */
  async getOne(): Promise<T> {
    // Force limit=2 so we can detect 0 / 2+ without over-fetching.
    this._limit = 2;
    const result = await this.get();
    if (result.data.length === 0) {
      throw new Error(
        `QueryBuilder.getOne(): no entry matched the filter for collection "${this.collectionSlug}"`,
      );
    }
    if (result.data.length > 1) {
      throw new Error(
        `QueryBuilder.getOne(): expected exactly one entry, got ${result.data.length}. ` +
          `Tighten your .where() clause.`,
      );
    }
    return result.data[0] as T;
  }

  /** Create a new entry. */
  async create(data: Partial<T['data']>): Promise<T> {
    const created = await this.executor.create(this.collectionPath(), { data });
    return created as T;
  }

  /** Update an existing entry by id. */
  async update(id: string, data: Partial<T['data']>): Promise<T> {
    const updated = await this.executor.update(
      `${this.collectionPath()}/${this.encodeId(id)}`,
      { data },
    );
    return updated as T;
  }

  /** Delete an entry by id. */
  async delete(id: string): Promise<void> {
    await this.executor.delete(`${this.collectionPath()}/${this.encodeId(id)}`);
  }

  /** Publish an entry by id. */
  async publish(id: string): Promise<T> {
    const result = await this.executor.post(
      `${this.collectionPath()}/${this.encodeId(id)}/publish`,
    );
    return result as T;
  }

  /** Unpublish an entry by id. */
  async unpublish(id: string): Promise<T> {
    const result = await this.executor.post(
      `${this.collectionPath()}/${this.encodeId(id)}/unpublish`,
    );
    return result as T;
  }

  /** Duplicate an entry by id. The duplicate is created as a draft. */
  async duplicate(id: string): Promise<T> {
    const result = await this.executor.post(
      `${this.collectionPath()}/${this.encodeId(id)}/duplicate`,
    );
    return result as T;
  }
}
