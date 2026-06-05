/**
 * @q-cms/collab — real-time collaboration server.
 *
 * @packageDocumentation
 */

export { startServer, type StartServerResult } from "./server.js";
export {
  loadConfig,
  resetConfig,
  collabConfigSchema,
  type CollabConfig,
  DEFAULTS,
} from "./config.js";
export {
  authenticateConnection,
  extractToken,
  type CollabUserContext,
} from "./auth.js";
export { fetchDocument, storeDocument, deleteDocument } from "./persistence.js";
