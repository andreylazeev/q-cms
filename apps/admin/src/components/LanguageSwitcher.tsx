'use client';

/**
 * Language switcher — a small `<select>` that drives the active
 * locale. The picker reads the current locale from `useI18n` and
 * calls `setLocaleFromUi` (in `I18nProviderClient.tsx`) on change.
 *
 * The visible labels are translated through the `language.*` keys so
 * the picker itself shows "English / Русский" in the user's chosen
 * language.
 */

import { useI18n } from '@q-cms/i18n/react';
import { Languages } from 'lucide-react';
import { useId } from 'react';
import { setLocaleFromUi } from '../i18n/I18nProviderClient.tsx';
import { LOCALE_LABELS, SUPPORTED_LOCALES, type SupportedLocale } from '../i18n/setup.ts';
import { i18n } from '../i18n/setup.ts';

export function LanguageSwitcher(): React.JSX.Element {
  const { locale } = useI18n();
  const labelId = useId();
  const current = (i18n.getLocale() as SupportedLocale) ?? 'en';
  const label = locale === 'ru' ? 'Язык' : 'Language';

  return (
    <div className="flex items-center gap-1.5" aria-labelledby={labelId}>
      <Languages size={14} aria-hidden="true" style={{ color: 'var(--color-muted-foreground)' }} />
      <label htmlFor={`${labelId}-select`} id={labelId} className="sr-only">
        {label}
      </label>
      <select
        id={`${labelId}-select`}
        value={current}
        onChange={(e) => setLocaleFromUi(e.target.value as SupportedLocale)}
        aria-label={label}
        data-testid="language-switcher"
        className="rounded-md border bg-transparent px-2 py-1 text-xs"
        style={{
          borderColor: 'var(--color-border)',
          color: 'var(--color-foreground)',
          background: 'var(--color-background)',
        }}
      >
        {SUPPORTED_LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {LOCALE_LABELS[loc]}
          </option>
        ))}
      </select>
    </div>
  );
}
