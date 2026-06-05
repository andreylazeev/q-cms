import type { Metadata, Viewport } from 'next';
import { type ReactNode } from 'react';
import { Providers } from '../components/Providers.tsx';
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
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
