'use client';

import { ArrowUpRight, Calendar, LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@q-cms/i18n/react';
import { useToast } from '../../../components/Toaster.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { getApiClient } from '../../../lib/api-client.ts';
import type { SdkTemplate } from '../../../lib/stubs/api-client.ts';

function statusFor(
  template: SdkTemplate,
  t: (key: string) => string,
): { label: string; tone: 'draft' | 'published' | 'stale' } {
  // The seed stub has no `status` field; fall back to recency. A
  // template touched in the last 24h is treated as the live
  // "Published" version (just-saved edits show as published); older,
  // untouched templates show as "Stale" to draw the eye to them.
  const ageMs = Date.now() - new Date(template.updatedAt).getTime();
  if (ageMs < 24 * 60 * 60 * 1000)
    return { label: t('templates.statusPublished'), tone: 'published' };
  return { label: t('templates.statusStale'), tone: 'stale' };
}

export default function TemplatesListPage(): React.JSX.Element {
  const { t, formatDate } = useI18n();
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
          toastError(err instanceof Error ? err.message : t('templates.loadFailed'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [toastError, t]);

  async function onDelete(id: string, name: string, ev: React.MouseEvent): Promise<void> {
    ev.preventDefault();
    ev.stopPropagation();
    if (!confirm(t('templates.deleteConfirm', { name }))) return;
    try {
      await getApiClient().templates.delete(id);
      setTemplates((prev) => prev.filter((tt) => tt.id !== id));
      success(t('templates.deleteSuccess', { name }));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t('templates.deleteFailed'));
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="templates-page">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('templates.title')}</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            {t('templates.subtitle')}
          </p>
        </div>
        <Link href="/templates/new" data-testid="templates-new-link">
          <Button>
            <Plus size={14} /> {t('templates.newTemplate')}
          </Button>
        </Link>
      </header>

      {isLoading ? (
        <div className="template-list__empty">
          <p>{t('templates.loading')}</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="template-list__empty" data-testid="templates-empty">
          <div className="template-list__empty-art" aria-hidden="true">
            <LayoutTemplate size={32} />
          </div>
          <h2 className="template-list__empty-title">{t('templates.emptyTitle')}</h2>
          <p className="template-list__empty-hint">{t('templates.emptyHint')}</p>
          <Link href="/templates/new" data-testid="templates-empty-cta">
            <Button>
              <Plus size={14} /> {t('templates.emptyCta')}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="template-card-grid" data-testid="templates-grid">
          {templates.map((tt) => {
            const status = statusFor(tt, t);
            const updated = formatDate(tt.updatedAt);
            const sectionLabel = t(
              tt.sections.length === 1 ? 'templates.block' : 'templates.blocks',
            );
            return (
              <Link
                key={tt.id}
                href={`/templates/${tt.id}`}
                className="template-card"
                data-testid={`template-card-${tt.id}`}
                aria-label={t('templates.editAria', { name: tt.name })}
              >
                <div className="template-card__head">
                  <div className="template-card__head-text">
                    <h2 className="template-card__title">{tt.name}</h2>
                    <code className="template-card__slug">{tt.slug}</code>
                  </div>
                  <div className="template-card__actions">
                    <span
                      className={`page-builder__pill page-builder__pill--${
                        status.tone === 'published' ? 'saved' : status.tone === 'stale' ? 'stale' : 'dirty'
                      }`}
                    >
                      {status.label}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => void onDelete(tt.id, tt.name, e)}
                      className="template-card__delete"
                      aria-label={t('templates.deleteAria', { name: tt.name })}
                      data-testid={`template-delete-${tt.id}`}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {tt.description ? (
                  <p
                    className="text-xs"
                    style={{ color: 'var(--color-muted-foreground)', margin: 0 }}
                  >
                    {tt.description}
                  </p>
                ) : null}
                <div className="template-card__meta">
                  <span className="template-card__count">
                    <LayoutTemplate size={12} aria-hidden="true" />
                    {tt.sections.length} {sectionLabel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="template-card__date">
                    <Calendar size={12} aria-hidden="true" />
                    {updated}
                  </span>
                  <span className="template-card__edit" aria-hidden="true">
                    <span className="btn btn-ghost">
                      <ArrowUpRight size={14} /> {t('templates.edit')}
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
