/**
 * Top-level schema configuration.
 *
 * `defineConfig()` is the entry-point — a type-safe identity function that
 * validates structural invariants at the TypeScript level.
 */

import type { CollectionConfig } from "./collections.ts";
import type { ComponentConfig } from "./components.ts";
import type { BlocksMap } from "./blocks.ts";

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

import type { WebhookEvent } from "@q-cms/core";

/** Per-webhook configuration. */
export interface WebhookConfig {
  /** Descriptive name shown in the admin UI. */
  name: string;
  /** Events that trigger this webhook. */
  events: readonly WebhookEvent[];
  /** Destination URL (supports `$env.VAR` interpolation). */
  url: string;
  /** Optional secret for HMAC signature verification. */
  secret?: string;
}

// ---------------------------------------------------------------------------
// Root config
// ---------------------------------------------------------------------------

/** The complete content schema definition. */
export interface QCMSConfig {
  /** Human-readable project name. */
  name: string;
  /** Default (fallback) locale code. */
  defaultLocale: string;
  /** Available locale codes (e.g. `["en", "ru", "de"]`). */
  locales: readonly string[];
  /** Collection definitions keyed by collection name. */
  collections: Record<string, CollectionConfig>;
  /** Reusable component definitions keyed by component name. */
  components?: Record<string, ComponentConfig>;
  /** Block definitions for dynamic zones. */
  blocks?: BlocksMap;
  /** Webhook registrations. */
  webhooks?: readonly WebhookConfig[];
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Define the full CMS content schema.
 *
 * Returns the config unchanged; TypeScript validates structural invariants.
 *
 * @example
 * ```ts
 * export default defineConfig({
 *   name: "blog",
 *   defaultLocale: "en",
 *   locales: ["en", "ru", "de"],
 *   collections: { Article: collection({ ... }) },
 *   components: { SEO: component({ ... }) },
 *   blocks: { ...blocks.core },
 * });
 * ```
 */
export function defineConfig(config: QCMSConfig): QCMSConfig {
  // Basic runtime validation
  if (!config.locales.includes(config.defaultLocale)) {
    throw new Error(
      `defaultLocale "${config.defaultLocale}" not found in locales array`,
    );
  }

  for (const [colName, col] of Object.entries(config.collections)) {
    if (col.singleton && col.draftAndPublish) {
      throw new Error(
        `Collection "${colName}": singleton collections cannot have draftAndPublish`,
      );
    }
    // Validate relation targets exist
    for (const [fieldName, field] of Object.entries(col.fields)) {
      if (field.type === "relation" && field.target !== colName) {
        if (!(field.target in config.collections)) {
          throw new Error(
            `Collection "${colName}" field "${fieldName}": relation target "${field.target}" not found`,
          );
        }
      }
    }
    // Validate component references exist
    for (const [fieldName, field] of Object.entries(col.fields)) {
      if (field.type === "component") {
        const comps = config.components ?? {};
        if (!(field.component in comps)) {
          throw new Error(
            `Collection "${colName}" field "${fieldName}": component "${field.component}" not found`,
          );
        }
      }
    }
    // Validate block references exist
    for (const [fieldName, field] of Object.entries(col.fields)) {
      if (field.type === "blocks") {
        const blks = config.blocks ?? {};
        for (const blockRef of field.blocks) {
          const refKey = typeof blockRef === "string" ? blockRef : blockRef.ref;
          if (!(refKey in blks)) {
            throw new Error(
              `Collection "${colName}" field "${fieldName}": block "${refKey}" not found`,
            );
          }
        }
      }
    }
    // Validate uid/slug target fields exist
    for (const [fieldName, field] of Object.entries(col.fields)) {
      if ((field.type === "uid" || field.type === "slug") && field.target) {
        if (!(field.target in col.fields)) {
          throw new Error(
            `Collection "${colName}" field "${fieldName}": target field "${field.target}" not found in fields`,
          );
        }
      }
    }
  }

  return config;
}
