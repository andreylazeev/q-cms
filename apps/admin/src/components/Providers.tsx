'use client';

import { ThemeProvider } from '@q-cms/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProviderClient } from '../i18n/I18nProviderClient.tsx';
import { getQueryClient } from '../lib/query-client.ts';
import { AuthProvider } from './AuthProvider.tsx';
import { ToastProvider } from './Toaster.tsx';

/**
 * Client-side provider stack.
 *
 * The root `layout.tsx` is a Server Component, but `QueryClient`
 * (and the auth context) is a class / live object that can't be
 * serialized across the server→client boundary. Wrapping the tree
 * in a 'use client' component lets Next.js ship the providers as
 * part of the client bundle while keeping the layout itself on the
 * server.
 *
 * Provider order matters:
 *  - `I18nProviderClient` is the outermost so error boundaries and
 *    auth flows can surface translated messages even if a deeper
 *    provider throws.
 *  - `ThemeProvider` reads from localStorage and is independent of
 *    i18n.
 *  - `AuthProvider` and `ToastProvider` are pure client state.
 */
export function Providers({ children }: { children: ReactNode }): React.JSX.Element {
  const queryClient = getQueryClient();
  return (
    <I18nProviderClient>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </I18nProviderClient>
  );
}
