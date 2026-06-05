/**
 * Server configuration types and defaults.
 * Reads from environment variables with sensible fallbacks.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const collabConfigSchema = z.object({
  /** HTTP/WS port. Default 1234. */
  PORT: z.coerce.number().int().positive().default(1234),
  /** Redis connection URL for horizontal scaling. Optional. */
  REDIS_URL: z.string().url().optional(),
  /** JWT secret for WebSocket auth verification. */
  JWT_SECRET: z.string().min(1),
  /** Directory for file-based document persistence. */
  DATA_DIR: z.string().default("./.collab-data"),
});

export type CollabConfig = z.infer<typeof collabConfigSchema>;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULTS = {
  port: 1234,
  dataDir: "./.collab-data",
} as const;

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

let cachedConfig: CollabConfig | undefined;

/**
 * Parse and validate environment variables.
 * Result is cached after first call; subsequent calls return the cached value.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): CollabConfig {
  if (cachedConfig) return cachedConfig;
  cachedConfig = collabConfigSchema.parse({
    ...env,
    PORT: env["COLLAB_PORT"],
  });
  return cachedConfig;
}

/** Reset cached config (for tests). */
export function resetConfig(): void {
  cachedConfig = undefined;
}
