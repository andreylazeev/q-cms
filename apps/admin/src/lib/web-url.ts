/**
 * Origin of the public web app the admin's PageBuilder preview iframe
 * loads its template-engine bridge from.
 *
 * The preview iframe is a `data:` URI document, so relative script
 * sources inside it can't be resolved. We hard-wire it to the running
 * web app — keep this in sync with the `WEB_URL` / `WEB_PORT` env vars
 * consumed by `apps/web/server.mjs`.
 *
 * Override with `NEXT_PUBLIC_QCMS_WEB_URL` (e.g. for staging or when
 * the web app is reverse-proxied under a different host).
 */
export const WEB_BASE_URL: string =
  (typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_QCMS_WEB_URL']) ||
  'http://localhost:3002';
