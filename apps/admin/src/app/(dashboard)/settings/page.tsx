'use client';

import { useI18n } from '@q-cms/i18n/react';
import { ThemePicker, useTheme } from '@q-cms/ui';
import { type FormEvent, useState } from 'react';
import { StatusBadge } from '../../../components/StatusBadge.tsx';
import { ThemePreview, TokenInspector } from '../../../components/ThemePicker';
import { useToast } from '../../../components/Toaster.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { Card } from '../../../components/ui/Card.tsx';
import { Input } from '../../../components/ui/Input.tsx';
import { Select } from '../../../components/ui/Select.tsx';

const LOCALES: readonly string[] = ['en', 'ru', 'de', 'es', 'fr', 'zh'];

export default function SettingsPage(): React.JSX.Element {
  const { t } = useI18n();
  const { success } = useToast();
  const { theme, themeName, mode, resolvedMode, availableThemes, setThemeName, setMode, reset } = useTheme();
  const [siteName, setSiteName] = useState('My Q-CMS Site');
  const [defaultLocale, setDefaultLocale] = useState('en');
  const [supportedLocales, setSupportedLocales] = useState<string[]>(['en', 'ru']);
  const [pendingLocale, setPendingLocale] = useState('');

  function addLocale(): void {
    if (!pendingLocale) return;
    if (supportedLocales.includes(pendingLocale)) {
      setPendingLocale('');
      return;
    }
    setSupportedLocales((cur) => [...cur, pendingLocale]);
    setPendingLocale('');
  }

  function removeLocale(loc: string): void {
    setSupportedLocales((cur) => cur.filter((l) => l !== loc));
  }

  function onSave(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    success(t('settings.settingsSaved'));
  }

  function onResetTheme(): void {
    reset();
    success(t('settings.resetSuccess'));
  }

  return (
    <div className="flex flex-col gap-6" data-testid="settings-page">
      <header>
        <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('settings.subtitle')}
        </p>
      </header>

      <form onSubmit={onSave} className="flex flex-col gap-6">
        <Card title={t('settings.siteCardTitle')} description={t('settings.siteCardDescription')}>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label={t('settings.siteName')}
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />
            <Select
              label={t('settings.defaultLocale')}
              value={defaultLocale}
              onChange={(e) => setDefaultLocale(e.target.value)}
              options={LOCALES.map((l) => ({ value: l, label: l }))}
            />
            <div>
              <p className="mb-1.5 text-sm font-medium">{t('settings.supportedLocales')}</p>
              <div className="flex flex-wrap gap-2" role="list">
                {supportedLocales.map((loc) => (
                  <span
                    key={loc}
                    role="listitem"
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                    style={{ background: 'var(--color-muted)' }}
                  >
                    {loc}
                    <button
                      type="button"
                      className="ml-1"
                      aria-label={t('common.removeAria', { name: loc })}
                      onClick={() => removeLocale(loc)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Select
                  aria-label={t('settings.addLocale')}
                  value={pendingLocale}
                  onChange={(e) => setPendingLocale(e.target.value)}
                  options={[
                    { value: '', label: t('common.selectPlaceholder') },
                    ...LOCALES.map((l) => ({ value: l, label: l })),
                  ]}
                />
                <Button type="button" variant="secondary" size="sm" onClick={addLocale}>
                  {t('common.add')}
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Button type="submit" variant="primary" size="sm">
              {t('common.saveChanges')}
            </Button>
          </div>
        </Card>
      </form>

      {/* Theme card — the polished version: 2-col with preview
          on the left, picker on the right, token inspector below. */}
      <Card title={t('settings.themeCardTitle')} description={t('settings.themeCardDescription')}>
        <div className="flex flex-col gap-6">
          {/* Two-column layout: preview on the left, picker on the right. */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]" data-testid="theme-card-layout">
            <div className="flex flex-col gap-2">
              <p
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--color-fg-muted)' }}
              >
                {t('settings.livePreview')}
              </p>
              <ThemePreview theme={theme} mode={resolvedMode} />
              <p className="text-xs" style={{ color: 'var(--color-fg-subtle)' }}>
                {t('settings.livePreviewHint')}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--color-fg-muted)' }}
              >
                {t('settings.gallery')}
              </p>
              <ThemePicker
                themes={availableThemes}
                value={themeName}
                onChange={setThemeName}
                mode={mode}
                onModeChange={setMode}
              />
            </div>
          </div>

          {/* Reset to defaults */}
          <div
            className="flex items-center justify-between gap-3 rounded-md border p-3"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
              {t('settings.resetHint')}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onResetTheme}
              data-testid="theme-reset"
            >
              {t('settings.resetButton')}
            </Button>
          </div>

          {/* Token inspector */}
          <details
            className="rounded-md border"
            style={{ borderColor: 'var(--color-border)' }}
            data-testid="token-inspector-details"
          >
            <summary
              className="cursor-pointer select-none p-3 text-sm font-medium"
              style={{ color: 'var(--color-fg)' }}
            >
              {t('settings.tokenInspector')}
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-fg-muted)' }}>
                {t('settings.tokenInspectorHint')}
              </span>
            </summary>
            <div className="p-3 pt-0">
              <TokenInspector theme={theme} mode={resolvedMode} />
            </div>
          </details>
        </div>
      </Card>

      <Card title={t('settings.webhooksTitle')} description={t('settings.webhooksDescription')}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--color-muted-foreground)' }}>
              <th className="px-2 py-1 text-left font-medium">{t('settings.tableName')}</th>
              <th className="px-2 py-1 text-left font-medium">{t('settings.tableUrl')}</th>
              <th className="px-2 py-1 text-left font-medium">{t('settings.tableEvents')}</th>
              <th className="px-2 py-1 text-left font-medium">{t('settings.tableStatus')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={4}
                className="px-2 py-3 text-center"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {t('settings.noWebhooks')}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title={t('settings.apiTokensTitle')} description={t('settings.apiTokensDescription')}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--color-muted-foreground)' }}>
              <th className="px-2 py-1 text-left font-medium">{t('settings.tableName')}</th>
              <th className="px-2 py-1 text-left font-medium">{t('settings.tablePrefix')}</th>
              <th className="px-2 py-1 text-left font-medium">{t('settings.tableScopes')}</th>
              <th className="px-2 py-1 text-left font-medium">{t('settings.tableStatus')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={4}
                className="px-2 py-3 text-center"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {t('settings.noTokens')}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <StatusBadge status="info" />
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            {t('settings.persistedHint')}
          </p>
        </div>
      </Card>
    </div>
  );
}
