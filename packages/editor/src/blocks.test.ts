import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerBlock,
  getBlock,
  listBlocks,
  clearBlocks,
  useBlockLibrary,
  registerBuiltinBlocks,
  validateDocument,
  BUILTIN_BLOCKS,
  BLOCK_CATEGORY_ORDER,
} from './blocks.ts';
import type { BlockConfig } from './blocks.ts';
import type { JSONContent } from './types.ts';

describe('block library extensions', () => {
  beforeEach(() => {
    clearBlocks();
  });

  it('stores a category on a registered block', () => {
    registerBlock({
      name: 'calloutBlock',
      label: 'Callout',
      icon: 'alert-triangle',
      category: 'Text',
    });
    const block = getBlock('calloutBlock');
    expect(block?.category).toBe('Text');
  });

  it('defaults to the Advanced category when none is provided', () => {
    registerBlock({ name: 'plain', label: 'Plain', icon: 'circle' });
    // The raw config has no category — the descriptor fills it in.
    expect(getBlock('plain')?.category).toBeUndefined();
    const lib = useBlockLibrary();
    expect(lib.byName('plain')?.category).toBe('Advanced');
  });

  it('stores a React component reference on a block', () => {
    const Stub: BlockConfig['reactComponent'] = () => null;
    registerBlock({
      name: 'withReact',
      label: 'With React',
      icon: 'box',
      reactComponent: Stub,
    });
    expect(getBlock('withReact')?.reactComponent).toBe(Stub);
  });

  it('exposes a validate function on a block', () => {
    const validate = (attrs: Record<string, unknown>): string | null =>
      typeof attrs['text'] === 'string' && attrs['text'].length > 0 ? null : 'Text required';
    registerBlock({
      name: 'validated',
      label: 'Validated',
      icon: 'check',
      validate,
    });
    expect(getBlock('validated')?.validate?.({ text: 'hi' })).toBeNull();
    expect(getBlock('validated')?.validate?.({})).toBe('Text required');
  });

  it('useBlockLibrary groups by category in canonical order', () => {
    registerBlock({ name: 'p', label: 'P', icon: 'i', category: 'Text' });
    registerBlock({ name: 'img', label: 'Img', icon: 'i', category: 'Media' });
    registerBlock({ name: 'yt', label: 'YT', icon: 'i', category: 'Embeds' });
    registerBlock({ name: 'misc', label: 'Misc', icon: 'i' });

    const lib = useBlockLibrary();
    const order = lib.groups.map((g) => g.category);
    expect(order).toEqual(['Text', 'Media', 'Embeds', 'Advanced']);
    expect(lib.groups.find((g) => g.category === 'Advanced')?.blocks).toEqual([
      expect.objectContaining({ name: 'misc' }),
    ]);
  });

  it('useBlockLibrary returns empty groups list when nothing registered', () => {
    const lib = useBlockLibrary();
    expect(lib.groups).toEqual([]);
    expect(lib.blocks).toEqual([]);
    expect(lib.byName('anything')).toBeUndefined();
  });

  it('useBlockLibrary byName lookup works', () => {
    registerBlock({ name: 'foo', label: 'Foo', icon: 'i', category: 'Text' });
    const lib = useBlockLibrary();
    expect(lib.byName('foo')?.label).toBe('Foo');
    expect(lib.byName('missing')).toBeUndefined();
  });

  it('flags whether a descriptor carries a React component', () => {
    registerBlock({ name: 'a', label: 'A', icon: 'i', category: 'Text' });
    registerBlock({
      name: 'b',
      label: 'B',
      icon: 'i',
      category: 'Text',
      reactComponent: () => null,
    });
    const lib = useBlockLibrary();
    expect(lib.byName('a')?.hasReactComponent).toBe(false);
    expect(lib.byName('b')?.hasReactComponent).toBe(true);
  });

  it('BLOCK_CATEGORY_ORDER is the canonical display order', () => {
    expect(BLOCK_CATEGORY_ORDER).toEqual(['Text', 'Media', 'Lists', 'Embeds', 'Advanced']);
  });

  it('registerBuiltinBlocks is idempotent and does not overwrite user blocks', () => {
    registerBlock({ name: 'paragraph', label: 'Custom P', icon: 'i', category: 'Text' });
    registerBuiltinBlocks();
    // The custom registration survives.
    expect(getBlock('paragraph')?.label).toBe('Custom P');
    // But the rest of the builtins are present.
    expect(getBlock('heading')?.label).toBe('Heading');
    expect(getBlock('image')?.label).toBe('Image');
    expect(getBlock('code')?.label).toBe('Code');
  });

  it('BUILTIN_BLOCKS contains all the expected entry points', () => {
    const names = BUILTIN_BLOCKS.map((b) => b.name);
    for (const expected of ['paragraph', 'heading', 'image', 'code', 'embed', 'callout', 'divider', 'todo']) {
      expect(names).toContain(expected);
    }
  });
});

// ---- Block meta (senior-designer visual metadata) ----

describe('block visual metadata', () => {
  beforeEach(() => {
    clearBlocks();
    registerBuiltinBlocks();
  });

  it('exposes an inline SVG thumbnail on every primary block', () => {
    const lib = useBlockLibrary();
    const primary = lib.blocks.filter((b) =>
      ['paragraph', 'heading', 'callout', 'image', 'divider', 'todo', 'code', 'embed'].includes(b.name),
    );
    for (const b of primary) {
      expect(b.thumbnail, `${b.name} should have a thumbnail`).toBeDefined();
      expect(b.thumbnail).toMatch(/<rect|<path|<circle/);
    }
  });

  it('surfaces keyboard shortcut hints', () => {
    const lib = useBlockLibrary();
    const heading = lib.byName('heading');
    expect(heading?.shortcut).toBe('H');
    const image = lib.byName('image');
    expect(image?.shortcut).toBeDefined();
  });

  it('carries tags separately from keywords', () => {
    const lib = useBlockLibrary();
    const callout = lib.byName('callout');
    expect(callout?.tags).toContain('note');
    expect(callout?.tags).toContain('warning');
  });

  it('includes an insertExample document', () => {
    const lib = useBlockLibrary();
    const heading = lib.byName('heading');
    expect(heading?.insertExample).toBeDefined();
    expect(heading?.insertExample?.type).toBe('heading');
  });
});

describe('validateDocument', () => {
  beforeEach(() => {
    clearBlocks();
  });

  it('returns an empty list when nothing is registered with a validator', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
    };
    expect(validateDocument(doc)).toEqual([]);
  });

  it('returns an empty list for null/undefined input', () => {
    expect(validateDocument(null)).toEqual([]);
    expect(validateDocument(undefined)).toEqual([]);
  });

  it('flags a block whose validate function returns an error', () => {
    registerBlock({
      name: 'callout',
      label: 'Callout',
      icon: 'i',
      category: 'Text',
      validate: (attrs) => (attrs['text'] ? null : 'Callout requires text'),
    });
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'callout', attrs: {} }],
    };
    const issues = validateDocument(doc);
    expect(issues).toEqual([{ blockName: 'callout', message: 'Callout requires text' }]);
  });

  it('includes the nodeId when the offending block has an id attribute', () => {
    registerBlock({
      name: 'callout',
      label: 'Callout',
      icon: 'i',
      category: 'Text',
      validate: (attrs) => (attrs['text'] ? null : 'Callout requires text'),
    });
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'callout', attrs: { id: 'my-block' } }],
    };
    const issues = validateDocument(doc);
    expect(issues).toEqual([{ blockName: 'callout', message: 'Callout requires text', nodeId: 'my-block' }]);
  });

  it('skips nodes whose type is not in the registry', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'unknown', attrs: {} }],
    };
    expect(validateDocument(doc)).toEqual([]);
  });
});
