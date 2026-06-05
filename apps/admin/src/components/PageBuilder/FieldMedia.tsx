'use client';

/**
 * FieldMedia — image-id picker.
 *
 * No MediaPicker component exists yet in this codebase, so this is
 * a **stub**: it shows the current media id (or a "Choose media…"
 * placeholder), and clicking it opens a Radix `Dialog` with a
 * minimal grid + search input. The grid is populated from the
 * existing `getApiClient().media.list()` call. Once a real
 * MediaPicker ships, swap this for a `import { MediaPicker } from …`
 * without changing the Field prop contract.
 */

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import type { SdkMedia } from '../../lib/stubs/api-client.ts';
import { getApiClient } from '../../lib/api-client.ts';
import { ImageIcon, Search, X } from './icons.tsx';
import { Field } from './Field.tsx';
import { cn } from '../../lib/utils.ts';

export interface FieldMediaProps {
  id: string;
  label: string;
  description?: string | undefined;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

export function FieldMedia({ id, label, description, value, onChange }: FieldMediaProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState<ReadonlyArray<SdkMedia>>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void getApiClient()
      .media.list()
      .then((list) => {
        if (!cancelled) setMedia(list);
      })
      .catch(() => {
        if (!cancelled) setMedia([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = query
    ? media.filter((m) => m.filename.toLowerCase().includes(query.toLowerCase()))
    : media;

  return (
    <Field label={label} description={description}>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            id={id}
            data-testid={id}
            className={cn('pb-media-trigger', value ? 'pb-media-trigger--set' : 'pb-media-trigger--empty')}
          >
            <span className="pb-media-trigger__icon" aria-hidden="true">
              <ImageIcon size={16} />
            </span>
            <span className="pb-media-trigger__value">{value ? value : 'Choose media…'}</span>
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="pb-dialog__overlay" />
          <Dialog.Content className="pb-dialog__content" data-testid="media-dialog">
            <header className="pb-dialog__head">
              <Dialog.Title className="pb-dialog__title">Choose media</Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className="pb-icon-btn" aria-label="Close" data-testid="media-dialog-close">
                  <X size={16} />
                </button>
              </Dialog.Close>
            </header>
            <div className="pb-dialog__search">
              <Search size={14} className="pb-dialog__search-icon" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search filename…"
                className="pb-dialog__search-input"
                aria-label="Search media"
              />
            </div>
            <div className="pb-media-grid" data-testid="media-grid">
              {loading ? <p className="pb-media-grid__hint">Loading…</p> : null}
              {!loading && filtered.length === 0 ? (
                <p className="pb-media-grid__hint">No media items.</p>
              ) : null}
              {filtered.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  className={cn('pb-media-grid__item', value === m.id && 'pb-media-grid__item--selected')}
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  data-testid={`media-item-${m.id}`}
                >
                  <span className="pb-media-grid__thumb" aria-hidden="true">
                    {m.type === 'image' ? <img src={m.storageKey} alt="" loading="lazy" /> : <ImageIcon size={20} />}
                  </span>
                  <span className="pb-media-grid__label">{m.filename}</span>
                </button>
              ))}
            </div>
            <footer className="pb-dialog__foot">
              <Dialog.Close asChild>
                <button type="button" className="pb-btn pb-btn--ghost">
                  Cancel
                </button>
              </Dialog.Close>
              {value ? (
                <button
                  type="button"
                  className="pb-btn pb-btn--danger"
                  onClick={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                >
                  Remove
                </button>
              ) : null}
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Field>
  );
}
