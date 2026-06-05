'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageBuilder } from '../../../../components/PageBuilder/index.ts';
// (was: PageBuilder/index.tsx — the rewrite moved the entrypoint to
// `PageBuilder.tsx` and made `index.ts` the public re-export.)
import { useToast } from '../../../../components/Toaster.tsx';
import { Card } from '../../../../components/ui/Card.tsx';
import { getApiClient } from '../../../../lib/api-client.ts';
import type { SdkTemplate } from '../../../../lib/stubs/api-client.ts';

/**
 * Builder metadata overlay — a small floating card that surfaces the
 * template's id, locale, slug, and last-updated timestamp. Stays
 * out of the way but is one click away.
 */
function BuilderMetadata({ template }: { template: SdkTemplate }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const updated = new Date(template.updatedAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  if (!open) {
    return (
      <button
        type="button"
        className="builder-metadata"
        onClick={() => setOpen(true)}
        aria-label="Show template metadata"
        data-testid="builder-metadata-toggle"
      >
        <strong>Metadata</strong>
      </button>
    );
  }
  return (
    <div className="builder-metadata" data-testid="builder-metadata">
      <header className="flex items-center justify-between gap-2">
        <strong>Template metadata</strong>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn btn-ghost"
          style={{ padding: '0 4px' }}
          aria-label="Hide metadata"
        >
          ×
        </button>
      </header>
      <dl>
        <dt>id</dt>
        <dd>{template.id}</dd>
        <dt>slug</dt>
        <dd>{template.slug}</dd>
        <dt>locale</dt>
        <dd>{template.locale}</dd>
        <dt>version</dt>
        <dd>1</dd>
        <dt>updated</dt>
        <dd>{updated}</dd>
      </dl>
    </div>
  );
}

export default function TemplateDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { error: toastError } = useToast();
  const [template, setTemplate] = useState<SdkTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: data-loading effect, readability preferred over extraction
    async function load(): Promise<void> {
      setIsLoading(true);
      try {
        const tpl = await getApiClient().templates.get(id);
        if (!cancelled) {
          if (!tpl) {
            toastError(`Template '${id}' not found`);
          }
          setTemplate(tpl);
        }
      } catch (err) {
        if (!cancelled) {
          toastError(err instanceof Error ? err.message : 'Failed to load template');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, toastError]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          Loading template…
        </p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Card>
          <p style={{ color: 'var(--color-danger)' }}>Template not found.</p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageBuilder template={template} />
      <BuilderMetadata template={template} />
    </>
  );
}
