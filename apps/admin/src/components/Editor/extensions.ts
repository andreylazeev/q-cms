/**
 * TipTap extension presets for the Q-CMS admin editor.
 *
 * This file is the integration point with `@q-cms/editor`. When that
 * package ships, replace the body with the real `createQcmsExtensions`
 * factory. For now we expose a placeholder so consumers can wire
 * the editor in immediately without pulling in TipTap.
 */

export interface QcmsExtension {
  name: string;
}

/** Placeholder — returns an empty extensions array. */
export function createQcmsExtensions(): readonly QcmsExtension[] {
  return Object.freeze([]);
}

/** Placeholder; will run TipTap command dispatch once the real editor is wired.
 *
 * Accepts the editor instance (which the real TipTap-based Editor will
 * provide) and the action id. In the stub mode this is a no-op.
 */
export function runEditorAction(_editor: unknown, _action: string): void {
  /* no-op stub */
}
