import type { Metadata, Viewport } from 'next';
import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '../lib/query-client.ts';
import { ToastProvider } from '../components/Toaster.tsx';
import { AuthProvider } from '../components/AuthProvider.tsx';
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
  const queryClient = getQueryClient();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
