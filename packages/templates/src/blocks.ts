/**
 * Built-in block specs for the page-template DSL.
 *
 * Each spec ships a render function that produces the HTML that
 * ends up on the **public** site. The HTML intentionally re-uses the
 * class names that `apps/web/public/css/site.css` already styles, so
 * templates drop into the existing site without extra CSS work.
 *
 * The block shapes below are the **public API** for the visual
 * builder. The admin's BlockEditor and the public template engine
 * both consume the same registry, so changing a prop here ripples
 * out to both.
 *
 * Conventions:
 *   - every renderer stamps `data-section-id="${ctx.sectionId}"`
 *     on its outermost element so the public-site morph renderer
 *     can diff per section.
 *   - every image gets `loading="lazy" decoding="async"` (and
 *     `loading="eager"` only on the hero).
 *   - all colours use CSS variables with defensive fallbacks so
 *     the HTML is valid even when a theme is half-loaded.
 *
 * @module blocks
 */

import type { BlockSpec, TemplateSection } from './types.ts';
import { registerBlockSpec } from './registry.ts';

// ---------------------------------------------------------------------------
// Shared render helpers
// ---------------------------------------------------------------------------

/** Escape an arbitrary value for safe HTML insertion. */
function escape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

function mediaUrl(id: unknown): string | null {
  if (typeof id !== 'string' || id.length === 0) return null;
  return `/media/${id}.svg`;
}

function articleHref(slug: string): string {
  return `/articles/${slug}/`;
}

function authorHref(slug: string): string {
  return `/authors/${slug}/`;
}

function categoryHref(slug: string): string {
  return `/categories/${slug}/`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function readTime(body: string): string {
  const words = String(body ?? '').split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return `${minutes} min read`;
}

/**
 * Compose a `data-section-id` attribute fragment (or empty string
 * when no id is available — e.g. when a renderer is exercised in
 * isolation).
 */
function sectionAttr(sectionId: string | null | undefined): string {
  return typeof sectionId === 'string' && sectionId.length > 0
    ? ` data-section-id="${escape(sectionId)}"`
    : '';
}

/** First non-empty string of a list of candidate values. */
function firstString(...candidates: ReadonlyArray<unknown>): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Built-in block specs
// ---------------------------------------------------------------------------

const heroSpec: BlockSpec = {
  type: 'hero',
  label: 'Hero',
  icon: 'sparkles',
  description: 'Large call-to-action with eyebrow, headline, description and image.',
  category: 'content',
  defaultProps: {
    eyebrow: 'Welcome',
    headline: 'Building the next-generation headless CMS',
    description: 'Engineering, product, and process notes from the team behind Q-CMS.',
    ctaLabel: 'Browse articles',
    ctaHref: '/articles/',
    imageId: 'm_hero',
    align: 'left',
    gradient: true,
    gradientAngle: '135deg',
    showDate: true,
  },
  propSchema: {
    type: 'object',
    required: ['headline'],
    properties: {
      eyebrow: { type: 'string', title: 'Eyebrow text' },
      headline: { type: 'string', title: 'Headline' },
      description: { type: 'string', title: 'Description', format: 'textarea' },
      ctaLabel: { type: 'string', title: 'CTA label' },
      ctaHref: { type: 'string', title: 'CTA link' },
      imageId: { type: 'string', title: 'Image media id' },
      align: { type: 'string', enum: ['left', 'center', 'right'], default: 'left' },
      gradient: { type: 'boolean', title: 'Show gradient overlay', default: true },
      gradientAngle: { type: 'string', title: 'Gradient angle', default: '135deg' },
      showDate: { type: 'boolean', title: 'Show date under CTA', default: true },
    },
  },
  render(props, ctx) {
    const eyebrow = asString(props['eyebrow'], 'Field Notes');
    const headline = asString(props['headline'], ctx.site.name);
    const description = asString(props['description'], ctx.site.description);
    const ctaLabel = asString(props['ctaLabel']);
    const ctaHref = asString(props['ctaHref'], '/articles/');
    const imageId = asString(props['imageId']);
    const align = asString(props['align'], 'left');
    const gradient = asBool(props['gradient']);
    const gradientAngle = asString(props['gradientAngle'], '135deg');
    const showDate = asBool(props['showDate']);
    const imageSrc = mediaUrl(imageId);
    const showCta = ctaLabel.length > 0;
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const gradientCss = gradient
      ? `--hero-gradient-angle:${escape(gradientAngle)};`
      : '';
    return `
      <section class="hero hero--${escape(align)} hero--stripe${gradient ? ' hero--gradient' : ''}"${sectionAttr(ctx.sectionId)} data-block="hero" style="${gradientCss}">
        <div class="hero__body">
          <p class="hero__eyebrow">${escape(eyebrow)}</p>
          <h1 class="hero__headline">${escape(headline)}</h1>
          <p class="hero__description">${escape(description)}</p>
          ${showCta
            ? `<div class="hero__cta-row">
                <a class="hero__cta" href="${escape(ctaHref)}" aria-label="${escape(ctaLabel)}">${escape(ctaLabel)} <span class="hero__cta-arrow" aria-hidden="true">→</span></a>
                ${showDate ? `<p class="hero__date">${escape(today)}</p>` : ''}
              </div>`
            : ''}
        </div>
        ${imageSrc
          ? `<div class="hero__image"><img src="${escape(imageSrc)}" alt="" loading="eager" decoding="async" /></div>`
          : ''}
      </section>
    `;
  },
};

const articleGridSpec: BlockSpec = {
  type: 'articleGrid',
  label: 'Article grid',
  icon: 'layout-grid',
  description: 'Responsive grid of the latest published articles with cover, title, and excerpt.',
  category: 'content',
  defaultProps: {
    title: 'Latest',
    limit: 6,
    showCover: true,
    showExcerpt: true,
    showMeta: true,
    showByline: true,
    columns: 3,
  },
  propSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', title: 'Section title' },
      limit: { type: 'number', title: 'Max items', minimum: 1, maximum: 24, default: 6 },
      showCover: { type: 'boolean', title: 'Show cover image' },
      showExcerpt: { type: 'boolean', title: 'Show excerpt' },
      showMeta: { type: 'boolean', title: 'Show meta (date, read time)' },
      showByline: { type: 'boolean', title: 'Show author byline', default: true },
      columns: { type: 'number', title: 'Columns (1–3)', minimum: 1, maximum: 3, default: 3 },
    },
  },
  render(props, ctx) {
    const title = asString(props['title'], 'Latest');
    const limit = Math.min(24, Math.max(1, asNumber(props['limit'], 6)));
    const showCover = asBool(props['showCover']);
    const showExcerpt = asBool(props['showExcerpt']);
    const showMeta = asBool(props['showMeta']);
    const showByline = asBool(props['showByline']);
    const columns = Math.min(3, Math.max(1, asNumber(props['columns'], 3)));
    const items = (ctx.data.articles ?? []).slice(0, limit);
    const authorIndex = new Map<string, string>();
    for (const a of ctx.data.authors ?? []) {
      if (a.id) authorIndex.set(a.id, a.name);
    }
    if (items.length === 0) {
      return `<section class="template-empty" data-block="articleGrid"${sectionAttr(ctx.sectionId)}><p>No articles to display.</p></section>`;
    }
    const cards = items
      .map((a) => {
        const cover = showCover ? mediaUrl(a.coverId) : null;
        const authorName = a.authorId ? authorIndex.get(a.authorId) ?? '' : '';
        return `
          <a class="article-card article-card--lift" href="${escape(articleHref(a.slug))}">
            ${cover
              ? `<div class="article-card__cover"><img src="${escape(cover)}" alt="" loading="lazy" decoding="async" /></div>`
              : `<div class="article-card__cover article-card__cover--empty">No cover</div>`}
            <p class="article-card__eyebrow">${escape(formatDate(a.publishedAt))}</p>
            <h3 class="article-card__title">${escape(a.title)}</h3>
            ${showExcerpt ? `<p class="article-card__excerpt">${escape(a.excerpt)}</p>` : ''}
            <div class="article-card__footer">
              ${showByline && authorName
                ? `<p class="article-card__byline">By <span>${escape(authorName)}</span></p>`
                : ''}
              ${showMeta ? `<p class="article-card__meta">${escape(readTime(a.body))}</p>` : ''}
            </div>
          </a>
        `;
      })
      .join('');
    return `
      <section class="template-section article-grid-section" data-block="articleGrid"${sectionAttr(ctx.sectionId)} style="--grid-cols:${columns}">
        <div class="section-header">
          <h2>${escape(title)}</h2>
          <a class="more" href="/articles/">All articles <span aria-hidden="true">→</span></a>
        </div>
        <div class="article-grid article-grid--auto">${cards}</div>
      </section>
    `;
  },
};

const articleListSpec: BlockSpec = {
  type: 'articleList',
  label: 'Article list',
  icon: 'list',
  description: 'Compact list of recent articles with title, date, and excerpt.',
  category: 'content',
  defaultProps: {
    title: 'Recent posts',
    limit: 10,
  },
  propSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
    },
  },
  render(props, ctx) {
    const title = asString(props['title'], 'Recent posts');
    const limit = Math.min(50, Math.max(1, asNumber(props['limit'], 10)));
    const items = (ctx.data.articles ?? []).slice(0, limit);
    const rows = items
      .map(
        (a) => `
        <li class="article-list__item">
          <a href="${escape(articleHref(a.slug))}">
            <h3>${escape(a.title)}</h3>
            <p>${escape(a.excerpt)}</p>
            <small>${escape(formatDate(a.publishedAt))} · ${escape(readTime(a.body))}</small>
          </a>
        </li>
      `,
      )
      .join('');
    return `
      <section class="template-section" data-block="articleList"${sectionAttr(ctx.sectionId)}>
        <div class="section-header">
          <h2>${escape(title)}</h2>
        </div>
        <ul class="article-list">${rows}</ul>
      </section>
    `;
  },
};

const authorCardSpec: BlockSpec = {
  type: 'authorCard',
  label: 'Author card',
  icon: 'user',
  description: 'Compact author card with avatar ring, name, role, and bio.',
  category: 'content',
  defaultProps: {
    authorSlug: 'sofia-volkova',
    showAvatar: true,
  },
  propSchema: {
    type: 'object',
    required: ['authorSlug'],
    properties: {
      authorSlug: { type: 'string', title: 'Author slug' },
      showAvatar: { type: 'boolean', title: 'Show avatar', default: true },
    },
  },
  render(props, ctx) {
    const slug = asString(props['authorSlug']);
    const showAvatar = asBool(props['showAvatar']);
    const author = (ctx.data.authors ?? []).find((a) => a.slug === slug);
    if (!author) {
      return `<section class="template-empty" data-block="authorCard"${sectionAttr(ctx.sectionId)}><p>Author not found.</p></section>`;
    }
    const avatar = showAvatar ? mediaUrl(author.avatarId) : null;
    return `
      <aside class="author-card author-card--ring" data-block="authorCard"${sectionAttr(ctx.sectionId)}>
        ${avatar
          ? `<span class="author-card__avatar-wrap"><img class="author-card__avatar" src="${escape(avatar)}" alt="" loading="lazy" decoding="async" /></span>`
          : ''}
        <div class="author-card__body">
          <p class="author-card__eyebrow">Author</p>
          <h3 class="author-card__name"><a href="${escape(authorHref(author.slug))}">${escape(author.name)}</a></h3>
          <p class="author-card__bio">${escape(author.bio)}</p>
        </div>
      </aside>
    `;
  },
};

const authorBioSpec: BlockSpec = {
  type: 'authorBio',
  label: 'Author bio',
  icon: 'user-circle',
  description: 'Full-width author bio with large avatar and link.',
  category: 'content',
  defaultProps: {
    authorSlug: 'sofia-volkova',
  },
  propSchema: {
    type: 'object',
    required: ['authorSlug'],
    properties: { authorSlug: { type: 'string' } },
  },
  render(props, ctx) {
    const slug = asString(props['authorSlug']);
    const author = (ctx.data.authors ?? []).find((a) => a.slug === slug);
    if (!author) {
      return `<section class="template-empty" data-block="authorBio"${sectionAttr(ctx.sectionId)}><p>Author not found.</p></section>`;
    }
    const avatar = mediaUrl(author.avatarId);
    return `
      <section class="author-bio" data-block="authorBio"${sectionAttr(ctx.sectionId)}>
        ${avatar ? `<img class="author-bio__avatar" src="${escape(avatar)}" alt="" loading="lazy" decoding="async" />` : ''}
        <div>
          <p class="author-bio__eyebrow">Author</p>
          <h2 class="author-bio__name">${escape(author.name)}</h2>
          <p class="author-bio__bio">${escape(author.bio)}</p>
          <a class="author-bio__link" href="${escape(authorHref(author.slug))}">More from this author <span aria-hidden="true">→</span></a>
        </div>
      </section>
    `;
  },
};

const categoryListSpec: BlockSpec = {
  type: 'categoryList',
  label: 'Category list',
  icon: 'tag',
  description: 'Pill grid of all categories with article count.',
  category: 'content',
  defaultProps: {
    title: 'Browse by topic',
    showCount: true,
  },
  propSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      showCount: { type: 'boolean', title: 'Show article count badge', default: true },
    },
  },
  render(props, ctx) {
    const title = asString(props['title'], 'Browse by topic');
    const showCount = asBool(props['showCount']);
    const items = ctx.data.categories ?? [];
    // Best-effort count: articles per category isn't part of the
    // shape, so we just show 0 unless an attribute is attached.
    const pills = items
      .map(
        (c) => `<a class="pill pill--count" href="${escape(categoryHref(c.slug))}">
          <span class="pill__label">${escape(c.name)}</span>
          ${showCount ? `<span class="pill__count" aria-label="article count">${escape(String((c as { count?: number }).count ?? '·'))}</span>` : ''}
        </a>`,
      )
      .join('');
    return `
      <section class="template-section" data-block="categoryList"${sectionAttr(ctx.sectionId)}>
        <div class="section-header">
          <h2>${escape(title)}</h2>
        </div>
        <div class="pill-grid">${pills}</div>
      </section>
    `;
  },
};

const richTextSpec: BlockSpec = {
  type: 'richText',
  label: 'Rich text',
  icon: 'text',
  description: 'Markdown-flavoured rich-text block. Paragraphs, headings, lists.',
  category: 'content',
  defaultProps: {
    body: '## Section heading\n\nA paragraph of free-form content. Supports **bold**, *italic*, [links](https://example.com).',
    dropCap: false,
  },
  propSchema: {
    type: 'object',
    required: ['body'],
    properties: {
      body: { type: 'string', title: 'Body (Markdown)', format: 'textarea' },
      dropCap: { type: 'boolean', title: 'Drop cap on first paragraph', default: false },
    },
  },
  render(props, ctx) {
    const body = asString(props['body'], '');
    const dropCap = asBool(props['dropCap']);
    const html = renderMarkdown(body, { dropCap });
    return `<section class="rich-text prose${dropCap ? ' prose--drop-cap' : ''}" data-block="richText"${sectionAttr(ctx.sectionId)}>${html}</section>`;
  },
};

const callToActionSpec: BlockSpec = {
  type: 'callToAction',
  label: 'Call to action',
  icon: 'megaphone',
  description: 'Centered CTA card with headline, sub-text, and a button. Two variants: inline & banner.',
  category: 'commerce',
  defaultProps: {
    headline: 'Ready to ship faster?',
    description: 'Start using Q-CMS in your next project.',
    buttonLabel: 'Get started',
    buttonHref: '/articles/',
    variant: 'primary',
    layout: 'banner',
    pattern: 'none',
  },
  propSchema: {
    type: 'object',
    properties: {
      headline: { type: 'string' },
      description: { type: 'string' },
      buttonLabel: { type: 'string' },
      buttonHref: { type: 'string' },
      variant: { type: 'string', enum: ['primary', 'secondary', 'ghost'], default: 'primary' },
      layout: { type: 'string', enum: ['banner', 'inline'], default: 'banner' },
      pattern: { type: 'string', enum: ['none', 'dots', 'grid', 'gradient'], default: 'none' },
    },
  },
  render(props, ctx) {
    const headline = asString(props['headline'], 'Ready to ship faster?');
    const description = asString(props['description']);
    const buttonLabel = asString(props['buttonLabel'], 'Learn more');
    const buttonHref = asString(props['buttonHref'], '#');
    const variant = asString(props['variant'], 'primary');
    const layout = asString(props['layout'], 'banner');
    const pattern = asString(props['pattern'], 'none');
    const patternClass = pattern === 'none' ? '' : ` cta--pattern-${escape(pattern)}`;
    const inner = `
      <div class="cta__copy">
        <h2>${escape(headline)}</h2>
        ${description ? `<p>${escape(description)}</p>` : ''}
      </div>
      <a class="btn btn-${escape(variant)}" href="${escape(buttonHref)}" aria-label="${escape(buttonLabel)}">${escape(buttonLabel)} <span aria-hidden="true">→</span></a>
    `;
    return `
      <section class="cta cta--${escape(variant)} cta--${escape(layout)}${patternClass}" data-block="callToAction"${sectionAttr(ctx.sectionId)}>
        ${inner}
      </section>
    `;
  },
};

const imageBannerSpec: BlockSpec = {
  type: 'imageBanner',
  label: 'Image banner',
  icon: 'image',
  description: 'Full-width banner image with optional caption and parallax.',
  category: 'media',
  defaultProps: {
    imageId: 'm_cover1',
    caption: '',
    credit: '',
    height: 'medium',
    parallax: false,
  },
  propSchema: {
    type: 'object',
    properties: {
      imageId: { type: 'string', title: 'Image media id' },
      caption: { type: 'string', title: 'Caption' },
      credit: { type: 'string', title: 'Credit line (e.g. "Photo: A. Lazeev")' },
      height: { type: 'string', enum: ['short', 'medium', 'tall'], default: 'medium' },
      parallax: { type: 'boolean', title: 'Parallax (desktop only)', default: false },
    },
  },
  render(props, ctx) {
    const imageId = asString(props['imageId']);
    const caption = asString(props['caption']);
    const credit = asString(props['credit']);
    const height = asString(props['height'], 'medium');
    const parallax = asBool(props['parallax']);
    const src = mediaUrl(imageId);
    if (!src) {
      return `<section class="template-empty" data-block="imageBanner"${sectionAttr(ctx.sectionId)}><p>Image not set.</p></section>`;
    }
    const parallaxClass = parallax ? ' image-banner--parallax' : '';
    return `
      <figure class="image-banner image-banner--${escape(height)}${parallaxClass}" data-block="imageBanner"${sectionAttr(ctx.sectionId)}>
        <img src="${escape(src)}" alt="${escape(caption)}" loading="lazy" decoding="async" />
        ${caption || credit
          ? `<figcaption>
              ${caption ? `<span class="image-banner__caption">${escape(caption)}</span>` : ''}
              ${credit ? `<span class="image-banner__credit">${escape(credit)}</span>` : ''}
            </figcaption>`
          : ''}
      </figure>
    `;
  },
};

const featureGridSpec: BlockSpec = {
  type: 'featureGrid',
  label: 'Feature grid',
  icon: 'grid',
  description: 'Three-column feature grid with icons, headline, and copy.',
  category: 'layout',
  defaultProps: {
    title: 'Why Q-CMS',
    columns: 3,
    items: [
      { icon: 'zap', title: 'Fast', body: 'Edge-native runtime.' },
      { icon: 'shield', title: 'Safe', body: 'Type-safe contracts.' },
      { icon: 'globe', title: 'Global', body: 'Localized out of the box.' },
    ],
  },
  propSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      columns: { type: 'number', minimum: 1, maximum: 4, default: 3 },
      items: { type: 'array', title: 'Items (JSON: [{icon,title,body}])' },
    },
  },
  render(props, ctx) {
    const title = asString(props['title'], 'Features');
    const columns = Math.min(4, Math.max(1, asNumber(props['columns'], 3)));
    const items = (Array.isArray(props['items']) ? props['items'] : []) as Array<{
      icon?: string;
      title?: string;
      body?: string;
    }>;
    const cards = items
      .map(
        (it) => `
        <div class="feature feature--icon">
          <div class="feature__icon" aria-hidden="true">${escape(firstString(it.icon, '★'))}</div>
          <h3>${escape(it.title ?? '')}</h3>
          <p>${escape(it.body ?? '')}</p>
        </div>
      `,
      )
      .join('');
    return `
      <section class="template-section feature-grid" data-block="featureGrid"${sectionAttr(ctx.sectionId)} style="--cols:${columns}">
        <div class="section-header">
          <h2>${escape(title)}</h2>
        </div>
        <div class="feature-grid__items">${cards}</div>
      </section>
    `;
  },
};

const separatorSpec: BlockSpec = {
  type: 'separator',
  label: 'Separator',
  icon: 'minus',
  description: 'A simple horizontal rule.',
  category: 'layout',
  defaultProps: { spacing: 'medium' },
  propSchema: {
    type: 'object',
    properties: {
      spacing: { type: 'string', enum: ['small', 'medium', 'large'], default: 'medium' },
    },
  },
  render(props, ctx) {
    const spacing = asString(props['spacing'], 'medium');
    return `<hr class="template-separator template-separator--${escape(spacing)}" data-block="separator"${sectionAttr(ctx.sectionId)} />`;
  },
};

const embedSpec: BlockSpec = {
  type: 'embed',
  label: 'Embed',
  icon: 'code',
  description: 'Generic iframe embed (YouTube, Vimeo, etc.).',
  category: 'media',
  defaultProps: {
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    title: 'Embedded video',
    aspect: '16/9',
  },
  propSchema: {
    type: 'object',
    required: ['url'],
    properties: {
      url: { type: 'string', format: 'uri' },
      title: { type: 'string' },
      aspect: { type: 'string', default: '16/9' },
    },
  },
  render(props, ctx) {
    const url = asString(props['url']);
    const title = asString(props['title'], 'Embedded content');
    const aspect = asString(props['aspect'], '16/9');
    if (!url) return '';
    return `
      <div class="embed" data-block="embed"${sectionAttr(ctx.sectionId)} style="aspect-ratio:${escape(aspect)}">
        <iframe src="${escape(url)}" title="${escape(title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </div>
    `;
  },
};

// ---------------------------------------------------------------------------
// Minimal markdown renderer (sub, em, strong, links, headings, paragraphs)
// ---------------------------------------------------------------------------

interface MarkdownOptions {
  dropCap?: boolean;
}

function renderMarkdown(input: string, opts: MarkdownOptions = {}): string {
  const escaped = escape(input);
  const lines = escaped.split(/\r?\n/);
  const out: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let firstParagraph = true;

  function closeList(): void {
    if (inList) {
      out.push(`</${inList}>`);
      inList = null;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      closeList();
      out.push('');
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = (heading[1] ?? '').length;
      const text = heading[2] ?? '';
      out.push(`<h${level}>${applyInline(text)}</h${level}>`);
      continue;
    }
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      if (inList !== 'ol') {
        closeList();
        inList = 'ol';
        out.push('<ol>');
      }
      out.push(`<li>${applyInline(ol[1] ?? '')}</li>`);
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    if (ul) {
      if (inList !== 'ul') {
        closeList();
        inList = 'ul';
        out.push('<ul>');
      }
      out.push(`<li>${applyInline(ul[1] ?? '')}</li>`);
      continue;
    }
    closeList();
    if (opts.dropCap && firstParagraph) {
      out.push(`<p class="prose__lead">${applyInline(line)}</p>`);
      firstParagraph = false;
    } else {
      out.push(`<p>${applyInline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

function applyInline(input: string): string {
  return input
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, href: string) =>
      `<a href="${href}">${text}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

// ---------------------------------------------------------------------------
// Public API: register all built-in block specs at module load time.
// ---------------------------------------------------------------------------

const builtins: ReadonlyArray<BlockSpec> = [
  heroSpec,
  articleGridSpec,
  articleListSpec,
  authorCardSpec,
  authorBioSpec,
  categoryListSpec,
  richTextSpec,
  callToActionSpec,
  imageBannerSpec,
  featureGridSpec,
  separatorSpec,
  embedSpec,
];

/** List of all built-in block types — useful for the admin editor to filter the palette. */
export const BUILTIN_BLOCK_TYPES: ReadonlyArray<string> = builtins.map((b) => b.type);

/** Register all built-in block specs into the registry. Idempotent. */
export function registerBuiltinBlocks(): void {
  for (const spec of builtins) {
    registerBlockSpec(spec);
  }
}

export type { BlockSpec, TemplateSection };
