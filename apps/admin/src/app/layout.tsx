import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '../components/Providers.tsx';
import { buildThemeBootstrapScript } from '../lib/theme-bootstrap.ts';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Q-CMS Admin',
    template: '%s · Q-CMS Admin',
  },
  description: 'Headless CMS administration UI',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  // Pre-paint theme bootstrap. Rendered as a synchronous inline
  // `<script>` in `<head>` so the user's stored theme is applied
  // BEFORE the first paint — no flash of the default light theme
  // for users on dark. The script body is generated from
  // `@q-cms/theme` so theme tokens never drift from the source of
  // truth. The data-attributes the script sets (`data-theme`,
  // `data-mode`) are also why `<html>` has `suppressHydrationWarning`.
  //
  // `lang` is also set client-side by `I18nProviderClient` after the
  // stored locale hydrates. The initial `en` value is a safe default
  // for SSR and is updated post-hydration — `suppressHydrationWarning`
  // on `<html>` covers the small mismatch window.
  const themeBootstrap = buildThemeBootstrapScript();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
