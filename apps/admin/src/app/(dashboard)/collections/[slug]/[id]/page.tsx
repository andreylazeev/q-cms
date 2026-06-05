'use client';

import {
  Eye,
  Save,
  Send,
  Loader2,
  AlertCircle,
  Check,
  ChevronDown,
  X,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../../../components/ui/Button.tsx';
import { Card } from '../../../../../components/ui/Card.tsx';
import { Input } from '../../../../../components/ui/Input.tsx';
import { StatusBadge } from '../../../../../components/StatusBadge.tsx';
import { useToast } from '../../../../../components/Toaster.tsx';
import { Editor } from '../../../../../components/Editor/index.tsx';
import { useEntry, usePublishEntry, useUpdateEntry } from '../../../../../hooks/use-entries.ts';
import { useMedia } from '../../../../../hooks/use-media.ts';
import { extractEntryMetadata } from '@q-cms/editor';
import type { EntryStatus } from '@q-cms/core';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export default function EditEntryPage(): React.JSX.Element {
  const params = useParams<{ slug: string; id: string }>();
  const search = useSearchParams();
  const slug = params?.slug ?? '';
  const id = params?.id ?? '';
  const layout = (search?.get('layout') as 'split' | 'three-pane' | null) ?? 'split';
  const { entry, isLoading } = useEntry(slug, id);
  const update = useUpdateEntry(slug);
  const publish = usePublishEntry(slug);
  const { success, error: toastError } = useToast();

  const [title, setTitle] = useState('');
  const [titleFocused, setTitleFocused] = useState(false);
  const [entrySlug, setEntrySlug] = useState('');
  const [status, setStatus] = useState<EntryStatus>('draft');
  const [locale, setLocale] = useState<string>('en');
  const [tags, setTags] = useState<string[]>([]);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [content, setContent] = useState('');
  const [coverId, setCoverId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Populate state from the entry when it loads.
  useEffect(() => {
    if (!entry) return;
    const data = (entry.data ?? {}) as Record<string, unknown>;
    const meta = extractEntryMetadata(data);
    setTitle(meta.title);
    setEntrySlug(entry.slug ?? '');
    setStatus(entry.status);
    setLocale(entry.locale);
    setContent(typeof data['content'] === 'string' ? (data['content'] as string) : '');
    setSeoTitle(meta.seo.title);
    setSeoDescription(meta.seo.description);
    setTags([...meta.tags]);
    setCoverId(meta.coverId);
    setLastSavedAt(entry.updatedAt);
    setSaveState('saved');
  }, [entry]);

  // Mark as dirty whenever the form changes after the initial load.
  useEffect(() => {
    if (saveState === 'idle' || saveState === 'saving') return;
    setSaveState('dirty');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, entrySlug, status, locale, content, tags, seoTitle, seoDescription, coverId]);

  // Debounced autosave.
  const trySave = useCallback(async (): Promise<void> => {
    if (!entry) return;
    setSaveState('saving');
    try {
      await update.mutateAsync({
        id,
        data: {
          title,
          slug: entrySlug,
          content,
          coverId,
          tags,
          seo: { title: seoTitle, description: seoDescription },
        },
      });
      setLastSavedAt(new Date().toISOString());
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      toastError(err instanceof Error ? err.message : 'Could not save');
    }
  }, [entry, id, update, title, entrySlug, content, coverId, tags, seoTitle, seoDescription, toastError]);

  const scheduleSave = useCallback((): void => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void trySave(), 1000);
  }, [trySave]);

  useEffect(() => {
    if (saveState === 'dirty') scheduleSave();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [saveState, scheduleSave]);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await trySave();
    success('Saved');
  }

  async function onPublish(): Promise<void> {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await trySave();
      await publish.mutateAsync({ id });
      setStatus('published');
      success('Published');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Could not publish');
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
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-24" data-testid="edit-entry-page">
      <header
        className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <p
            className="text-xs uppercase tracking-wide"
            style={{ color: 'var(--color-muted-foreground)' }}
            data-testid="edit-entry-collection"
          >
            {slug}
          </p>
          {titleFocused ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTitleFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  (e.currentTarget as HTMLElement).blur();
                }
              }}
              autoFocus
              placeholder="Untitled"
              aria-label="Entry title"
              data-testid="edit-entry-title-input"
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.2,
                color: 'var(--color-foreground)',
                width: '100%',
                padding: 0,
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setTitleFocused(true)}
              data-testid="edit-entry-title"
              style={{
                textAlign: 'left',
                background: 'transparent',
                border: '1px dashed transparent',
                borderRadius: 6,
                padding: '2px 6px',
                margin: '-2px -6px',
                cursor: 'text',
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.2,
                color: title ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
                width: 'fit-content',
                maxWidth: '100%',
              }}
            >
              {title || 'Untitled'}
            </button>
          )}
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <SaveStatePill state={saveState} lastSavedAt={lastSavedAt} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/preview/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="edit-preview-link"
          >
            <Button type="button" variant="ghost" size="sm">
              <Eye size={14} /> Preview
            </Button>
          </Link>
          <Button type="submit" variant="secondary" size="sm" isLoading={saveState === 'saving'}>
            <Save size={14} /> Save
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void onPublish()}
            isLoading={publish.isPending}
          >
            <Send size={14} /> Publish
          </Button>
        </div>
      </header>

      <Editor
        value={content}
        onChange={setContent}
        placeholder="Write your entry…"
        aria-label="Entry content"
        previewHref={`/preview/${id}`}
        layout={layout}
        entryData={(entry.data ?? {}) as Record<string, unknown>}
      />

      <Card title="SEO" description="Search engine metadata.">
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="SEO title"
            name="seo-title"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            hint="Recommended ≤ 60 characters"
            data-testid="edit-entry-seo-title"
          />
          <Input
            label="SEO description"
            name="seo-description"
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            hint="Recommended ≤ 160 characters"
            data-testid="edit-entry-seo-description"
          />
          <SeoPreview title={seoTitle} description={seoDescription} slug={entrySlug} />
        </div>
      </Card>

      <SaveBar state={saveState} onSave={() => void trySave()} />

      <input type="hidden" name="coverId" value={coverId ?? ''} />
      <input type="hidden" name="tags" value={tags.join(',')} />
    </form>
  );
}

function SaveStatePill({
  state,
  lastSavedAt,
}: { state: SaveState; lastSavedAt: string | null }): React.JSX.Element {
  const label = useMemo(() => {
    if (state === 'saving') return 'Saving…';
    if (state === 'dirty') return 'Unsaved changes';
    if (state === 'error') return 'Save failed';
    if (state === 'saved' && lastSavedAt) {
      return `Saved ${formatRelative(lastSavedAt)}`;
    }
    return 'Up to date';
  }, [state, lastSavedAt]);

  const color =
    state === 'error'
      ? 'var(--color-danger, #dc2626)'
      : state === 'dirty'
        ? 'var(--color-warning, #b45309)'
        : 'var(--color-muted-foreground)';
  const icon =
    state === 'saving' ? (
      <Loader2 size={10} aria-hidden="true" className="animate-spin" />
    ) : state === 'error' ? (
      <AlertCircle size={10} aria-hidden="true" />
    ) : state === 'dirty' ? (
      <span
        aria-hidden="true"
        style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor' }}
      />
    ) : (
      <Check size={10} aria-hidden="true" />
    );
  return (
    <span
      className="flex items-center gap-1 text-[11px]"
      style={{ color }}
      data-testid="edit-entry-save-state"
      data-save-state={state}
    >
      {icon}
      <span>{label}</span>
      {state === 'saving' ? (
        <style>{`@keyframes qcms-pulse { 0%, 100% { opacity: 0.6 } 50% { opacity: 1 } } [data-save-state="saving"] { animation: qcms-pulse 1.4s ease-in-out infinite; }`}</style>
      ) : null}
    </span>
  );
}

function SaveBar({ state, onSave }: { state: SaveState; onSave: () => void }): React.JSX.Element {
  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-md border px-4 py-2 shadow"
      style={{
        background: 'var(--color-background)',
        borderColor: 'var(--color-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      }}
      data-testid="edit-entry-save-bar"
      data-save-state={state}
    >
      <SaveStatePill state={state} lastSavedAt={null} />
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={onSave}
        isLoading={state === 'saving'}
        disabled={state === 'saved'}
        data-testid="edit-entry-save-bar-button"
      >
        <Save size={12} /> Save
      </Button>
    </div>
  );
}

function SeoPreview({
  title: seoTitle,
  description: seoDescription,
  slug,
}: {
  title: string;
  description: string;
  slug: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        background: 'var(--color-muted)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 12,
      }}
      data-testid="edit-entry-seo-preview"
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          color: 'var(--color-muted-foreground)',
          marginBottom: 6,
        }}
      >
        Search preview
      </p>
      <p
        style={{
          fontSize: 16,
          color: '#1a0dab',
          fontWeight: 500,
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {seoTitle || 'Untitled'}
      </p>
      <p style={{ fontSize: 12, color: '#006621' }}>q-cms.dev › {slug || '—'}</p>
      <p
        style={{
          fontSize: 12,
          color: 'var(--color-muted-foreground)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          marginTop: 2,
        }}
      >
        {seoDescription || 'Add a meta description for better search results.'}
      </p>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  return 'more than an hour ago';
}

// ---------------------------------------------------------------------------
// Local sub-components used by a future fullscreen layout; not rendered
// above but exported so other entry pages can reuse them.
// ---------------------------------------------------------------------------

export function CoverPicker({
  coverId,
  onChange,
}: {
  coverId: string | null;
  onChange: (id: string | null) => void;
}): React.JSX.Element {
  const { items: media } = useMedia();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="cover-picker-button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: 8,
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          background: 'var(--color-background)',
          cursor: 'pointer',
        }}
      >
        {coverId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/media/${coverId}.svg`}
            alt=""
            style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 36,
              background: 'var(--color-muted)',
              color: 'var(--color-muted-foreground)',
              borderRadius: 4,
            }}
            aria-hidden="true"
          >
            <ImageIcon size={14} />
          </span>
        )}
        <span style={{ flex: 1, textAlign: 'left', fontSize: 12 }}>
          {coverId ? 'Cover image' : 'Choose a cover'}
        </span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Cover image"
          style={{
            position: 'absolute',
            zIndex: 30,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
          data-testid="cover-picker-panel"
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 6,
              maxHeight: 180,
              overflow: 'auto',
            }}
            data-testid="cover-picker-grid"
          >
            {media
              .filter((m) => m.type === 'image')
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  aria-label={`Use ${m.filename}`}
                  data-testid={`cover-picker-item-${m.id}`}
                  style={{
                    border:
                      coverId === m.id
                        ? '2px solid var(--color-accent-foreground, var(--color-foreground))'
                        : '1px solid var(--color-border)',
                    borderRadius: 6,
                    overflow: 'hidden',
                    padding: 0,
                    background: 'var(--color-muted)',
                    cursor: 'pointer',
                    aspectRatio: '4 / 3',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.storageKey}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </button>
              ))}
          </div>
          <button
            type="button"
            onClick={() => alert('Upload is a placeholder — wired up in a follow-up.')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '6px 8px',
              fontSize: 12,
              border: '1px dashed var(--color-border)',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--color-muted-foreground)',
              cursor: 'pointer',
            }}
            data-testid="cover-picker-upload"
          >
            <Upload size={12} aria-hidden="true" /> Upload a new image
          </button>
          {coverId ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              style={{
                fontSize: 12,
                color: 'var(--color-danger, #dc2626)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Remove cover
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function TagInput({
  tags,
  onChange,
}: {
  tags: readonly string[];
  onChange: (next: string[]) => void;
}): React.JSX.Element {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  function commit(): void {
    const next = value.trim();
    if (!next) return;
    if (tags.includes(next)) {
      setValue('');
      return;
    }
    onChange([...tags, next]);
    setValue('');
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && value === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        padding: 6,
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        background: 'var(--color-background)',
        minHeight: 36,
        alignItems: 'center',
      }}
      onClick={() => inputRef.current?.focus()}
      data-testid="tag-input"
    >
      {tags.map((t) => (
        <span
          key={t}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            background: 'var(--color-accent)',
            color: 'var(--color-accent-foreground, var(--color-foreground))',
            borderRadius: 999,
            fontSize: 12,
          }}
        >
          {t}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(tags.filter((x) => x !== t));
            }}
            aria-label={`Remove tag ${t}`}
            style={{
              display: 'inline-flex',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              color: 'inherit',
            }}
          >
            <X size={10} aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        placeholder={tags.length === 0 ? 'Type a tag and hit Enter…' : 'Add another tag…'}
        aria-label="Add a tag"
        data-testid="tag-input-field"
        style={{
          flex: 1,
          minWidth: 100,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 13,
          color: 'var(--color-foreground)',
        }}
      />
    </div>
  );
}
