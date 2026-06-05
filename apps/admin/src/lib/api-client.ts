/**
 * Singleton Q-CMS API client for the admin app.
 *
 * The admin app can run in two modes:
 *   1. **Real API mode** — when `NEXT_PUBLIC_QCMS_API_URL` is set and
 *      a real `@q-cms/sdk` is wired up, we use that.
 *   2. **Stub mode** — the default in dev when the rest of the
 *      monorepo isn't fully built; we use the local stub so screens
 *      can be iterated on without infrastructure.
 *
 * The singleton lives on `globalThis` to survive Fast Refresh and
 * SSR/CSR re-hydration, mirroring the TanStack Query singleton
 * pattern.
 */

import { createClient as createStubClient, type StubClient } from './stubs/api-client.ts';

export type QcmsClient = StubClient;

declare global {
  // eslint-disable-next-line no-var
  var __QCMS_ADMIN_CLIENT__: QcmsClient | undefined;
}

function getEnvBaseUrl(): string {
  // Avoid referencing `process` in the browser when not available.
  if (typeof process !== 'undefined' && process.env) {
    const url = process.env['NEXT_PUBLIC_QCMS_API_URL'];
    if (url && url.length > 0) return url;
  }
  return 'http://localhost:3000';
}

function getEnvToken(): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    const token = process.env['NEXT_PUBLIC_QCMS_TOKEN'];
    if (token && token.length > 0) return token;
  }
  return undefined;
}

function makeClient(): QcmsClient {
  // Note: in production builds we would `import { createClient } from '@q-cms/sdk'`
  // once that package is fully available. Until then, the local stub keeps
  // the type surface stable.
  const token = getEnvToken();
  return createStubClient({
    baseUrl: getEnvBaseUrl(),
    ...(token ? { token } : {}),
  });
}

/** Resolve the singleton client, creating it on first access. */
export function getApiClient(): QcmsClient {
  if (!globalThis.__QCMS_ADMIN_CLIENT__) {
    globalThis.__QCMS_ADMIN_CLIENT__ = makeClient();
  }
  return globalThis.__QCMS_ADMIN_CLIENT__;
}

/** Reset the client — useful in tests. */
export function resetApiClient(): void {
  globalThis.__QCMS_ADMIN_CLIENT__ = undefined;
}
