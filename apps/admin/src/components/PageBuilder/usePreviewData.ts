'use client';

/**
 * usePreviewData — loads the entries the block renderer needs
 * (articles, authors, categories) from the API client and returns a
 * stable `RenderContext.data` shape.
 *
 * The block specs in `@q-cms/templates` look up authors/articles/
 * categories by slug from `ctx.data`. Previously the in-builder
 * preview contexts (MiniPreview, Preview iframe) were hardcoded
 * with a single `slug: 'demo'` author, so any block that pointed at
 * a real slug (e.g. "sofia-volkova") rendered "Author not found."
 *
 * This hook fetches the real entries once per page load and caches
 * the result in module scope so multiple block cards share a single
 * request. If the entries API is unavailable we fall back to empty
 * arrays — the blocks render their own "not found" copy.
 */

import type {
  TemplateArticleRef,
  TemplateAuthorRef,
  TemplateCategoryRef,
} from '@q-cms/templates';
import { useEffect, useState } from 'react';
import { getApiClient } from '../../lib/api-client.ts';
import type { SdkEntry } from '../../lib/stubs/api-client.ts';

export interface PreviewData {
  articles: ReadonlyArray<TemplateArticleRef>;
  authors: ReadonlyArray<TemplateAuthorRef>;
  categories: ReadonlyArray<TemplateCategoryRef>;
}

const EMPTY: PreviewData = { articles: [], authors: [], categories: [] };

// Module-level cache so every block card in the page builder shares
// a single fetch. The cache is invalidated on full reload, which is
// the right granularity for a stub API.
let cached: PreviewData | null = null;
let inflight: Promise<PreviewData> | null = null;

function pickString(rec: unknown, key: string): string | null {
  if (!rec || typeof rec !== 'object') return null;
  const v = (rec as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : null;
}

async function loadPreviewData(): Promise<PreviewData> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const client = getApiClient();
      // The test mocks for `getApiClient` may not expose `entries`
      // at all, so guard each call individually rather than relying
      // on a Promise rejection.
      const articles = typeof client.entries === 'function' ? client.entries('articles') : null;
      const authors = typeof client.entries === 'function' ? client.entries('authors') : null;
      const categories = typeof client.entries === 'function' ? client.entries('categories') : null;
      const [articlesRes, authorsRes, categoriesRes] = await Promise.all([
        articles ? articles.list().catch(() => ({ data: [] as readonly SdkEntry[] })) : { data: [] as readonly SdkEntry[] },
        authors ? authors.list().catch(() => ({ data: [] as readonly SdkEntry[] })) : { data: [] as readonly SdkEntry[] },
        categories ? categories.list().catch(() => ({ data: [] as readonly SdkEntry[] })) : { data: [] as readonly SdkEntry[] },
      ]);
      const data: PreviewData = {
        articles: articlesRes.data.map(
          (e): TemplateArticleRef => ({
            id: e.id,
            slug: e.slug ?? '',
            title: pickString(e.data, 'title') ?? '',
            excerpt: pickString(e.data, 'excerpt') ?? '',
            body: pickString(e.data, 'body') ?? '',
            coverId: pickString(e.data, 'coverId'),
            authorId: pickString(e.data, 'authorId'),
            publishedAt: e.publishedAt,
          }),
        ),
        authors: authorsRes.data.map(
          (e): TemplateAuthorRef => ({
            id: e.id,
            slug: e.slug ?? '',
            name: pickString(e.data, 'name') ?? '',
            bio: pickString(e.data, 'bio') ?? '',
            avatarId: pickString(e.data, 'avatarId'),
          }),
        ),
        categories: categoriesRes.data.map(
          (e): TemplateCategoryRef => ({
            id: e.id,
            slug: e.slug ?? '',
            name: pickString(e.data, 'name') ?? '',
            description: pickString(e.data, 'description') ?? '',
          }),
        ),
      };
      cached = data;
      return data;
    } catch {
      return EMPTY;
    }
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function usePreviewData(): PreviewData {
  const [data, setData] = useState<PreviewData>(cached ?? EMPTY);
  useEffect(() => {
    let cancelled = false;
    void loadPreviewData().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}
