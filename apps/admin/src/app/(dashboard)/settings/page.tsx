'use client';

import { ThemePicker, useTheme } from '@q-cms/ui';
import { useState, type FormEvent } from 'react';
import { Card } from '../../../components/ui/Card.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { Input } from '../../../components/ui/Input.tsx';
import { Select } from '../../../components/ui/Select.tsx';
import { ThemePreview, TokenInspector } from '../../../components/ThemePicker';
import { useToast } from '../../../components/Toaster.tsx';
import { StatusBadge } from '../../../components/StatusBadge.tsx';

const LOCALES: readonly string[] = ['en', 'ru', 'de', 'es', 'fr', 'zh'];

export default function SettingsPage(): React.JSX.Element {
  const { success } = useToast();
  const {
    theme,
    themeName,
    mode,
    resolvedMode,
    availableThemes,
    setThemeName,
    setMode,
    reset,
  } = useTheme();
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
    success('Settings saved');
  }

  function onResetTheme(): void {
    reset();
    success('Theme reset to defaults');
  }

  return (
    <div className="flex flex-col gap-6" data-testid="settings-page">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          Site configuration, locales, and integrations.
        </p>
      </header>

      <form onSubmit={onSave} className="flex flex-col gap-6">
        <Card title="Site" description="General site metadata.">
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Site name"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />
            <Select
              label="Default locale"
              value={defaultLocale}
              onChange={(e) => setDefaultLocale(e.target.value)}
              options={LOCALES.map((l) => ({ value: l, label: l }))}
            />
            <div>
              <p className="mb-1.5 text-sm font-medium">Supported locales</p>
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
                      aria-label={`Remove ${loc}`}
                      onClick={() => removeLocale(loc)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Select
                  aria-label="Add locale"
                  value={pendingLocale}
                  onChange={(e) => setPendingLocale(e.target.value)}
                  options={[{ value: '', label: 'Select…' }, ...LOCALES.map((l) => ({ value: l, label: l }))]}
                />
                <Button type="button" variant="secondary" size="sm" onClick={addLocale}>
                  Add
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Button type="submit" variant="primary" size="sm">
              Save changes
            </Button>
          </div>
        </Card>
      </form>

      {/* Theme card — the polished version: 2-col with preview
          on the left, picker on the right, token inspector below. */}
      <Card
        title="Theme"
        description="Switch the admin palette. The active theme is stored in this browser only (localStorage key: qcms_theme) and syncs across tabs."
      >
        <div className="flex flex-col gap-6">
          {/* Two-column layout: preview on the left, picker on the right. */}
          <div
            className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]"
            data-testid="theme-card-layout"
          >
            <div className="flex flex-col gap-2">
              <p
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--color-fg-muted)' }}
              >
                Live preview
              </p>
              <ThemePreview theme={theme} mode={resolvedMode} />
              <p
                className="text-xs"
                style={{ color: 'var(--color-fg-subtle)' }}
              >
                Renders the active theme on a sample article header.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--color-fg-muted)' }}
              >
                Gallery
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
              Need a clean slate? Reset removes your saved theme and reverts to{' '}
              <code style={{ fontFamily: 'var(--font-mono)' }}>default</code> in{' '}
              <code style={{ fontFamily: 'var(--font-mono)' }}>auto</code> mode.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onResetTheme}
              data-testid="theme-reset"
            >
              Reset to defaults
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
              Token inspector
              <span
                className="ml-2 text-xs font-normal"
                style={{ color: 'var(--color-fg-muted)' }}
              >
                — every value in the active theme
              </span>
            </summary>
            <div className="p-3 pt-0">
              <TokenInspector theme={theme} mode={resolvedMode} />
            </div>
          </details>
        </div>
      </Card>

      <Card title="Webhooks" description="Outgoing event notifications.">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr style={{ color: 'var(--color-muted-foreground)' }}>
              <th className="px-2 py-1 text-left font-medium">Name</th>
              <th className="px-2 py-1 text-left font-medium">URL</th>
              <th className="px-2 py-1 text-left font-medium">Events</th>
              <th className="px-2 py-1 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="px-2 py-3 text-center" style={{ color: 'var(--color-muted-foreground)' }}>
                No webhooks configured.
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="API tokens" description="Personal access tokens for the REST/GraphQL API.">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr style={{ color: 'var(--color-muted-foreground)' }}>
              <th className="px-2 py-1 text-left font-medium">Name</th>
              <th className="px-2 py-1 text-left font-medium">Prefix</th>
              <th className="px-2 py-1 text-left font-medium">Scopes</th>
              <th className="px-2 py-1 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="px-2 py-3 text-center" style={{ color: 'var(--color-muted-foreground)' }}>
                No tokens issued.
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <StatusBadge status="info" />
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            Settings are read from and persisted to <code>/api/v1/settings</code>.
          </p>
        </div>
      </Card>
    </div>
  );
}
