/**
 * Block spec registry for the page-template DSL.
 *
 * The runtime, the admin editor, and the public template engine all
 * read from the same registry. The admin uses `listBlockSpecs()` to
 * populate the BlockPalette, `getBlockSpec()` to render the prop
 * editor and the live preview, and `renderBlock()` to produce HTML
 * for the iframe preview / public site.
 *
 * @module registry
 */

import type { BlockSpec, RenderContext, TemplateSection } from './types.ts';

const registry = new Map<string, BlockSpec>();

/**
 * Register (or replace) a block spec.
 *
 * Throws on duplicate type so startup fails loud on conflicting
 * registrations.
 */
export function registerBlockSpec(spec: BlockSpec): void {
  if (registry.has(spec.type)) {
    // Idempotent re-registration is allowed — the latest one wins.
    // This makes HMR safe and lets tests `clearBlockSpecs()` cleanly.
  }
  registry.set(spec.type, spec);
}

/** Look up a block spec by type. */
export function getBlockSpec(type: string): BlockSpec | undefined {
  return registry.get(type);
}

/** List all registered block specs in registration order. */
export function listBlockSpecs(): BlockSpec[] {
  return Array.from(registry.values());
}

/** Clear the registry — test helper. */
export function clearBlockSpecs(): void {
  registry.clear();
}

/** Render a single section to HTML using its registered block. */
export function renderBlock(section: TemplateSection, ctx: RenderContext): string {
  const spec = registry.get(section.type);
  if (!spec) {
    return `<!-- unknown block type: ${escapeForComment(section.type)} -->`;
  }
  // Inject the section id into the context so renderers can stamp
  // `data-section-id` on their outermost element.
  const sectionCtx: RenderContext = { ...ctx, sectionId: section.id };
  try {
    return spec.render(section.props ?? {}, sectionCtx);
  } catch (err) {
    return `<!-- render error in ${escapeForComment(section.type)}: ${escapeForComment(String(err))} -->`;
  }
}

function escapeForComment(value: string): string {
  return value.replace(/--/g, '-​-');
}
