import type { FilterOperator, SortDirection, PageInput, Filter, Sort } from '@q-cms/core';

/**
 * Fluent builder for constructing API query parameters.
 *
 * Supports filtering, sorting, pagination, locale, field selection,
 * and eager-loading of relations.
 */
export class QueryBuilder {
  private _filters: Filter[] = [];
  private _sorts: Sort[] = [];
  private _page?: number;
  private _limit?: number;
  private _locale?: string;
  private _fields: string[] = [];
  private _include: string[] = [];

  /** Add a filter clause. */
  filter(field: string, operator: FilterOperator, value: unknown): this {
    this._filters.push({ field, operator, value });
    return this;
  }

  /** Add a sort clause. */
  sort(field: string, direction: SortDirection = 'asc'): this {
    this._sorts.push({ field, direction });
    return this;
  }

  /** Set the page number (1-indexed). */
  page(page: number): this {
    this._page = page;
    return this;
  }

  /** Set the number of items per page. */
  limit(limit: number): this {
    this._limit = limit;
    return this;
  }

  /** Set the locale for i18n content. */
  locale(locale: string): this {
    this._locale = locale;
    return this;
  }

  /** Select which fields to return (sparse fieldsets). */
  select(...fields: string[]): this {
    this._fields.push(...fields);
    return this;
  }

  /** Eager-load relations. */
  include(...relations: string[]): this {
    this._include.push(...relations);
    return this;
  }

  /**
   * Serialize the builder into {@link URLSearchParams}.
   * Returns `undefined` when no parameters have been set.
   */
  toSearchParams(): URLSearchParams | undefined {
    const params = new URLSearchParams();

    if (this._filters.length > 0) {
      params.set('filter', JSON.stringify(this._filters));
    }
    if (this._sorts.length > 0) {
      params.set('sort', JSON.stringify(this._sorts));
    }
    if (this._page !== undefined) {
      params.set('page', String(this._page));
    }
    if (this._limit !== undefined) {
      params.set('limit', String(this._limit));
    }
    if (this._locale !== undefined) {
      params.set('locale', this._locale);
    }
    if (this._fields.length > 0) {
      params.set('fields', this._fields.join(','));
    }
    if (this._include.length > 0) {
      params.set('include', this._include.join(','));
    }

    // Return undefined instead of empty URLSearchParams so the caller
    // can skip appending a `?`.
    const str = params.toString();
    return str ? params : undefined;
  }

  /** Build pagination input for APIs that accept the PageInput shape. */
  toPageInput(): PageInput | undefined {
    if (this._page === undefined && this._limit === undefined) return undefined;
    return {
      page: this._page ?? 1,
      limit: this._limit ?? 25,
    };
  }
}
