/**
 * Search service — Meilisearch wrapper.
 *
 * Provides the minimal surface used by the API:
 *   - `index(collection, doc)` / `delete(collection, id)`
 *   - `search(query)` for the public search endpoint
 *
 * Falls back to a deterministic in-memory implementation when no
 * Meilisearch URL is configured (so tests and dev work offline).
 *
 * @module services/search
 */

import { getEnv } from '../env.ts';

export interface SearchDoc {
  id: string;
  collection: string;
  locale: string;
  title?: string;
  content?: string;
  [k: string]: unknown;
}

export interface SearchHit {
  id: string;
  collection: string;
  locale: string;
  score: number;
  title?: string;
  snippet?: string;
  attributes: Record<string, unknown>;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  processingTimeMs: number;
}

export interface SearchService {
  index(collection: string, doc: SearchDoc): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  search(query: {
    q: string;
    collection?: string;
    locale?: string;
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
  }): Promise<SearchResult>;
  close(): Promise<void>;
}

class MemorySearch implements SearchService {
  private docs = new Map<string, SearchDoc>();
  async index(_collection: string, doc: SearchDoc): Promise<void> {
    this.docs.set(`${doc.collection}:${doc.id}`, doc);
  }
  async delete(collection: string, id: string): Promise<void> {
    this.docs.delete(`${collection}:${id}`);
  }
  async search(query: {
    q: string;
    collection?: string;
    locale?: string;
    limit?: number;
    offset?: number;
  }): Promise<SearchResult> {
    const start = Date.now();
    const needle = query.q.toLowerCase();
    let results = [...this.docs.values()];
    if (query.collection) results = results.filter((d) => d.collection === query.collection);
    if (query.locale) results = results.filter((d) => d.locale === query.locale);
    if (needle) {
      results = results.filter((d) =>
        [d.title, d.content, JSON.stringify(d['attributes'])]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(needle)),
      );
    }
    const total = results.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;
    const slice = results.slice(offset, offset + limit);
    const hits: SearchHit[] = slice.map((d) => ({
      id: d.id,
      collection: d.collection,
      locale: d.locale,
      score: 1,
      ...(d.title ? { title: d.title } : {}),
      ...(d.content ? { snippet: d.content.slice(0, 200) } : {}),
      attributes: { ...d },
    }));
    return { hits, total, processingTimeMs: Date.now() - start };
  }
  async close(): Promise<void> {
    this.docs.clear();
  }
}

class MeiliSearch implements SearchService {
  private baseUrl: string;
  private apiKey: string;
  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }
  private async fetchJson(path: string, init?: RequestInit): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`Meili ${path} failed: ${res.status}`);
    return res.json();
  }
  async index(collection: string, doc: SearchDoc): Promise<void> {
    await this.fetchJson(`/indexes/${collection}/documents`, {
      method: 'POST',
      body: JSON.stringify([doc]),
    });
  }
  async delete(collection: string, id: string): Promise<void> {
    await this.fetchJson(`/indexes/${collection}/documents/${id}`, { method: 'DELETE' });
  }
  async search(query: {
    q: string;
    collection?: string;
    locale?: string;
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
  }): Promise<SearchResult> {
    if (!query.collection) throw new Error('collection is required for Meili search');
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const start = Date.now();
    const data = (await this.fetchJson(`/indexes/${query.collection}/search`, {
      method: 'POST',
      body: JSON.stringify({
        q: query.q,
        limit,
        offset,
        ...(query.filter ? { filter: query.filter } : {}),
      }),
    })) as { hits: Array<Record<string, unknown>>; estimatedTotalHits: number };
    const hits: SearchHit[] = data.hits.map((h) => ({
      id: String(h['id'] ?? ''),
      collection: query.collection ?? '',
      locale: query.locale ?? '',
      score: 1,
      ...(typeof h['title'] === 'string' ? { title: h['title'] as string } : {}),
      attributes: h,
    }));
    return { hits, total: data.estimatedTotalHits, processingTimeMs: Date.now() - start };
  }
  async close(): Promise<void> {
    // No persistent connection to close for fetch-based client.
  }
}

let cached: SearchService | undefined;

export function getSearch(): SearchService {
  if (cached) return cached;
  const env = getEnv();
  if (env.MEILI_URL && env.MEILI_MASTER_KEY) {
    cached = new MeiliSearch(env.MEILI_URL, env.MEILI_MASTER_KEY);
  } else {
    cached = new MemorySearch();
  }
  return cached;
}

export function setSearch(svc: SearchService): void {
  cached = svc;
}

export async function closeSearch(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = undefined;
  }
}
