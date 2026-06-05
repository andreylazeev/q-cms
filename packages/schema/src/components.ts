/**
 * Component builder.
 *
 * Components are reusable field groups that can be embedded in
 * collections or other components via `{ type: "component", component: "…" }`.
 */

import type { FieldMap } from "./types.ts";

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

/** Configuration returned by the `component()` builder. */
export interface ComponentConfig {
  fields: FieldMap;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Define a reusable component (field group).
 *
 * @example
 * ```ts
 * const SEO = component({
 *   fields: {
 *     title: { type: "text", maxLength: 70 },
 *     description: { type: "text", maxLength: 160 },
 *   },
 * });
 * ```
 */
export function component(config: ComponentConfig): ComponentConfig {
  return config;
}
