/**
 * Shared constants used across Q-CMS packages.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Default number of items per page for list endpoints. */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum number of items per page allowed by the API. */
export const MAX_PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Prefix for all API routes. */
export const API_PREFIX = "/api" as const;

/** Supported API version prefix. */
export const API_VERSION = "v1" as const;

/** Full API base path. */
export const API_BASE_PATH = `${API_PREFIX}/${API_VERSION}` as const;

// ---------------------------------------------------------------------------
// Error messages
// ---------------------------------------------------------------------------

/** Common error messages used across the application. */
export const ERROR_MESSAGES = {
  /** Generic internal server error. */
  INTERNAL: "Internal server error",
  /** Resource not found. */
  NOT_FOUND: "Not found",
  /** Request validation failed. */
  VALIDATION: "Validation failed",
  /** User is not authenticated. */
  UNAUTHORIZED: "Unauthorized",
  /** Authenticated user lacks permission. */
  FORBIDDEN: "Forbidden",
  /** Rate limit exceeded. */
  RATE_LIMITED: "Too many requests",
  /** Conflict with existing resource. */
  CONFLICT: "Resource already exists",
  /** Request payload is malformed. */
  BAD_REQUEST: "Bad request",
  /** Service is temporarily unavailable. */
  SERVICE_UNAVAILABLE: "Service temporarily unavailable",
} as const;

// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------

/** Default request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Maximum request timeout in milliseconds. */
export const MAX_TIMEOUT_MS = 300_000;

// ---------------------------------------------------------------------------
// Content limits
// ---------------------------------------------------------------------------

/** Maximum slug length for content entries. */
export const MAX_SLUG_LENGTH = 200;

/** Maximum title length for content entries. */
export const MAX_TITLE_LENGTH = 500;

/** Maximum length for short text fields (summaries, descriptions). */
export const MAX_SHORT_TEXT_LENGTH = 2_000;

// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------

/** Regex validating a BCP-47 locale tag (e.g. "en", "en-US", "zh-Hans-CN"). */
export const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2,3})?$/;

export const localeSchema = z.string().regex(LOCALE_PATTERN, "Invalid locale tag");
