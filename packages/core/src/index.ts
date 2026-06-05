/**
 * @q-cms/core — domain primitives, branded types, Result helpers,
 * error hierarchy and validation utilities for Q-CMS.
 *
 * This package has zero runtime dependencies outside of `zod` and is
 * safe to import from any layer (Node, Bun, edge runtime).
 *
 * @packageDocumentation
 */

export * from './branded.ts';
export * from './result.ts';
export * from './errors/index.ts';
export * from './types/index.ts';
export * from './validate/index.ts';
