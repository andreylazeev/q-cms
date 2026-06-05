'use client';

import { ArrowUpRight, Calendar, LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useToast } from '../../../components/Toaster.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { getApiClient } from '../../../lib/api-client.ts';
import type { SdkTemplate } from '../../../lib/stubs/api-client.ts';

function statusFor(template: SdkTemplate): { label: string; tone: 'draft' | 'published' | 'stale' } {
  // The seed stub has no `status`; treat any template not touched in
  // the last 24h as published, anything newer as a draft.
  const ageMs = Date.now() - new Date(template.updatedAt).getTime();
  if (ageMs < 24 * 60 * 60 * 1000) return { label: 'Draft', tone: 'draft' };
  return { label: 'Published', tone: 'published' };
}

export default function TemplatesListPage(): React.JSX.Element {
  const [templates, setTemplates] = useState<readonly SdkTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setIsLoading(true);
      try {
        const list = await getApiClient().templates.list();
        if (!cancelled) setTemplates(list);
      } catch (err) {
        if (!cancelled) {
          toastError(err instanceof Error ? err.message : 'Failed to load templates');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [toastError]);

  async function onDelete(id: string, name: string, ev: React.MouseEvent): Promise<void> {
    ev.preventDefault();
    ev.stopPropagation();
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    try {
      await getApiClient().templates.delete(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      success(`Deleted ${name}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="templates-page">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Page templates</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            Compose, edit, and bind templates to the public site. The <code>home-default</code> and{' '}
            <code>article-default</code> templates ship with the v0.1 seed.
          </p>
        </div>
        <Link href="/templates/new" data-testid="templates-new-link">
          <Button>
            <Plus size={14} /> New template
          </Button>
        </Link>
      </header>

      {isLoading ? (
        <div className="template-list__empty">
          <p>Loading templates…</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="template-list__empty" data-testid="templates-empty">
          <div className="template-list__empty-art" aria-hidden="true">
            <LayoutTemplate size={32} />
          </div>
          <h2 className="template-list__empty-title">No templates yet</h2>
          <p className="template-list__empty-hint">
            Create your first template to get started. You will be redirected to the visual builder where you
            can add, edit, and reorder blocks.
          </p>
          <Link href="/templates/new" data-testid="templates-empty-cta">
            <Button>
              <Plus size={14} /> Create your first template
            </Button>
          </Link>
        </div>
      ) : (
        <div className="template-card-grid" data-testid="templates-grid">
          {templates.map((t) => {
            const status = statusFor(t);
            const updated = new Date(t.updatedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            return (
              <Link
                key={t.id}
                href={`/templates/${t.id}`}
                className="template-card"
                data-testid={`template-card-${t.id}`}
                aria-label={`Edit ${t.name}`}
              >
                <div className="template-card__head">
                  <div>
                    <h2 className="template-card__title">{t.name}</h2>
                    <code className="template-card__slug">{t.slug}</code>
                  </div>
                  <span
                    className={`page-builder__pill page-builder__pill--${
                      status.tone === 'published' ? 'saved' : 'dirty'
                    }`}
                  >
                    {status.label}
                  </span>
                </div>
                {t.description ? (
                  <p className="text-xs" style={{ color: 'var(--color-muted-foreground)', margin: 0 }}>
                    {t.description}
                  </p>
                ) : null}
                <div className="template-card__meta">
                  <span className="template-card__count">
                    <LayoutTemplate size={12} aria-hidden="true" />
                    {t.sections.length} block{t.sections.length === 1 ? '' : 's'}
                  </span>
                  <span>·</span>
                  <span>
                    <Calendar
                      size={12}
                      aria-hidden="true"
                      style={{ marginRight: 4, verticalAlign: 'middle' }}
                    />
                    {updated}
                  </span>
                </div>
                <div className="template-card__edit">
                  <span className="btn btn-ghost" aria-hidden="true">
                    <ArrowUpRight size={14} /> Edit
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => void onDelete(t.id, t.name, e)}
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', color: 'var(--color-danger)' }}
                  aria-label={`Delete ${t.name}`}
                  data-testid={`template-delete-${t.id}`}
                >
                  <Trash2 size={12} />
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
