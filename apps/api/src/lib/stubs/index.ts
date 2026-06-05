/**
 * Re-export surface for the local stubs. Routes import from this
 * module instead of `@q-cms/auth` and `@q-cms/db` directly so the
 * API compiles while the real packages are being built.
 *
 * @module lib/stubs
 */

export * from './auth.ts';
export * from './db.ts';
