'use client';

import { Save, Send } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '../../../../../components/ui/Button.tsx';
import { Card } from '../../../../../components/ui/Card.tsx';
import { Input } from '../../../../../components/ui/Input.tsx';
import { Select } from '../../../../../components/ui/Select.tsx';
import { StatusBadge } from '../../../../../components/StatusBadge.tsx';
import { useToast } from '../../../../../components/Toaster.tsx';
import { Editor } from '../../../../../components/Editor/index.tsx';
import {
  useDeleteEntry,
  useEntry,
  usePublishEntry,
  useUpdateEntry,
} from '../../../../../hooks/use-entries.ts';
import type { EntryStatus } from '@q-cms/core';

const STATUS_OPTIONS: readonly { value: EntryStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const LOCALES = ['en', 'ru', 'de', 'es', 'fr', 'zh'] as const;

export default function EditEntryPage(): React.JSX.Element {
  const params = useParams<{ slug: string; id: string }>();
  const router = useRouter();
  const slug = params?.slug ?? '';
  const id = params?.id ?? '';
  const { entry, isLoading } = useEntry(slug, id);
  const update = useUpdateEntry(slug);
  const publish = usePublishEntry(slug);
  const remove = useDeleteEntry(slug);
  const { success, error: toastError } = useToast();

  const [title, setTitle] = useState('');
  const [entrySlug, setEntrySlug] = useState('');
  const [status, setStatus] = useState<EntryStatus>('draft');
  const [locale, setLocale] = useState<string>('en');
  const [tags, setTags] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!entry) return;
    const data = (entry.data ?? {}) as Record<string, unknown>;
    setTitle(typeof data['title'] === 'string' ? (data['title'] as string) : '');
    setEntrySlug(entry.slug ?? '');
    setStatus(entry.status);
    setLocale(entry.locale);
    setContent(typeof data['content'] === 'string' ? (data['content'] as string) : '');
    const seo = (data['seo'] ?? {}) as Record<string, unknown>;
    setSeoTitle(typeof seo['title'] === 'string' ? (seo['title'] as string) : '');
    setSeoDescription(typeof seo['description'] === 'string' ? (seo['description'] as string) : '');
    const tagsRaw = data['tags'];
    setTags(Array.isArray(tagsRaw) ? tagsRaw.join(', ') : '');
  }, [entry]);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id,
        data: {
          title,
          slug: entrySlug,
          content,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          seo: { title: seoTitle, description: seoDescription },
        },
      });
      success('Saved');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function onPublish(): Promise<void> {
    try {
      await publish.mutateAsync({ id });
      setStatus('published');
      success('Published');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Could not publish');
    }
  }

  async function onDelete(): Promise<void> {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    try {
      await remove.mutateAsync(id);
      success('Deleted');
      router.push(`/collections/${slug}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  if (isLoading) {
    return <p data-testid="entry-loading">Loading…</p>;
  }
  if (!entry) {
    return (
      <Card>
        <p data-testid="entry-not-found">Entry not found.</p>
      </Card>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]"
      data-testid="edit-entry-page"
    >
      <div className="flex flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>
              {slug}
            </p>
            <h1 className="text-2xl font-semibold">{title || 'Untitled'}</h1>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" size="sm" isLoading={update.isPending}>
              <Save size={14} /> Save
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => void onPublish()} isLoading={publish.isPending}>
              <Send size={14} /> Publish
            </Button>
          </div>
        </header>

        <Card title="Content">
          <Editor value={content} onChange={setContent} placeholder="Write your entry…" aria-label="Entry content" />
        </Card>

        <Card title="SEO" description="Search engine metadata.">
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="SEO title"
              name="seo-title"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              hint="Recommended ≤ 60 characters"
            />
            <Input
              label="SEO description"
              name="seo-description"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              hint="Recommended ≤ 160 characters"
            />
          </div>
        </Card>
      </div>

      <aside className="flex flex-col gap-4">
        <Card title="Status">
          <div className="flex flex-col gap-3">
            <StatusBadge status={status} />
            <Select
              label="Change status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(e) => setStatus(e.target.value as EntryStatus)}
            />
          </div>
        </Card>
        <Card title="Locale">
          <Select
            label="Locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            options={LOCALES.map((l) => ({ value: l, label: l }))}
          />
        </Card>
        <Card title="Author">
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            {String((entry.createdBy as string | null) ?? 'system')}
          </p>
        </Card>
        <Card title="Tags">
          <Input
            label="Tags"
            hint="Comma-separated"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </Card>
        <Card title="Danger zone">
          <Button type="button" variant="danger" size="sm" onClick={() => void onDelete()}>
            Delete entry
          </Button>
        </Card>
      </aside>
    </form>
  );
}
