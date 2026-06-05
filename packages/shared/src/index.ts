/**
 * @q-cms/shared — common utilities and constants used across the monorepo.
 */

// Re-export everything from sub-modules so consumers can do
// `import { slugify, DEFAULT_PAGE_SIZE } from "@q-cms/shared"`.

export * from "./utils/index.ts";
export * from "./constants.ts";
export * from "./i18n.ts";
