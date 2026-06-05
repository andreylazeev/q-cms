'use client';

import { Save } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '../../../../../components/ui/Button.tsx';
import { Card } from '../../../../../components/ui/Card.tsx';
import { Input } from '../../../../../components/ui/Input.tsx';
import { Select } from '../../../../../components/ui/Select.tsx';
import { useToast } from '../../../../../components/Toaster.tsx';
import { useCreateEntry } from '../../../../../hooks/use-entries.ts';
import type { EntryStatus } from '@q-cms/core';

const STATUS_OPTIONS: readonly { value: EntryStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

export default function NewEntryPage(): React.JSX.Element {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug ?? '';
  const create = useCreateEntry(slug);
  const { success: showSuccess, error: showError } = useToast();
  const [title, setTitle] = useState('');
  const [entrySlug, setEntrySlug] = useState('');
  const [status, setStatus] = useState<EntryStatus>('draft');
  const [content, setContent] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    try {
      const result = await create.mutateAsync({
        data: { title, slug: entrySlug, content },
        slug: entrySlug,
        status,
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
      className="flex flex-col gap-6"
      data-testid="new-entry-form"
      aria-labelledby="new-entry-title"
    >
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 id="new-entry-title" className="text-2xl font-semibold">
            New entry
          </h1>
          <p className="text-sm capitalize" style={{ color: 'var(--color-muted-foreground)' }}>
            Collection: {slug}
          </p>
        </div>
        <div className="flex gap-2">
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
            required
            data-testid="entry-title"
          />
          <Input
            label="Slug"
            name="slug"
            value={entrySlug}
            onChange={(e) => setEntrySlug(e.target.value)}
            hint="URL-safe identifier (e.g. hello-world)"
            required
          />
          <Select
            label="Status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as EntryStatus)}
            options={STATUS_OPTIONS}
          />
        </div>
      </Card>

      <Card title="Content" description="Use the block editor to compose your entry body.">
        <textarea
          className="input"
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your content here…"
          data-testid="entry-content"
        />
        <p className="mt-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
          The TipTap-based block editor will replace this textarea when @q-cms/editor ships.
        </p>
      </Card>
    </form>
  );
}
