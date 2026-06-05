'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '../../../../components/ui/Button.tsx';
import { Card } from '../../../../components/ui/Card.tsx';
import { DataTable } from '../../../../components/DataTable.tsx';
import { Input } from '../../../../components/ui/Input.tsx';
import { Select } from '../../../../components/ui/Select.tsx';
import { StatusBadge } from '../../../../components/StatusBadge.tsx';
import { useEntries } from '../../../../hooks/use-entries.ts';
import type { EntryStatus } from '@q-cms/core';

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

export default function CollectionEntriesPage(): React.JSX.Element {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug ?? '';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EntryStatus | ''>('');
  const { entries, isLoading, total } = useEntries({
    collection: slug,
    status: status === '' ? undefined : status,
    search: search || undefined,
  });

  const totalLabel = useMemo(() => (total === null ? '—' : String(total)), [total]);

  return (
    <div className="flex flex-col gap-6" data-testid="entries-page">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold capitalize">{slug}</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            {totalLabel} entries
          </p>
        </div>
        <Link href={`/collections/${slug}/new`}>
          <Button variant="primary" size="sm" data-testid="new-entry-button">
            <Plus size={14} /> New entry
          </Button>
        </Link>
      </header>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Search"
            placeholder="Filter by title or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search entries"
          />
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value as EntryStatus | '')}
            aria-label="Filter by status"
          />
        </div>
      </Card>

      <DataTable
        isLoading={isLoading}
        rowKey={(row) => row.id}
        rows={entries as readonly { id: string; [k: string]: unknown }[]}
        onRowClick={(row) => router.push(`/collections/${slug}/${(row as { id: string }).id}`)}
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
                <img
                  src={`/media/${coverId}.svg`}
                  alt=""
                  className="h-9 w-14 rounded object-cover"
                />
              );
            },
          },
          {
            id: 'title',
            header: 'Title',
            cell: (r) => {
              const data = (r as { data?: { title?: string; name?: string } }).data;
              return <span className="font-medium">{data?.title ?? data?.name ?? 'Untitled'}</span>;
            },
          },
          {
            id: 'slug',
            header: 'Slug',
            cell: (r) => (
              <code className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                {(r as { slug?: string }).slug ?? '—'}
              </code>
            ),
          },
          {
            id: 'status',
            header: 'Status',
            cell: (r) => <StatusBadge status={(r as { status?: string }).status ?? 'draft'} />,
          },
          {
            id: 'locale',
            header: 'Locale',
            cell: (r) => (
              <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                {(r as { locale?: string }).locale ?? 'en'}
              </span>
            ),
          },
          {
            id: 'updated',
            header: 'Updated',
            cell: (r) =>
              new Date(String((r as { updatedAt?: string }).updatedAt ?? Date.now())).toLocaleString(),
          },
        ]}
        emptyMessage="No entries yet — create the first one."
      />
    </div>
  );
}
