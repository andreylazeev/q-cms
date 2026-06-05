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
  options?: Record<string, unknown>;
}

export interface QcmsExtensionsOptions {
  /** Placeholder text for empty paragraphs. */
  paragraphPlaceholder?: string;
  /** Placeholder text for empty headings. */
  headingPlaceholder?: string;
  /** Whether to enable slash-command autocomplete. */
  enableSlashAutocomplete?: boolean;
}

/** Placeholder — returns an empty extensions array. */
export function createQcmsExtensions(opts: QcmsExtensionsOptions = {}): readonly QcmsExtension[] {
  const paragraph = opts.paragraphPlaceholder ?? "Type '/' for blocks";
  const heading = opts.headingPlaceholder ?? 'Heading';
  return Object.freeze([
    {
      name: 'placeholder',
      options: {
        placeholder: (node: { type: { name: string } }): string => {
          if (node.type.name === 'heading') return heading;
          return paragraph;
        },
        showOnlyWhenEditable: true,
        showOnlyCurrent: false,
      },
    },
    {
      name: 'slashAutocomplete',
      options: {
        enabled: opts.enableSlashAutocomplete ?? true,
        char: '/',
        command: 'qcms-slash-menu',
      },
    },
  ]);
}

/** Placeholder; will run TipTap command dispatch once the real editor is wired.
 *
 * Accepts the editor instance (which the real TipTap-based Editor will
 * provide) and the action id. In the stub mode this is a no-op.
 */
export function runEditorAction(_editor: unknown, _action: string): void {
  /* no-op stub */
}

// ---------------------------------------------------------------------------
// Autocomplete — slash command parsing
// ---------------------------------------------------------------------------

export interface SlashParseResult {
  /** Whether the text starts with a `/` command. */
  isCommand: boolean;
  /** The query after the `/` (without the leading slash). */
  query: string;
  /** The character index where the `/` was found. */
  start: number;
  /** The character index where the query ends. */
  end: number;
}

/**
 * Parse a plain-text editor buffer for an in-progress slash command.
 *
 * The search walks the text from the end looking for the most recent
 * `/` that is not preceded by a word character (so URLs and paths
 * like `https://x` are ignored). Returns `isCommand: false` when
 * no slash command is in progress.
 *
 * @example
 * ```ts
 * parseSlashCommand('hello /head'); // { isCommand: true, query: 'head', start: 6, end: 11 }
 * parseSlashCommand('see https://x'); // { isCommand: false, query: '', start: -1, end: -1 }
 * ```
 */
export function parseSlashCommand(text: string): SlashParseResult {
  if (!text) return { isCommand: false, query: '', start: -1, end: -1 };
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '/') {
      const prev = i > 0 ? text[i - 1] : '';
      if (prev && /\S/.test(prev) && !/[\s(\[]/.test(prev)) {
        return { isCommand: false, query: '', start: -1, end: -1 };
      }
      return { isCommand: true, query: text.slice(i + 1), start: i, end: text.length };
    }
    if (ch === ' ' || ch === '\n' || ch === '\t') {
      return { isCommand: false, query: '', start: -1, end: -1 };
    }
  }
  return { isCommand: false, query: '', start: -1, end: -1 };
}
