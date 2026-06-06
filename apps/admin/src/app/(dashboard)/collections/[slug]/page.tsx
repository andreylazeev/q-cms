'use client';

import type { EntryStatus } from '@q-cms/core';
import { useI18n } from '@q-cms/i18n/react';
import {
  Copy as CopyIcon,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Search as SearchIcon,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { StatusBadge } from '../../../../components/StatusBadge.tsx';
import { Button } from '../../../../components/ui/Button.tsx';
import { Card } from '../../../../components/ui/Card.tsx';
import { Input } from '../../../../components/ui/Input.tsx';
import { useDeleteEntry, useEntries } from '../../../../hooks/use-entries.ts';

interface FilterChip {
  id: string;
  key: string;
  match: (s: EntryStatus | '' | undefined) => boolean;
}

const FILTER_CHIPS: readonly FilterChip[] = [
  { id: 'all', key: 'filterAll', match: () => true },
  { id: 'published', key: 'filterPublished', match: (s) => s === 'published' },
  { id: 'in_review', key: 'filterInReview', match: (s) => s === 'in_review' },
  { id: 'draft', key: 'filterDraft', match: (s) => s === 'draft' },
  { id: 'approved', key: 'filterApproved', match: (s) => s === 'approved' },
  { id: 'archived', key: 'filterArchived', match: (s) => s === 'archived' },
];

export default function CollectionEntriesPage(): React.JSX.Element {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const { t, formatRelativeTime } = useI18n();
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState<string>('all');
  const [locale, setLocale] = useState<string>('all');
  const { entries, isLoading, total } = useEntries({
    collection: slug,
    ...(chip === 'all' ? {} : { status: chip as EntryStatus }),
    ...(search ? { search } : {}),
  });
  const remove = useDeleteEntry(slug);

  const totalLabel = useMemo(() => (total === null ? '—' : String(total)), [total]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (locale !== 'all' && e.locale !== locale) return false;
      return true;
    });
  }, [entries, locale]);

  const locales = useMemo(() => {
    const set = new Set(entries.map((e) => e.locale));
    return Array.from(set);
  }, [entries]);

  function onDelete(id: string, title: string): void {
    if (!confirm(t('entries.deleteConfirm', { title }))) return;
    void remove.mutateAsync(id);
  }

  return (
    <div className="flex flex-col gap-6" data-testid="entries-page">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold capitalize">{slug}</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            {totalLabel} {t('dashboard.statEntries').toLowerCase()}
          </p>
        </div>
        <Link href={`/collections/${slug}/new`}>
          <Button variant="primary" size="sm" data-testid="new-entry-button">
            <Plus size={14} /> {t('entries.newEntry')}
          </Button>
        </Link>
      </header>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_CHIPS.map((c) => {
              const active = chip === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChip(c.id)}
                  aria-pressed={active}
                  data-testid={`entries-filter-${c.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    fontSize: 12,
                    borderRadius: 999,
                    background: active ? 'var(--color-foreground)' : 'transparent',
                    color: active ? 'var(--color-background)' : 'var(--color-foreground)',
                    border: active ? '1px solid var(--color-foreground)' : '1px solid var(--color-border)',
                    cursor: 'pointer',
                    transition: 'background-color 100ms',
                  }}
                >
                  {t(`entries.${c.key}`)}
                </button>
              );
            })}
            {locales.length > 1 ? (
              <>
                <span
                  style={{
                    width: 1,
                    height: 18,
                    background: 'var(--color-border)',
                    margin: '0 4px',
                  }}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => setLocale('all')}
                  aria-pressed={locale === 'all'}
                  data-testid="entries-locale-all"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    fontSize: 12,
                    borderRadius: 999,
                    background: locale === 'all' ? 'var(--color-accent)' : 'transparent',
                    color: 'var(--color-foreground)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
                >
                  {t('entries.allLocales')}
                </button>
                {locales.map((l) => {
                  const active = locale === l;
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLocale(l)}
                      aria-pressed={active}
                      data-testid={`entries-locale-${l}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        fontSize: 12,
                        borderRadius: 999,
                        background: active ? 'var(--color-accent)' : 'transparent',
                        color: 'var(--color-foreground)',
                        border: '1px solid var(--color-border)',
                        cursor: 'pointer',
                      }}
                    >
                      {l.toUpperCase()}
                    </button>
                  );
                })}
              </>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              placeholder={t('entries.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('entries.searchAria')}
              leftIcon={<SearchIcon size={14} aria-hidden="true" />}
              data-testid="entries-search"
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <LoadingGrid />
      ) : filtered.length === 0 ? (
        <EmptyState slug={slug} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="entries-grid">
          {filtered.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              slug={slug}
              updatedLabel={formatRelativeTime(e.updatedAt)}
              onDelete={() => onDelete(e.id, titleFor(e))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function titleFor(e: { data: unknown }): string {
  const d = (e.data ?? {}) as Record<string, unknown>;
  if (typeof d['title'] === 'string') return d['title'] as string;
  if (typeof d['name'] === 'string') return d['name'] as string;
  return 'Untitled';
}

function EntryCard({
  entry,
  slug,
  onDelete,
  updatedLabel,
}: {
  entry: {
    id: string;
    slug: string | null;
    status: EntryStatus;
    locale: string;
    updatedAt: string;
    data: unknown;
  };
  slug: string;
  updatedLabel: string;
  onDelete: () => void;
}): React.JSX.Element {
  const { t } = useI18n();
  const data = (entry.data ?? {}) as Record<string, unknown>;
  const title = titleFor(entry);
  const excerpt = typeof data['excerpt'] === 'string' ? (data['excerpt'] as string) : null;
  const coverId = typeof data['coverId'] === 'string' ? (data['coverId'] as string) : null;
  return (
    <li
      style={{
        position: 'relative',
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        transition: 'transform 120ms, box-shadow 120ms',
      }}
      data-testid={`entry-card-${entry.id}`}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      <Link
        href={`/collections/${slug}/${entry.id}`}
        style={{ display: 'block', color: 'inherit' }}
        data-testid={`entry-card-link-${entry.id}`}
      >
        <EntryCover coverId={coverId} title={title} />
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={entry.status} />
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-mono"
              style={{
                background: 'var(--color-muted)',
                color: 'var(--color-muted-foreground)',
              }}
            >
              {entry.locale.toUpperCase()}
            </span>
          </div>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {title}
          </h3>
          {excerpt ? (
            <p
              style={{
                fontSize: 12,
                color: 'var(--color-muted-foreground)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {excerpt}
            </p>
          ) : null}
          <p
            className="mt-1 text-[11px]"
            style={{ color: 'var(--color-muted-foreground)' }}
            data-testid={`entry-card-updated-${entry.id}`}
          >
            {t('entries.updated', { time: updatedLabel })}
          </p>
        </div>
      </Link>
      <div
        className="flex items-center gap-1 border-t px-2 py-1.5"
        style={{ borderColor: 'var(--color-border)' }}
        data-testid={`entry-card-actions-${entry.id}`}
      >
        <Link href={`/collections/${slug}/${entry.id}`} style={{ flex: 1 }}>
          <button
            type="button"
            aria-label={t('entries.editAria')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              fontSize: 12,
              border: 'none',
              background: 'transparent',
              borderRadius: 6,
              color: 'var(--color-foreground)',
              cursor: 'pointer',
            }}
          >
            <Pencil size={12} aria-hidden="true" /> {t('entries.edit')}
          </button>
        </Link>
        <Link href={`/preview/${entry.id}`} target="_blank" rel="noopener noreferrer">
          <button
            type="button"
            aria-label={t('entries.previewAria')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              fontSize: 12,
              border: 'none',
              background: 'transparent',
              borderRadius: 6,
              color: 'var(--color-muted-foreground)',
              cursor: 'pointer',
            }}
          >
            <ExternalLink size={12} aria-hidden="true" /> {t('entries.preview')}
          </button>
        </Link>
        <button
          type="button"
          aria-label={t('entries.duplicateAria')}
          onClick={() => alert(t('entries.duplicatePlaceholder'))}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            fontSize: 12,
            border: 'none',
            background: 'transparent',
            borderRadius: 6,
            color: 'var(--color-muted-foreground)',
            cursor: 'pointer',
          }}
        >
          <CopyIcon size={12} aria-hidden="true" /> {t('entries.duplicate')}
        </button>
        <button
          type="button"
          aria-label={t('entries.deleteAria')}
          onClick={onDelete}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            fontSize: 12,
            border: 'none',
            background: 'transparent',
            borderRadius: 6,
            color: 'var(--color-danger, #dc2626)',
            cursor: 'pointer',
          }}
        >
          <Trash2 size={12} aria-hidden="true" /> {t('entries.delete')}
        </button>
      </div>
    </li>
  );
}

function EntryCover({ coverId, title }: { coverId: string | null; title: string }): React.JSX.Element {
  if (coverId) {
    return (
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 9',
          background: 'var(--color-muted)',
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/media/${coverId}.svg`}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  }
  const initial = title.charAt(0).toUpperCase() || '?';
  return (
    <div
      style={{
        aspectRatio: '16 / 9',
        background: 'linear-gradient(135deg, var(--color-muted) 0%, var(--color-accent) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden="true"
    >
      <span
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: 'var(--color-muted-foreground)',
          opacity: 0.6,
        }}
      >
        {initial}
      </span>
    </div>
  );
}

function EmptyState({ slug }: { slug: string }): React.JSX.Element {
  const { t } = useI18n();
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-12 text-center" data-testid="entries-empty">
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
        <p style={{ fontSize: 15, fontWeight: 500 }}>{t('entries.emptyTitle')}</p>
        <p
          style={{
            fontSize: 12,
            color: 'var(--color-muted-foreground)',
            maxWidth: 320,
          }}
        >
          {t('entries.emptyHint', { slug })}
        </p>
        <Link href={`/collections/${slug}/new`} className="mt-2" data-testid="entries-empty-cta">
          <Button variant="primary" size="sm">
            <Plus size={14} /> {t('entries.emptyCta')}
          </Button>
        </Link>
      </div>
    </Card>
  );
}

function LoadingGrid(): React.JSX.Element {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="entries-loading">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li
          key={i}
          style={{
            background: 'var(--color-muted)',
            borderRadius: 'var(--radius-md)',
            aspectRatio: '4 / 3',
            animation: 'pulse 1.4s ease-in-out infinite',
          }}
          aria-hidden="true"
        >
          <style>{'@keyframes pulse { 0%, 100% { opacity: 0.5 } 50% { opacity: 0.9 } }'}</style>
        </li>
      ))}
    </ul>
  );
}
