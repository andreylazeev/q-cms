'use client';

import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '../../../../../components/ui/Button.tsx';
import { Card } from '../../../../../components/ui/Card.tsx';
import { Input } from '../../../../../components/ui/Input.tsx';
import { Select } from '../../../../../components/ui/Select.tsx';
import { useToast } from '../../../../../components/Toaster.tsx';
import { Editor } from '../../../../../components/Editor/index.tsx';
import { useCreateEntry } from '../../../../../hooks/use-entries.ts';
import type { EntryStatus } from '@q-cms/core';

const STATUS_OPTIONS: readonly { value: EntryStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const LOCALES = ['en', 'ru', 'de', 'es', 'fr', 'zh'] as const;

export default function NewEntryPage(): React.JSX.Element {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug ?? '';
  const create = useCreateEntry(slug);
  const { success: showSuccess, error: showError } = useToast();
  const [title, setTitle] = useState('');
  const [entrySlug, setEntrySlug] = useState('');
  const [status, setStatus] = useState<EntryStatus>('draft');
  const [locale, setLocale] = useState<string>('en');
  const [content, setContent] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    try {
      const result = await create.mutateAsync({
        data: { title, slug: entrySlug, content },
        slug: entrySlug,
        status,
        locale,
      });
      showSuccess('Entry created');
      router.push(`/collections/${slug}/${String((result as { id: string }).id)}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not create entry');
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-6 pb-24"
      data-testid="new-entry-form"
      aria-labelledby="new-entry-title"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <Link
            href={`/collections/${slug}`}
            style={{
              fontSize: 12,
              color: 'var(--color-muted-foreground)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            data-testid="new-entry-back"
          >
            <ArrowLeft size={12} aria-hidden="true" /> Back to {slug}
          </Link>
          <h1 id="new-entry-title" className="text-2xl font-semibold" data-testid="new-entry-heading">
            New entry
          </h1>
          <p className="text-sm capitalize" style={{ color: 'var(--color-muted-foreground)' }}>
            Collection: {slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {create.isPending ? (
            <span
              className="flex items-center gap-2 text-xs"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              <Loader2 size={12} aria-hidden="true" className="animate-spin" /> Creating entry…
            </span>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={create.isPending}>
            <Save size={14} /> Create
          </Button>
        </div>
      </header>

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A clear, descriptive title"
            required
            data-testid="entry-title"
          />
          <Input
            label="Slug"
            name="slug"
            value={entrySlug}
            onChange={(e) => setEntrySlug(e.target.value)}
            placeholder="hello-world"
            hint="URL-safe identifier (e.g. hello-world)"
            required
            data-testid="entry-slug"
          />
          <Select
            label="Status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as EntryStatus)}
            options={STATUS_OPTIONS}
            data-testid="entry-status"
          />
          <Select
            label="Locale"
            name="locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            options={LOCALES.map((l) => ({ value: l, label: l.toUpperCase() }))}
            data-testid="entry-locale"
          />
        </div>
      </Card>

      <Card title="Content" description="Use the block editor to compose your entry body. Type / to open the block menu.">
        <Editor
          value={content}
          onChange={setContent}
          placeholder="Write your entry…"
          aria-label="Entry content"
        />
      </Card>
    </form>
  );
}
