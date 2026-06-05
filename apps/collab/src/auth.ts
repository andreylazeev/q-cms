/**
 * WebSocket connection authentication.
 * Extracts and verifies JWT tokens from Hocuspocus connection params.
 */

import { verifyAccessToken, type JwtPayload } from "@q-cms/auth";
import type { CollabConfig } from "./config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Authenticated user context available to downstream hooks. */
export interface CollabUserContext {
  readonly userId: string;
  readonly email: string;
  readonly roles: readonly string[];
}

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

/**
 * Extract a raw token string from Hocuspocus connection parameters.
 * The token may arrive as:
 * - `token` query param (standard Hocuspocus provider)
 * - `connectionParams.token` (generic pass-through)
 */
export function extractToken(params: Record<string, unknown>): string | null {
  const raw = params.token;
  if (typeof raw === "string" && raw.length > 0) return raw;

  const connParams = params.connectionParams;
  if (connParams != null && typeof connParams === "object") {
    const conn = connParams as Record<string, unknown>;
    const nested = conn.token;
    if (typeof nested === "string" && nested.length > 0) return nested;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Verify a JWT token and return the authenticated user context.
 * Throws if the token is missing, invalid, or expired.
 *
 * Designed for use inside Hocuspocus `onAuthenticate`.
 */
export async function authenticateConnection(
  token: string,
  config: Pick<CollabConfig, "JWT_SECRET">,
): Promise<CollabUserContext> {
  const result = await verifyAccessToken(token, {
    secret: config.JWT_SECRET,
  });

  if (!result.ok) {
    throw result.error;
  }

  return toCollabUser(result.value);
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function toCollabUser(payload: JwtPayload): CollabUserContext {
  return {
    userId: payload.sub,
    email: payload.email,
    roles: payload.roles,
  };
}
