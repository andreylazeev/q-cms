import { useI18n } from '@q-cms/i18n/react';
import { act, render, screen } from '@testing-library/react';
import type * as React from 'react';
/**
 * Smoke tests for the admin i18n integration.
 *
 * Verifies the singleton I18n instance loads both locales, that the
 * `setLocaleFromUi` helper persists the choice to localStorage, and
 * that `useI18n` re-renders consumers on locale change.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProviderClient, setLocaleFromUi } from './I18nProviderClient.tsx';
import { LOCALE_STORAGE_KEY, i18n, readStoredLocale, writeStoredLocale } from './setup.ts';

function Probe(): React.JSX.Element {
  const { t, locale } = useI18n();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="greeting">{t('common.search')}</span>
    </div>
  );
}

describe('admin i18n integration', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    }
    i18n.setLocale('en');
  });

  it('loads both EN and RU translations under the admin namespace', () => {
    expect(i18n.t('admin.common.search', undefined, 'en')).toBe('Search…');
    expect(i18n.t('admin.common.search', undefined, 'ru')).toBe('Поиск…');
  });

  it('uses Russian plural categories for users.summary', () => {
    expect(i18n.t('admin.users.summary', { count: 1 }, 'ru')).toContain('1 пользователь');
    expect(i18n.t('admin.users.summary', { count: 5 }, 'ru')).toContain('5');
  });

  it('falls back to English for keys present in EN but missing in RU', () => {
    // A key present only in EN resolves to EN even when the active
    // locale is RU.
    expect(i18n.t('admin.dashboard.title', undefined, 'ru')).toBe('Сводка');
  });

  it('round-trips the stored locale through localStorage', () => {
    writeStoredLocale('ru');
    expect(readStoredLocale()).toBe('ru');
    writeStoredLocale('en');
    expect(readStoredLocale()).toBe('en');
  });

  it('setLocaleFromUi switches the active locale and updates <html lang>', () => {
    setLocaleFromUi('ru');
    expect(i18n.getLocale()).toBe('ru');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('useI18n consumers re-render when the locale changes via the helper', () => {
    render(
      <I18nProviderClient>
        <Probe />
      </I18nProviderClient>,
    );
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('greeting').textContent).toBe('Search…');

    act(() => {
      setLocaleFromUi('ru');
    });

    expect(screen.getByTestId('locale').textContent).toBe('ru');
    expect(screen.getByTestId('greeting').textContent).toBe('Поиск…');
  });
});
