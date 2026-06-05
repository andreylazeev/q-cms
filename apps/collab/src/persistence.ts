/**
 * File-based Y.js document persistence.
 *
 * Each document is stored as a file under `DATA_DIR/<sanitized-name>.yjs`.
 * Provides `fetch` and `store` functions compatible with
 * `@hocuspocus/extension-database`.
 */

import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Sanitisation
// ---------------------------------------------------------------------------

/**
 * Replace characters unsafe for filesystem paths.
 * Document names use `collection:entryId` convention;
 * colons and slashes are replaced with safe alternatives.
 */
function sanitise(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function filePath(dataDir: string, documentName: string): string {
  return join(dataDir, `${sanitise(documentName)}.yjs`);
}

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------

/**
 * Fetch a stored Y.js document.
 * Returns the binary state, or `null` if the document does not exist.
 */
export async function fetchDocument(
  dataDir: string,
  documentName: string,
): Promise<Uint8Array | null> {
  const path = filePath(dataDir, documentName);
  try {
    const buf = await readFile(path);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch (err: unknown) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/**
 * Persist a Y.js document to disk.
 */
export async function storeDocument(
  dataDir: string,
  documentName: string,
  state: Uint8Array,
): Promise<void> {
  const resolved = resolve(dataDir);
  await mkdir(resolved, { recursive: true });
  await writeFile(filePath(dataDir, documentName), state);
}

/**
 * Delete a persisted document.
 */
export async function deleteDocument(
  dataDir: string,
  documentName: string,
): Promise<void> {
  try {
    await unlink(filePath(dataDir, documentName));
  } catch (err: unknown) {
    if (isNotFound(err)) return;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNotFound(err: unknown): boolean {
  if (err == null) return false;
  const e = err as { code?: string };
  return e.code === "ENOENT" || e.code === "ENOTDIR";
}
