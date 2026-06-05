'use client';

import { Image as ImageIcon, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type DragEvent } from 'react';
import { Card } from '../../../components/ui/Card.tsx';
import { Select } from '../../../components/ui/Select.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { useToast } from '../../../components/Toaster.tsx';
import { useDeleteMedia, useMedia, useUploadMedia } from '../../../hooks/use-media.ts';
import type { MediaType } from '@q-cms/core';

const TYPE_FILTERS: readonly { value: '' | MediaType; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'document', label: 'Document' },
  { value: 'other', label: 'Other' },
];

export default function MediaPage(): React.JSX.Element {
  const router = useRouter();
  const [type, setType] = useState<'' | MediaType>('');
  const { items, isLoading, refetch } = useMedia({ type: type === '' ? undefined : type });
  const upload = useUploadMedia();
  const remove = useDeleteMedia();
  const { success, error: toastError } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  async function handleFiles(fileList: FileList | null): Promise<void> {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      try {
        await upload.mutateAsync(file);
        success(`Uploaded ${file.name}`);
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Upload failed');
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
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await remove.mutateAsync(id);
      success('Deleted');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const filtered = type === '' ? items : items.filter((it) => (it as { type?: MediaType }).type === type);

  return (
    <div className="flex flex-col gap-6" data-testid="media-page">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Media library</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            Upload and manage images, videos, and documents.
          </p>
        </div>
        <label className="inline-flex">
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={onSelect}
            data-testid="media-file-input"
            aria-label="Upload files"
          />
          <span className="btn btn-primary cursor-pointer">
            <Upload size={14} /> Upload
          </span>
        </label>
      </header>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as '' | MediaType)}
            options={TYPE_FILTERS}
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
        aria-label="Drop files to upload"
      >
        <Upload size={28} aria-hidden="true" />
        <p className="text-sm font-medium">Drag &amp; drop files here</p>
        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
          or use the Upload button above
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          Loading media…
        </p>
      ) : null}

      <ul
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        aria-label="Media items"
      >
        {filtered.map((m) => {
          const id = String(m.id);
          const name = String((m as { filename?: string }).filename ?? id);
          return (
            <li
              key={id}
              className="card relative flex aspect-square flex-col justify-end p-3"
              data-testid={`media-item-${id}`}
            >
              <div
                className="flex flex-1 items-center justify-center"
                style={{ color: 'var(--color-muted-foreground)' }}
                aria-hidden="true"
              >
                <ImageIcon size={48} />
              </div>
              <p className="mt-2 truncate text-xs font-medium" title={name}>
                {name}
              </p>
              <button
                type="button"
                onClick={() => void onDelete(id, name)}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full"
                style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}
                aria-label={`Delete ${name}`}
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
            No media yet. Upload your first file above.
          </p>
        </Card>
      ) : null}

      <div>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          Back
        </Button>
      </div>
    </div>
  );
}
