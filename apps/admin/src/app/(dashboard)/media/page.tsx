'use client';

import { Image as ImageIcon, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type DragEvent } from 'react';
import { useI18n } from '@q-cms/i18n/react';
import { Card } from '../../../components/ui/Card.tsx';
import { Select } from '../../../components/ui/Select.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { useToast } from '../../../components/Toaster.tsx';
import { useDeleteMedia, useMedia, useUploadMedia } from '../../../hooks/use-media.ts';
import type { MediaType } from '@q-cms/core';

const TYPE_KEYS = ['all', 'image', 'video', 'audio', 'document', 'other'] as const;
type TypeKey = (typeof TYPE_KEYS)[number];

function typeKeyToMediaType(key: TypeKey): MediaType {
  // Caller checks `key === 'all'` first; this cast is safe because
  // every non-'all' member of TYPE_KEYS is a valid MediaType.
  return key as MediaType;
}

export default function MediaPage(): React.JSX.Element {
  const router = useRouter();
  const { t } = useI18n();
  const [type, setType] = useState<TypeKey>('all');
  const { items, isLoading, refetch } = useMedia(
    type === 'all' ? {} : { type: typeKeyToMediaType(type) as MediaType },
  );
  const upload = useUploadMedia();
  const remove = useDeleteMedia();
  const { success, error: toastError } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  async function handleFiles(fileList: FileList | null): Promise<void> {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      try {
        await upload.mutateAsync(file);
        success(t('media.uploaded', { name: file.name }));
      } catch (err) {
        toastError(err instanceof Error ? err.message : t('media.uploadFailed'));
      }
    }
    void refetch();
  }

  function onDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(false);
    void handleFiles(e.dataTransfer.files);
  }

  function onSelect(e: ChangeEvent<HTMLInputElement>): void {
    void handleFiles(e.target.files);
  }

  async function onDelete(id: string, name: string): Promise<void> {
    if (!confirm(t('media.deleteConfirm', { name }))) return;
    try {
      await remove.mutateAsync(id);
      success(t('media.deleted'));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t('media.deleteFailed'));
    }
  }

  const filtered =
    type === 'all'
      ? items
      : items.filter((it) => (it as { type?: MediaType }).type === typeKeyToMediaType(type));

  return (
    <div className="flex flex-col gap-6" data-testid="media-page">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('media.title')}</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            {t('media.subtitle')}
          </p>
        </div>
        <label className="inline-flex">
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={onSelect}
            data-testid="media-file-input"
            aria-label={t('media.uploadAria')}
          />
          <span className="btn btn-primary cursor-pointer">
            <Upload size={14} /> {t('media.upload')}
          </span>
        </label>
      </header>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label={t('media.type')}
            value={type}
            onChange={(e) => {
              const next = e.target.value;
              if ((TYPE_KEYS as readonly string[]).includes(next)) {
                setType(next as TypeKey);
              }
            }}
            options={TYPE_KEYS.map((k) => ({ value: k, label: t(`media.${k}`) }))}
          />
        </div>
      </Card>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className="card flex flex-col items-center justify-center gap-2 border-dashed p-10 text-center"
        style={{
          borderStyle: 'dashed',
          borderColor: isDragging ? 'var(--color-primary)' : 'var(--color-border)',
          background: isDragging ? 'var(--color-muted)' : 'transparent',
        }}
        data-testid="media-dropzone"
        role="button"
        tabIndex={0}
        aria-label={t('media.dropzoneAria')}
      >
        <Upload size={28} aria-hidden="true" />
        <p className="text-sm font-medium">{t('media.dropzonePrimary')}</p>
        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('media.dropzoneSecondary')}
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('media.loading')}
        </p>
      ) : null}

      <ul
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        aria-label="Media items"
      >
        {filtered.map((m) => {
          const id = String(m.id);
          const name = String((m as { filename?: string }).filename ?? id);
          const mime = String((m as { mimeType?: string }).mimeType ?? '');
          const storageKey = String((m as { storageKey?: string }).storageKey ?? '');
          const isImage = mime.startsWith('image/');
          const imageSrc = isImage && storageKey.startsWith('/media/') ? storageKey : null;
          return (
            <li
              key={id}
              className="card relative flex aspect-square flex-col justify-end overflow-hidden p-3"
              data-testid={`media-item-${id}`}
            >
              {imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSrc}
                  alt={name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : isImage ? (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${(m as { metadata?: { swatch?: string } }).metadata?.swatch ?? '#777'} 0%, #333 100%)`,
                  }}
                  aria-hidden="true"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'var(--color-muted)' }}
                  aria-hidden="true"
                >
                  <ImageIcon size={48} style={{ color: 'var(--color-muted-foreground)' }} />
                </div>
              )}
              <div className="relative mt-auto">
                <p
                  className="truncate text-xs font-medium"
                  title={name}
                  style={{
                    color: isImage ? 'white' : 'inherit',
                    textShadow: isImage ? '0 1px 2px rgba(0,0,0,0.6)' : 'none',
                  }}
                >
                  {name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onDelete(id, name)}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full"
                style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}
                aria-label={t('media.deleteAria', { name })}
              >
                <X size={12} />
              </button>
            </li>
          );
        })}
      </ul>

      {!isLoading && filtered.length === 0 ? (
        <Card>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            {t('media.empty')}
          </p>
        </Card>
      ) : null}

      <div>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          {t('common.back')}
        </Button>
      </div>
    </div>
  );
}
