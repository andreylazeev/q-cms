/**
 * Re-export surface for the local stubs.
 *
 * Routes import types/errors from `core-shim.ts`, auth helpers from
 * `auth.ts`, and config from `config-shim.ts`. Repos are imported
 * from `../repos/index.ts` instead.
 * The stubs are used by tests. Routes are imported from `../repos/`.
 *
 * @module lib/stubs
 */

export * from './auth.ts';
export * from './core-shim.ts';
export * from './config-shim.ts';
export * from './db.ts';