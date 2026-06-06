'use client';

import { Database, FileText } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@q-cms/i18n/react';
import { Card } from '../../../components/ui/Card.tsx';
import { useCollections } from '../../../hooks/use-collections.ts';
import type { SdkCollection } from '../../../lib/stubs/sdk-types.ts';

export default function CollectionsPage(): React.JSX.Element {
  const { collections, isLoading, error } = useCollections();
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-6" data-testid="collections-page">
      <header>
        <h1 className="text-2xl font-semibold">{t('collections.title')}</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('collections.subtitle')}
        </p>
      </header>

      {error ? (
        <Card>
          <p style={{ color: 'var(--color-danger)' }}>{t('collections.failedToLoad')}</p>
        </Card>
      ) : null}

      {isLoading ? (
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('collections.loading')}
        </p>
      ) : null}

      {!isLoading && collections.length === 0 ? (
        <Card>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            {t('collections.emptyHint')}
          </p>
        </Card>
      ) : null}

      <ul
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        aria-label={t('collections.ariaLabel')}
      >
        {collections.map((c: SdkCollection) => (
          <li key={c.id}>
            <Link
              href={`/collections/${c.slug}`}
              className="block focus:outline-none"
              data-testid={`collection-${c.slug}`}
            >
              <Card>
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-9 w-9 place-items-center rounded-md"
                    style={{ background: 'var(--color-muted)' }}
                    aria-hidden="true"
                  >
                    {c.isSingleton ? <FileText size={16} /> : <Database size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.displayName ?? c.name}</p>
                    <p className="truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                      {c.slug}
                    </p>
                    {c.isSingleton ? (
                      <span
                        className="mt-2 inline-block text-[10px] uppercase tracking-wide"
                        style={{ color: 'var(--color-muted-foreground)' }}
                      >
                        {t('collections.singleton')}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
