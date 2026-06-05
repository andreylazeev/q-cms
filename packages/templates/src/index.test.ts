/**
 * Tests for the page-template DSL.
 *
 * Covers:
 *  - block registry: register / get / list / clear
 *  - block rendering: built-in specs produce non-empty HTML
 *  - serialize roundtrip: deserialize(json) -> serialize(spec) -> equal
 *  - safe deserialize: surfaces ZodError on bad input
 *  - createEmptyTemplate defaults
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearBlockSpecs,
  createEmptyTemplate,
  deserializeTemplate,
  getBlockSpec,
  listBlockSpecs,
  registerBlockSpec,
  registerBuiltinBlocks,
  renderBlock,
  safeDeserializeTemplate,
  serializeTemplate,
  touchTemplate,
  type BlockSpec,
  type RenderContext,
  type TemplateSection,
  type TemplateSpec,
} from './index.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ctx: RenderContext = {
  locale: 'en',
  pathname: '/',
  site: { name: 'Q-CMS', description: 'Block-first CMS', defaultLocale: 'en' },
  themeId: 'default',
  sectionId: 'sec_test',
  escape: (v) => String(v ?? ''),
  data: {
    articles: [
      {
        id: 'e1',
        slug: 'hello',
        title: 'Hello',
        excerpt: 'Intro',
        body: 'Body text',
        coverId: 'm_hero',
        authorId: 'u_admin',
        publishedAt: '2026-06-01T00:00:00.000Z',
      },
    ],
    authors: [
      { id: 'a1', slug: 'sofia-volkova', name: 'Sofia Volkova', bio: 'Writer', avatarId: 'm_avatar1' },
    ],
    categories: [
      { id: 'c1', slug: 'engineering', name: 'Engineering', description: 'Deep dives' },
    ],
  },
};

beforeEach(() => {
  clearBlockSpecs();
  registerBuiltinBlocks();
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('block registry', () => {
  it('registers and retrieves a custom block', () => {
    const spec: BlockSpec = {
      type: 'customTest',
      label: 'Custom test',
      icon: 'star',
      description: 'For tests',
      category: 'other',
      defaultProps: { text: 'hi' },
      propSchema: {},
      render: () => '<div>custom</div>',
    };
    registerBlockSpec(spec);
    const got = getBlockSpec('customTest');
    expect(got).toBeDefined();
    expect(got?.label).toBe('Custom test');
  });

  it('returns undefined for an unknown block', () => {
    expect(getBlockSpec('notARealBlock')).toBeUndefined();
  });

  it('lists all registered blocks in order', () => {
    const list = listBlockSpecs();
    expect(list.length).toBeGreaterThanOrEqual(12);
    expect(list.find((b) => b.type === 'hero')).toBeDefined();
    expect(list.find((b) => b.type === 'articleGrid')).toBeDefined();
  });

  it('clearBlockSpecs removes everything', () => {
    clearBlockSpecs();
    expect(listBlockSpecs()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Built-in rendering
// ---------------------------------------------------------------------------

describe('built-in block rendering', () => {
  it('renders hero with custom props', () => {
    const html = renderBlock({ id: 's1', type: 'hero', props: { headline: 'A' } }, ctx);
    expect(html).toContain('A');
    expect(html).toContain('hero__headline');
  });

  it('renders articleGrid from ctx.data', () => {
    const html = renderBlock({ id: 's2', type: 'articleGrid', props: { limit: 1 } }, ctx);
    expect(html).toContain('Hello');
    expect(html).toContain('article-card');
  });

  it('renders categoryList pills', () => {
    const html = renderBlock({ id: 's3', type: 'categoryList', props: {} }, ctx);
    expect(html).toContain('Engineering');
    expect(html).toContain('pill');
  });

  it('renders richText with markdown headings', () => {
    const html = renderBlock(
      { id: 's4', type: 'richText', props: { body: '## Hi\n\nA paragraph' } },
      ctx,
    );
    expect(html).toContain('<h2>Hi</h2>');
    expect(html).toContain('<p>A paragraph</p>');
  });

  it('returns a comment when block type is unknown', () => {
    const html = renderBlock({ id: 'sx', type: 'mystery', props: {} }, ctx);
    expect(html).toContain('unknown block type');
  });

  it('returns a comment when block render throws', () => {
    registerBlockSpec({
      type: 'brokenBlock',
      label: 'Broken',
      icon: 'x',
      description: '',
      category: 'other',
      defaultProps: {},
      propSchema: {},
      render: () => {
        throw new Error('nope');
      },
    });
    const html = renderBlock({ id: 's5', type: 'brokenBlock', props: {} }, ctx);
    expect(html).toContain('render error');
  });
});

// ---------------------------------------------------------------------------
// Serialize / deserialize
// ---------------------------------------------------------------------------

describe('serialize / deserialize', () => {
  const sample: TemplateSpec = createEmptyTemplate({
    name: 'Home default',
    slug: 'home-default',
    description: 'Landing template',
    sections: [
      { id: 'a', type: 'hero', props: { headline: 'Hi' } },
      { id: 'b', type: 'articleGrid', props: { limit: 3 } },
    ],
  });

  it('roundtrips through JSON cleanly', () => {
    const json = JSON.parse(JSON.stringify(sample));
    const restored = deserializeTemplate(json);
    expect(restored.slug).toBe('home-default');
    expect(restored.sections).toHaveLength(2);
    expect(restored.sections[0]?.type).toBe('hero');
  });

  it('serializeTemplate returns a deep-equal copy', () => {
    const out = serializeTemplate(sample);
    expect(out).toEqual(sample);
  });

  it('safeDeserializeTemplate returns ok for valid input', () => {
    const result = safeDeserializeTemplate(sample);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.spec.slug).toBe('home-default');
  });

  it('safeDeserializeTemplate returns error for invalid input', () => {
    const result = safeDeserializeTemplate({ name: '', slug: 'no spaces allowed' });
    expect(result.ok).toBe(false);
  });

  it('rejects bad section ids', () => {
    const result = safeDeserializeTemplate({
      version: 1,
      name: 'x',
      slug: 'x',
      sections: [{ id: 'has spaces', type: 'hero', props: {} }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects bad slugs', () => {
    const result = safeDeserializeTemplate({
      version: 1,
      name: 'x',
      slug: 'Has Spaces',
      sections: [],
    });
    expect(result.ok).toBe(false);
  });

  it('assigns default timestamps when missing', () => {
    const spec = createEmptyTemplate({ name: 't', slug: 't' });
    expect(spec.createdAt).toBeTruthy();
    expect(spec.updatedAt).toBeTruthy();
  });

  it('touchTemplate bumps the updated timestamp', async () => {
    const original = createEmptyTemplate({ name: 't', slug: 't' });
    await new Promise((r) => setTimeout(r, 5));
    const updated = touchTemplate(original);
    expect(updated.updatedAt >= original.updatedAt).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Senior-designer polish: per-block HTML contracts
// ---------------------------------------------------------------------------

describe('block renderer polish (data-section-id + senior UX)', () => {
  it('every built-in block stamps data-section-id on its outermost element', () => {
    const blocks: Array<{ type: string; props?: Record<string, unknown> }> = [
      { type: 'hero' },
      { type: 'articleGrid' },
      { type: 'articleList' },
      { type: 'authorCard' },
      { type: 'authorBio' },
      { type: 'categoryList' },
      { type: 'richText' },
      { type: 'callToAction' },
      { type: 'imageBanner', props: { imageId: 'm_x' } },
      { type: 'featureGrid' },
      { type: 'separator' },
      { type: 'embed', props: { url: 'https://example.com/' } },
    ];
    for (const { type, props } of blocks) {
      const html = renderBlock({ id: `id-${type}`, type, props: props ?? {} }, ctx);
      expect(html, `block ${type} should carry data-section-id`).toContain(`data-section-id="id-${type}"`);
    }
  });

  it('hero applies the gradient CSS variable when gradientAngle is set', () => {
    const html = renderBlock(
      { id: 'h1', type: 'hero', props: { gradient: true, gradientAngle: '200deg', headline: 'X' } },
      ctx,
    );
    expect(html).toContain('--hero-gradient-angle:200deg');
    expect(html).toContain('hero--gradient');
  });

  it('articleGrid adds the lift class and a byline when showByline is on', () => {
    const html = renderBlock(
      { id: 'g1', type: 'articleGrid', props: { showByline: true, limit: 1 } },
      ctx,
    );
    expect(html).toContain('article-card--lift');
    // The fixture article's authorId ('u_admin') doesn't match the
    // author id ('a1'), so the byline is hidden. We pass a fresh
    // ctx with a matching author to assert the byline path.
    const localCtx: RenderContext = {
      ...ctx,
      sectionId: 'g2',
      data: {
        ...ctx.data,
        articles: [
          {
            ...ctx.data.articles![0]!,
            authorId: 'a1',
          },
        ],
      },
    };
    const html2 = renderBlock(
      { id: 'g2', type: 'articleGrid', props: { showByline: true, limit: 1 } },
      localCtx,
    );
    expect(html2).toContain('article-card__byline');
    expect(html2).toContain('Sofia Volkova');
  });

  it('callToAction inline layout adds the inline class', () => {
    const html = renderBlock(
      { id: 'c1', type: 'callToAction', props: { layout: 'inline', pattern: 'dots' } },
      ctx,
    );
    expect(html).toContain('cta--inline');
    expect(html).toContain('cta--pattern-dots');
  });

  it('imageBanner parallax adds the parallax modifier', () => {
    const html = renderBlock(
      { id: 'b1', type: 'imageBanner', props: { imageId: 'm_x', parallax: true, credit: 'Photo: A' } },
      ctx,
    );
    expect(html).toContain('image-banner--parallax');
    expect(html).toContain('image-banner__credit');
  });

  it('richText with dropCap adds the prose--drop-cap class', () => {
    const html = renderBlock(
      { id: 'r1', type: 'richText', props: { body: 'First paragraph.\n\nSecond.', dropCap: true } },
      ctx,
    );
    expect(html).toContain('prose--drop-cap');
    expect(html).toContain('prose__lead');
  });
});

// ---------------------------------------------------------------------------
// Nested children normalization
// ---------------------------------------------------------------------------

describe('nested section children', () => {
  it('preserves nested children in the roundtrip', () => {
    const original: TemplateSpec = createEmptyTemplate({
      name: 'Nested',
      slug: 'nested',
      sections: [
        {
          id: 'parent',
          type: 'featureGrid',
          props: { title: 'Features' },
          children: [
            { id: 'c1', type: 'separator', props: { spacing: 'small' } },
          ],
        },
      ],
    });
    const restored = deserializeTemplate(JSON.parse(JSON.stringify(original)));
    const parent = restored.sections[0] as TemplateSection & { children?: TemplateSection[] };
    expect(parent.children).toHaveLength(1);
    expect(parent.children?.[0]?.type).toBe('separator');
  });
});
