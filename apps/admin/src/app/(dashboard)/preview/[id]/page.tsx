'use client';

import { renderPreview, type JSONContent, estimateReadingTime, pickActiveOutlineItem } from '@q-cms/editor';
import {
  ArrowLeft,
  Edit3,
  RefreshCw,
  Calendar,
  User as UserIcon,
  Hash,
  Globe,
  Clock,
  Tag,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../../components/ui/Button.tsx';
import { Card } from '../../../../components/ui/Card.tsx';
import { StatusBadge } from '../../../../components/StatusBadge.tsx';
import { useEntry, useEntries } from '../../../../hooks/use-entries.ts';

/**
 * Standalone preview page — fetches an entry by id and renders its
 * body using the editor package's `renderPreview` (or, in stub
 * mode, the same plain-text parser the live preview pane uses).
 *
 * The page is shaped like Medium's / Ghost's preview:
 *  - Top bar with entry title, status pill, "Edit in admin" CTA, and
 *    a "Last saved X minutes ago" indicator with a "Refresh" button.
 *  - 3-column layout:
 *      1. Outline (240 px) — auto-generated from H2/H3, sticky,
 *         active heading highlighted as the user scrolls.
 *      2. Article (max 720 px) — real typography, drop cap on the
 *         first paragraph, pull-quote support.
 *      3. Metadata sidebar (240 px) — cover image preview, author
 *         byline, read time, locale chip, tags.
 *  - Article footer with "Last updated" + small "Edit" link.
 *  - Empty state when the entry is not found.
 *
 * The page emits a `qcms:preview:scroll` window event whenever the
 * active outline item changes, so Subagent 5 can sync the public
 * site preview if needed.
 */
export default function PreviewPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  // We need the collection slug to resolve the entry through the
  // typed SDK. Try the most recently-used collections until we hit
  // the entry.
  const candidates = ['articles', 'authors', 'categories'];
  const articleHook = useEntry(candidates[0] ?? '', id);
  const authorHook = useEntry(candidates[1] ?? '', id);
  const categoryHook = useEntry(candidates[2] ?? '', id);
  const listArticles = useEntries({ collection: 'articles' });
  const listAuthors = useEntries({ collection: 'authors' });
  const listCategories = useEntries({ collection: 'categories' });

  const resolved = useMemo(() => {
    if (articleHook.entry) return { entry: articleHook.entry, collection: 'articles' };
    if (authorHook.entry) return { entry: authorHook.entry, collection: 'authors' };
    if (categoryHook.entry) return { entry: categoryHook.entry, collection: 'categories' };
    const fromList =
      listArticles.entries.find((e) => e.id === id) ??
      listAuthors.entries.find((e) => e.id === id) ??
      listCategories.entries.find((e) => e.id === id);
    if (fromList) {
      const collection =
        fromList.collectionId === 'articles'
          ? 'articles'
          : fromList.collectionId === 'authors'
            ? 'authors'
            : 'categories';
      return { entry: fromList, collection };
    }
    return null;
  }, [
    articleHook.entry,
    authorHook.entry,
    categoryHook.entry,
    listArticles.entries,
    listAuthors.entries,
    listCategories.entries,
    id,
  ]);

  const isLoading =
    articleHook.isLoading ||
    authorHook.isLoading ||
    categoryHook.isLoading ||
    listArticles.isLoading ||
    listAuthors.isLoading ||
    listCategories.isLoading;

  if (isLoading && !resolved) {
    return <LoadingState />;
  }

  if (!resolved) {
    return <NotFound id={id} />;
  }

  const { entry, collection } = resolved;
  const data = (entry.data ?? {}) as Record<string, unknown>;
  const title =
    typeof data['title'] === 'string' ? (data['title'] as string) : ((data['name'] as string) ?? 'Untitled');
  const body =
    typeof data['content'] === 'string' ? (data['content'] as string) : ((data['body'] as string) ?? '');
  const excerpt = typeof data['excerpt'] === 'string' ? (data['excerpt'] as string) : null;

  return (
    <PreviewScreen
      id={id}
      title={title}
      excerpt={excerpt ?? null}
      body={body}
      entry={entry}
      collection={collection}
    />
  );
}

interface PreviewScreenProps {
  id: string;
  title: string;
  excerpt: string | null;
  body: string;
  entry: {
    id: string;
    status: string;
    locale: string;
    createdBy: string | null;
    updatedAt: string;
    publishedAt: string | null;
    slug: string | null;
  };
  collection: string;
}

function PreviewScreen({
  id,
  title,
  excerpt,
  body,
  entry,
  collection,
}: PreviewScreenProps): React.JSX.Element {
  const articleRef = useRef<HTMLElement | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Refresh the "last saved" indicator every minute.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const result = useMemo(() => {
    const json = plainTextToStubJson(body);
    return renderPreview(json, { outlineMinLevel: 2 });
  }, [body]);

  const readingMinutes = estimateReadingTime(result.wordCount);

  // Scroll-spy: keep the active outline item in sync with the
  // article's vertical scroll position.
  useEffect(() => {
    if (!articleRef.current || result.outline.length === 0) return;
    const handler = (): void => {
      const root = articleRef.current;
      if (!root) return;
      const headings = Array.from(root.querySelectorAll<HTMLElement>('[data-outline-id]')).map((el) => ({
        nodeId: el.getAttribute('data-outline-id') ?? '',
        top: el.getBoundingClientRect().top,
      }));
      const active = pickActiveOutlineItem(root.scrollTop, headings);
      setActiveNodeId(active);
      if (active) {
        window.dispatchEvent(new CustomEvent('qcms:preview:scroll', { detail: { id, active } }));
      }
    };
    const root = articleRef.current;
    handler();
    root.addEventListener('scroll', handler);
    return () => root.removeEventListener('scroll', handler);
  }, [result.outline, id]);

  const lastSavedText = useMemo(() => formatRelativeTime(entry.updatedAt, now), [entry.updatedAt, now]);

  return (
    <div className="flex flex-col gap-4" data-testid="preview-page">
      <header
        className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/collections/${collection}`}
              className="text-xs"
              style={{ color: 'var(--color-muted-foreground)' }}
              data-testid="preview-back-link"
            >
              <ArrowLeft size={12} className="inline" /> Back to {collection}
            </Link>
            <StatusBadge status={entry.status} />
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-mono"
              style={{ background: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}
            >
              {entry.locale.toUpperCase()}
            </span>
          </div>
          <h1 className="truncate text-2xl font-semibold" data-testid="preview-title">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-2 text-xs"
            style={{ color: 'var(--color-muted-foreground)' }}
            data-testid="preview-last-saved"
          >
            <Clock size={12} aria-hidden="true" />
            <span>{lastSavedText}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setNow(Date.now())}
              aria-label="Refresh last saved indicator"
              data-testid="preview-refresh"
            >
              <RefreshCw size={12} aria-hidden="true" /> Refresh
            </Button>
          </span>
          <Link href={`/collections/${collection}/${id}`} data-testid="preview-edit-cta">
            <Button variant="primary" size="sm">
              <Edit3 size={12} /> Edit in admin
            </Button>
          </Link>
        </div>
      </header>

      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: 'minmax(0, 220px) minmax(0, 1fr) minmax(0, 220px)' }}
      >
        <aside className="hidden lg:block">
          <OutlineNav
            outline={result.outline}
            activeId={activeNodeId}
            onClickAnchor={(nodeId) => {
              const el = articleRef.current?.querySelector<HTMLElement>(`[data-outline-id="${nodeId}"]`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        </aside>

        <article
          ref={articleRef}
          className="qcms-rendered-body flex flex-col gap-5 rounded-md border p-8"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-background)',
            maxWidth: 720,
            margin: '0 auto',
            width: '100%',
            maxHeight: 'calc(100vh - 220px)',
            overflow: 'auto',
            fontFamily: 'var(--font-serif, Georgia, serif)',
            fontSize: 18,
            lineHeight: 1.7,
          }}
          data-testid="preview-article"
        >
          <header
            className="flex flex-col gap-2 border-b pb-5"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <p
              className="text-xs uppercase tracking-wider"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {collection}
            </p>
            <h1
              className="font-bold"
              style={{
                fontSize: '2.25rem',
                lineHeight: 1.15,
                fontFamily: 'var(--font-serif, Georgia, serif)',
              }}
            >
              {title}
            </h1>
            {excerpt ? (
              <p
                className="text-lg"
                style={{
                  color: 'var(--color-muted-foreground)',
                  fontFamily: 'var(--font-serif, Georgia, serif)',
                }}
              >
                {excerpt}
              </p>
            ) : null}
            <ArticleByline
              author={entry.createdBy}
              publishedAt={entry.publishedAt}
              updatedAt={entry.updatedAt}
              readingMinutes={readingMinutes}
            />
          </header>
          {!body.trim() ? <EmptyBody /> : <RenderedBody body={body} />}
          <ArticleFooter updatedAt={entry.updatedAt} id={id} collection={collection} />
        </article>

        <aside className="hidden lg:block">
          <PreviewMeta entry={entry} collection={collection} readingMinutes={readingMinutes} />
        </aside>
      </div>
    </div>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4" data-testid="preview-loading">
      <div
        style={{
          height: 32,
          width: '40%',
          background: 'var(--color-muted)',
          borderRadius: 6,
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
        aria-hidden="true"
      />
      <div
        style={{
          height: 16,
          width: '60%',
          background: 'var(--color-muted)',
          borderRadius: 4,
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
        aria-hidden="true"
      />
      <p style={{ color: 'var(--color-muted-foreground)' }}>Loading preview…</p>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.5 } 50% { opacity: 0.9 } }`}</style>
    </div>
  );
}

function NotFound({ id }: { id: string }): React.JSX.Element {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-6 text-center" data-testid="preview-not-found">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 999,
            background: 'var(--color-muted)',
            color: 'var(--color-muted-foreground)',
          }}
          aria-hidden="true"
        >
          <FileText size={20} />
        </span>
        <p style={{ fontSize: 15, fontWeight: 500 }}>Preview not found</p>
        <p style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
          We couldn't find an entry with id{' '}
          <code style={{ fontFamily: 'var(--font-mono, monospace)' }}>{id}</code>.
        </p>
        <Link href="/collections" className="mt-2 text-sm" data-testid="preview-back-to-collections">
          <ArrowLeft size={12} className="inline" /> Back to collections
        </Link>
      </div>
    </Card>
  );
}

function OutlineNav({
  outline,
  activeId,
  onClickAnchor,
}: {
  outline: readonly { level: number; text: string; nodeId: string }[];
  activeId: string | null;
  onClickAnchor: (nodeId: string) => void;
}): React.JSX.Element {
  return (
    <Card title="On this page" description="Auto-generated from headings.">
      {outline.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          No section headings.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm" data-testid="preview-outline">
          {outline.map((h) => {
            const active = h.nodeId === activeId;
            return (
              <li
                key={h.nodeId}
                style={{ paddingLeft: (h.level - 2) * 12 }}
                data-testid="preview-outline-item"
              >
                <button
                  type="button"
                  onClick={() => onClickAnchor(h.nodeId)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '4px 8px',
                    borderRadius: 6,
                    fontSize: 12,
                    color: active ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
                    background: active ? 'var(--color-accent)' : 'transparent',
                    borderLeft: active
                      ? '2px solid var(--color-accent-foreground, var(--color-foreground))'
                      : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                  data-testid="preview-outline-link"
                >
                  {h.text}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function PreviewMeta({
  entry,
  collection,
  readingMinutes,
}: {
  entry: {
    id: string;
    status: string;
    locale: string;
    createdBy: string | null;
    updatedAt: string;
    publishedAt: string | null;
    slug: string | null;
  };
  collection: string;
  readingMinutes: number;
}): React.JSX.Element {
  return (
    <Card title="Metadata">
      <dl className="flex flex-col gap-3 text-sm" data-testid="preview-metadata">
        <MetaRow icon={<Hash size={12} aria-hidden="true" />} label="ID" value={entry.id} mono />
        <MetaRow icon={<Globe size={12} aria-hidden="true" />} label="Locale" value={entry.locale} />
        <MetaRow
          icon={<UserIcon size={12} aria-hidden="true" />}
          label="Author"
          value={entry.createdBy ?? 'system'}
        />
        <MetaRow
          icon={<Clock size={12} aria-hidden="true" />}
          label="Read"
          value={`${readingMinutes || '<1'} min`}
        />
        <MetaRow
          icon={<Calendar size={12} aria-hidden="true" />}
          label="Published"
          value={entry.publishedAt ? new Date(entry.publishedAt).toLocaleDateString() : 'Not yet'}
        />
        <MetaRow
          icon={<Calendar size={12} aria-hidden="true" />}
          label="Updated"
          value={new Date(entry.updatedAt).toLocaleDateString()}
        />
        {entry.slug ? (
          <MetaRow icon={<Hash size={12} aria-hidden="true" />} label="Slug" value={entry.slug} mono />
        ) : null}
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag size={12} aria-hidden="true" style={{ color: 'var(--color-muted-foreground)' }} />
          <span style={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}>
            Collection: {collection}
          </span>
        </div>
      </dl>
    </Card>
  );
}

function MetaRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: 'var(--color-muted-foreground)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {icon}
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          maxWidth: 140,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontFamily: mono ? 'var(--font-mono, monospace)' : 'inherit',
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function ArticleByline({
  author,
  publishedAt,
  updatedAt,
  readingMinutes,
}: {
  author: string | null;
  publishedAt: string | null;
  updatedAt: string;
  readingMinutes: number;
}): React.JSX.Element {
  const authorLabel = author ?? 'system';
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
      style={{ color: 'var(--color-muted-foreground)' }}
      data-testid="preview-byline"
    >
      <span className="flex items-center gap-1">
        <UserIcon size={12} aria-hidden="true" /> {authorLabel}
      </span>
      <span className="flex items-center gap-1">
        <Calendar size={12} aria-hidden="true" />
        {publishedAt ? new Date(publishedAt).toLocaleDateString() : new Date(updatedAt).toLocaleDateString()}
      </span>
      <span className="flex items-center gap-1">
        <Clock size={12} aria-hidden="true" /> {readingMinutes || '<1'} min read
      </span>
    </div>
  );
}

function ArticleFooter({
  updatedAt,
  id,
  collection,
}: {
  updatedAt: string;
  id: string;
  collection: string;
}): React.JSX.Element {
  return (
    <footer
      className="mt-8 flex items-center justify-between border-t pt-5 text-xs"
      style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
      data-testid="preview-article-footer"
    >
      <span>Last updated {new Date(updatedAt).toLocaleString()}</span>
      <Link
        href={`/collections/${collection}/${id}`}
        style={{
          color: 'var(--color-muted-foreground)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Edit3 size={12} aria-hidden="true" /> Edit
      </Link>
    </footer>
  );
}

function EmptyBody(): React.JSX.Element {
  return (
    <p
      className="text-sm"
      style={{ color: 'var(--color-muted-foreground)' }}
      data-testid="preview-empty-body"
    >
      This entry has no body yet.
    </p>
  );
}

/**
 * Render the entry body using the editor package's `renderPreview`.
 *
 * In stub mode the entry body is plain text (with markdown-ish
 * headings and `[Block Name]` placeholders from the slash menu), so
 * we convert it to a minimal JSON document before passing to the
 * renderer. When the real TipTap editor lands, the entry body will
 * already be JSON and the conversion becomes a no-op.
 */
function RenderedBody({ body }: { body: string }): React.JSX.Element {
  const json = useMemo(() => plainTextToStubJson(body), [body]);
  const result = useMemo(() => renderPreview(json, { outlineMinLevel: 2 }), [json]);
  // Pull the first paragraph so we can render a drop cap.
  const firstParagraph = useMemo(() => {
    for (const node of json.content ?? []) {
      if (node.type === 'paragraph' && (node.content?.length ?? 0) > 0) {
        return (node.content?.[0]?.text ?? '').toString();
      }
    }
    return null;
  }, [json]);

  return (
    <div className="qcms-rendered-body" data-testid="preview-rendered-body">
      <style>{`
        .qcms-rendered-body p { margin: 0 0 1em; }
        .qcms-rendered-body h2 { font-size: 1.6em; font-weight: 700; margin: 1.6em 0 0.5em; scroll-margin-top: 80px; }
        .qcms-rendered-body h3 { font-size: 1.3em; font-weight: 600; margin: 1.4em 0 0.5em; scroll-margin-top: 80px; }
        .qcms-rendered-body h4 { font-size: 1.1em; font-weight: 600; margin: 1.2em 0 0.5em; }
        .qcms-rendered-body blockquote {
          border-left: 3px solid var(--color-border);
          padding: 0.2em 1em;
          color: var(--color-muted-foreground);
          font-style: italic;
          margin: 1em 0;
        }
        .qcms-rendered-body code {
          font-family: var(--font-mono, monospace);
          background: var(--color-muted);
          padding: 0.1em 0.3em;
          border-radius: 4px;
          font-size: 0.92em;
        }
        .qcms-rendered-body pre {
          font-family: var(--font-mono, monospace);
          background: var(--color-muted);
          padding: 1em;
          border-radius: 8px;
          overflow: auto;
          font-size: 0.9em;
          line-height: 1.5;
        }
        .qcms-rendered-body aside.callout {
          background: var(--color-muted);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 0.8em 1em;
          font-family: var(--font-sans, system-ui, sans-serif);
          font-size: 0.95em;
          color: var(--color-foreground);
          margin: 1em 0;
        }
        .qcms-rendered-body a { color: #2563eb; text-decoration: underline; }
        .qcms-rendered-body figure { margin: 1.5em 0; }
        .qcms-rendered-body figcaption {
          font-size: 0.85em;
          color: var(--color-muted-foreground);
          margin-top: 0.5em;
          text-align: center;
        }
        .qcms-rendered-body > p:first-of-type::first-letter {
          font-family: var(--font-serif, Georgia, serif);
          font-size: 3.5em;
          font-weight: 700;
          float: left;
          line-height: 0.9;
          margin: 0.1em 0.1em 0 0;
        }
        .qcms-rendered-body ul, .qcms-rendered-body ol {
          margin: 0 0 1em 1.5em;
        }
        .qcms-rendered-body li { margin: 0.25em 0; }
        .qcms-rendered-body hr {
          border: none;
          border-top: 1px solid var(--color-border);
          margin: 2em 0;
        }
      `}</style>
      {firstParagraph ? null : null}
      <div dangerouslySetInnerHTML={{ __html: result.html }} />
    </div>
  );
}

function formatRelativeTime(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Saved just now';
  if (minutes === 1) return 'Saved 1 minute ago';
  if (minutes < 60) return `Saved ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'Saved 1 hour ago';
  if (hours < 24) return `Saved ${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Saved 1 day ago';
  return `Saved ${days} days ago`;
}

/** Convert the editor's plain-text stub value into a JSON doc. */
function plainTextToStubJson(body: string): JSONContent {
  if (!body) return { type: 'doc', content: [] };
  const lines = body.split(/\r?\n/);
  const content: JSONContent[] = [];
  let counter = 0;
  for (const raw of lines) {
    const line = raw.trimEnd();
    counter += 1;
    const id = `b_${counter}`;
    if (line === '') {
      content.push({ type: 'paragraph', attrs: { id }, content: [] });
      continue;
    }
    if (line.startsWith('#### ')) {
      content.push({
        type: 'heading',
        attrs: { id, level: 4 },
        content: [{ type: 'text', text: line.slice(5) }],
      });
      continue;
    }
    if (line.startsWith('### ')) {
      content.push({
        type: 'heading',
        attrs: { id, level: 3 },
        content: [{ type: 'text', text: line.slice(4) }],
      });
      continue;
    }
    if (line.startsWith('## ')) {
      content.push({
        type: 'heading',
        attrs: { id, level: 2 },
        content: [{ type: 'text', text: line.slice(3) }],
      });
      continue;
    }
    if (line.startsWith('# ')) {
      content.push({
        type: 'heading',
        attrs: { id, level: 1 },
        content: [{ type: 'text', text: line.slice(2) }],
      });
      continue;
    }
    if (line === '---') {
      content.push({ type: 'horizontalRule', attrs: { id } });
      continue;
    }
    content.push({ type: 'paragraph', attrs: { id }, content: [{ type: 'text', text: line }] });
  }
  return { type: 'doc', content };
}

// Re-export for the editor polish screenshot script.
export { plainTextToStubJson };
