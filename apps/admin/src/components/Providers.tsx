'use client';

import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@q-cms/ui';
import { getQueryClient } from '../lib/query-client.ts';
import { ToastProvider } from './Toaster.tsx';
import { AuthProvider } from './AuthProvider.tsx';

/**
 * Client-side provider stack.
 *
 * The root `layout.tsx` is a Server Component, but `QueryClient`
 * (and the auth context) is a class / live object that can't be
 * serialized across the server→client boundary. Wrapping the tree
 * in a 'use client' component lets Next.js ship the providers as
 * part of the client bundle while keeping the layout itself on
 * the server.
 */
export function Providers({ children }: { children: ReactNode }): React.JSX.Element {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
