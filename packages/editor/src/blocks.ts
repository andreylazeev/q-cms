import type { JSONContent } from './types.ts';

/**
 * Configuration for a registered editor block.
 *
 * Blocks are registered by name and provide metadata for the
 * editor UI (label, icon), optional custom rendering logic,
 * and a schema definition for validation.
 */
export interface BlockConfig {
  /** Unique block identifier (e.g. 'imageBlock', 'embedBlock'). */
  name: string;
  /** Human-readable label for the UI. */
  label: string;
  /** Icon identifier (e.g. lucide icon name). */
  icon: string;
  /**
   * Optional custom HTML renderer.
   * Receives the node attributes and returns an HTML string.
   * When omitted, the default renderer handles the block.
   */
  render?: (attrs: Record<string, unknown>) => string;
  /**
   * Optional JSON Schema for the block's attributes.
   * Used for validation and form generation in the admin UI.
   */
  schema?: Record<string, unknown>;
}

const blockRegistry = new Map<string, BlockConfig>();

/**
 * Register a custom block definition.
 *
 * Blocks must have unique names. Re-registering a name
 * overwrites the previous registration.
 *
 * @example
 * ```ts
 * registerBlock({
 *   name: 'calloutBlock',
 *   label: 'Callout',
 *   icon: 'alert-triangle',
 *   render: (attrs) => `<div class="callout">${attrs.text}</div>`,
 * });
 * ```
 */
export function registerBlock(config: BlockConfig): void {
  blockRegistry.set(config.name, config);
}

/**
 * Retrieve a registered block by name.
 *
 * @returns The block config, or `undefined` if not found.
 */
export function getBlock(name: string): BlockConfig | undefined {
  return blockRegistry.get(name);
}

/**
 * List all registered blocks.
 *
 * @returns An array of block configs in registration order.
 */
export function listBlocks(): BlockConfig[] {
  return Array.from(blockRegistry.values());
}

/**
 * Clear all registered blocks.
 * Primarily used for testing.
 */
export function clearBlocks(): void {
  blockRegistry.clear();
}
