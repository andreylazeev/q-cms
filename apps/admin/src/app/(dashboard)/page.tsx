'use client';

import { useI18n } from '@q-cms/i18n/react';
import { ArrowRight, FileText, ImageIcon, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { DataTable } from '../../components/DataTable.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { useApi } from '../../hooks/use-api.ts';
import { useCollections } from '../../hooks/use-collections.ts';
import { useEntries } from '../../hooks/use-entries.ts';
import { useMedia } from '../../hooks/use-media.ts';

export default function DashboardPage(): React.JSX.Element {
  const { t, formatDate } = useI18n();
  const { collections } = useCollections();
  const { items: media } = useMedia();
  const users = useApi<readonly unknown[]>('/api/v1/users', { initialData: [] });
  const firstCollection = collections[0]?.slug ?? 'article';
  const { entries, total, isLoading } = useEntries({ collection: firstCollection, limit: 5 });

  const stats = useMemo(
    () => [
      {
        key: 'entries',
        label: t('dashboard.statEntries'),
        value: total ?? 0,
        icon: <FileText size={18} aria-hidden="true" />,
        href: `/collections/${firstCollection}`,
      },
      {
        key: 'media',
        label: t('dashboard.statMedia'),
        value: media.length,
        icon: <ImageIcon size={18} aria-hidden="true" />,
        href: '/media',
      },
      {
        key: 'users',
        label: t('dashboard.statUsers'),
        value: Array.isArray(users.data) ? users.data.length : 0,
        icon: <Users size={18} aria-hidden="true" />,
        href: '/users',
      },
      {
        key: 'collections',
        label: t('dashboard.statCollections'),
        value: collections.length,
        icon: <FileText size={18} aria-hidden="true" />,
        href: '/collections',
      },
    ],
    [t, total, media.length, users.data, collections.length, firstCollection],
  );

  return (
    <div className="flex flex-col gap-6" data-testid="dashboard-page">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/collections">
            <Button variant="secondary" size="sm">
              <Plus size={14} /> {t('dashboard.newCollection')}
            </Button>
          </Link>
          <Link href={`/collections/${firstCollection}/new`}>
            <Button variant="primary" size="sm">
              <Plus size={14} /> {t('dashboard.newEntry')}
            </Button>
          </Link>
        </div>
      </header>

      <section
        aria-label={t('dashboard.metricsLabel')}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((s) => (
          <Card key={s.key}>
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-xs uppercase tracking-wide"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  {s.label}
                </p>
                <p className="mt-1 text-2xl font-semibold">{s.value}</p>
              </div>
              <div
                className="grid h-10 w-10 place-items-center rounded-md"
                style={{ background: 'var(--color-muted)' }}
                aria-hidden="true"
              >
                {s.icon}
              </div>
            </div>
            <Link
              href={s.href}
              className="mt-3 inline-flex items-center gap-1 text-xs"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {t('dashboard.viewAll')} <ArrowRight size={12} />
            </Link>
          </Card>
        ))}
      </section>

      <Card title={t('dashboard.recentActivity')} description={t('dashboard.recentActivityDescription')}>
        <DataTable
          isLoading={isLoading}
          rowKey={(row) => row.id}
          rows={entries.slice(0, 5) as unknown as readonly { id: string; [k: string]: unknown }[]}
          columns={[
            {
              id: 'cover',
              header: '',
              cell: (r) => {
                const coverId = (r as { data?: { coverId?: string } }).data?.coverId;
                if (!coverId) {
                  return (
                    <div
                      className="h-9 w-14 rounded"
                      style={{ background: 'var(--color-muted)' }}
                      aria-hidden="true"
                    />
                  );
                }
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/media/${coverId}.svg`} alt="" className="h-9 w-14 rounded object-cover" />
                );
              },
            },
            {
              id: 'title',
              header: t('dashboard.columnTitle'),
              cell: (r) => String((r as { data?: { title?: string } }).data?.title ?? '—'),
            },
            {
              id: 'status',
              header: t('dashboard.columnStatus'),
              cell: (r) => String((r as { status?: string }).status ?? 'draft'),
            },
            {
              id: 'updated',
              header: t('dashboard.columnUpdated'),
              cell: (r) => formatDate(String((r as { updatedAt?: string }).updatedAt ?? Date.now())),
            },
            {
              id: 'actions',
              header: '',
              align: 'right',
              cell: (r) => (
                <Link
                  href={`/collections/${firstCollection}/${(r as { id: string }).id}`}
                  className="text-xs underline"
                >
                  {t('dashboard.open')}
                </Link>
              ),
            },
          ]}
          emptyMessage={t('dashboard.emptyActivity')}
        />
      </Card>
    </div>
  );
}
