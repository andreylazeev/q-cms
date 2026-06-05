/**
 * Q-CMS public template engine — block renderers.
 *
 * Each block ships a `render(props, ctx) → string` function. The
 * shapes here mirror `packages/templates/src/blocks.ts` so the
 * admin-side renderer and the public engine produce identical HTML.
 *
 * Conventions:
 *   - Every renderer stamps `data-section-id="${ctx.sectionId}"`
 *     on its outermost element so the diff renderer in `render.js`
 *     can morph per section.
 *   - All colours use CSS variables with defensive fallbacks.
 *   - All images get `loading="lazy" decoding="async"` (and
 *     `loading="eager"` only on the hero).
 *
 * @module templates/blocks
 */

import {
  escapeHtml,
  asString,
  asNumber,
  asBool,
  mediaUrl,
  articleHref,
  authorHref,
  categoryHref,
  formatDate,
  readTime,
  sectionAttr,
  firstNonEmptyString,
} from './helpers.js';

/* ---------------------------------------------------------------------------
 * Markdown renderer (used by `richText`).
 * ------------------------------------------------------------------------- */

function applyInline(input) {
  return input
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, href) =>
      `<a href="${href}">${text}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderMarkdown(input, opts) {
  const dropCap = !!(opts && opts.dropCap);
  const text = escapeHtml(input);
  const lines = text.split(/\r?\n/);
  const out = [];
  let inList = null;
  let firstParagraph = true;

  function closeList() {
    if (inList) {
      out.push(`</${inList}>`);
      inList = null;
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] || '';
    const line = raw.trim();
    if (line.length === 0) {
      closeList();
      out.push('');
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const txt = heading[2] || '';
      out.push(`<h${level}>${applyInline(txt)}</h${level}>`);
      continue;
    }
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      if (inList !== 'ol') {
        closeList();
        inList = 'ol';
        out.push('<ol>');
      }
      out.push(`<li>${applyInline(ol[1] || '')}</li>`);
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    if (ul) {
      if (inList !== 'ul') {
        closeList();
        inList = 'ul';
        out.push('<ul>');
      }
      out.push(`<li>${applyInline(ul[1] || '')}</li>`);
      continue;
    }
    closeList();
    if (dropCap && firstParagraph) {
      out.push(`<p class="prose__lead">${applyInline(line)}</p>`);
      firstParagraph = false;
    } else {
      out.push(`<p>${applyInline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

/* ---------------------------------------------------------------------------
 * Block renderers
 * ------------------------------------------------------------------------- */

function renderHero(props, ctx) {
  const eyebrow = asString(props.eyebrow, 'Field Notes');
  const headline = asString(props.headline, (ctx.site && ctx.site.name) || '');
  const description = asString(props.description, (ctx.site && ctx.site.description) || '');
  const ctaLabel = asString(props.ctaLabel);
  const ctaHref = asString(props.ctaHref, '/articles/');
  const imageId = asString(props.imageId);
  const align = asString(props.align, 'left');
  const gradient = asBool(props.gradient);
  const gradientAngle = asString(props.gradientAngle, '135deg');
  const showDate = asBool(props.showDate);
  const imageSrc = mediaUrl(imageId);
  const showCta = ctaLabel.length > 0;
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const gradientCss = gradient ? `--hero-gradient-angle:${escapeHtml(gradientAngle)};` : '';
  return (
    `<section class="hero hero--${escapeHtml(align)} hero--stripe${gradient ? ' hero--gradient' : ''}"${sectionAttr(ctx.sectionId)} data-block="hero" style="${gradientCss}">` +
    '<div class="hero__body">' +
    `<p class="hero__eyebrow">${escapeHtml(eyebrow)}</p>` +
    `<h1 class="hero__headline">${escapeHtml(headline)}</h1>` +
    `<p class="hero__description">${escapeHtml(description)}</p>` +
    (showCta
      ? `<div class="hero__cta-row">` +
        `<a class="hero__cta" href="${escapeHtml(ctaHref)}" aria-label="${escapeHtml(ctaLabel)}">` +
        `${escapeHtml(ctaLabel)} <span class="hero__cta-arrow" aria-hidden="true">→</span></a>` +
        (showDate ? `<p class="hero__date">${escapeHtml(today)}</p>` : '') +
        '</div>'
      : '') +
    '</div>' +
    (imageSrc
      ? `<div class="hero__image"><img src="${escapeHtml(imageSrc)}" alt="" loading="eager" decoding="async" /></div>`
      : '') +
    '</section>'
  );
}

function renderArticleGrid(props, ctx) {
  const title = asString(props.title, 'Latest');
  const limit = Math.min(24, Math.max(1, asNumber(props.limit, 6)));
  const showCover = asBool(props.showCover);
  const showExcerpt = asBool(props.showExcerpt);
  const showMeta = asBool(props.showMeta);
  const showByline = asBool(props.showByline);
  const columns = Math.min(3, Math.max(1, asNumber(props.columns, 3)));
  const items = (ctx.articles || []).slice(0, limit);
  const authorIndex = new Map();
  for (const a of ctx.authors || []) {
    if (a && a.id) authorIndex.set(a.id, a.name);
  }
  if (items.length === 0) {
    return `<section class="template-empty" data-block="articleGrid"${sectionAttr(ctx.sectionId)}><p>No articles to display.</p></section>`;
  }
  const cards = items
    .map((a) => {
      const data = a.data || {};
      const cover = showCover ? mediaUrl(a.coverId || data.coverId) : null;
      const authorName = a.authorId ? authorIndex.get(a.authorId) || '' : '';
      return (
        `<a class="article-card article-card--lift" href="${escapeHtml(articleHref(a.slug || data.slug || ''))}">` +
        (cover
          ? `<div class="article-card__cover"><img src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async" /></div>`
          : '<div class="article-card__cover article-card__cover--empty">No cover</div>') +
        `<p class="article-card__eyebrow">${escapeHtml(formatDate(a.publishedAt))}</p>` +
        `<h3 class="article-card__title">${escapeHtml(data.title || a.title || a.slug)}</h3>` +
        (showExcerpt
          ? `<p class="article-card__excerpt">${escapeHtml(data.excerpt || a.excerpt || '')}</p>`
          : '') +
        '<div class="article-card__footer">' +
        (showByline && authorName
          ? `<p class="article-card__byline">By <span>${escapeHtml(authorName)}</span></p>`
          : '') +
        (showMeta
          ? `<p class="article-card__meta">${escapeHtml(readTime(data.body || a.body))}</p>`
          : '') +
        '</div></a>'
      );
    })
    .join('');
  return (
    `<section class="template-section article-grid-section" data-block="articleGrid"${sectionAttr(ctx.sectionId)} style="--grid-cols:${columns}">` +
    '<div class="section-header">' +
    `<h2>${escapeHtml(title)}</h2>` +
    '<a class="more" href="/articles/">All articles <span aria-hidden="true">→</span></a>' +
    '</div>' +
    `<div class="article-grid article-grid--auto">${cards}</div></section>`
  );
}

function renderArticleList(props, ctx) {
  const title = asString(props.title, 'Recent posts');
  const limit = Math.min(50, Math.max(1, asNumber(props.limit, 10)));
  const items = (ctx.articles || []).slice(0, limit);
  const rows = items
    .map((a) => {
      const data = a.data || {};
      return (
        '<li class="article-list__item">' +
        `<a href="${escapeHtml(articleHref(a.slug || data.slug || ''))}">` +
        `<h3>${escapeHtml(data.title || a.title || a.slug)}</h3>` +
        `<p>${escapeHtml(data.excerpt || a.excerpt || '')}</p>` +
        `<small>${escapeHtml(formatDate(a.publishedAt))} · ${escapeHtml(readTime(data.body || a.body))}</small>` +
        '</a></li>'
      );
    })
    .join('');
  return (
    `<section class="template-section" data-block="articleList"${sectionAttr(ctx.sectionId)}>` +
    '<div class="section-header">' +
    `<h2>${escapeHtml(title)}</h2>` +
    '</div>' +
    `<ul class="article-list">${rows}</ul></section>`
  );
}

function renderAuthorCard(props, ctx) {
  const slug = asString(props.authorSlug);
  const showAvatar = asBool(props.showAvatar);
  const author = (ctx.authors || []).find((x) => {
    return (x.slug || (x.data && x.data.slug)) === slug;
  });
  if (!author) {
    return `<section class="template-empty" data-block="authorCard"${sectionAttr(ctx.sectionId)}><p>Author not found.</p></section>`;
  }
  const data = author.data || {};
  const avatar = showAvatar ? mediaUrl(author.avatarId || data.avatarId) : null;
  return (
    `<aside class="author-card author-card--ring" data-block="authorCard"${sectionAttr(ctx.sectionId)}>` +
    (avatar
      ? `<span class="author-card__avatar-wrap"><img class="author-card__avatar" src="${escapeHtml(avatar)}" alt="" loading="lazy" decoding="async" /></span>`
      : '') +
    '<div class="author-card__body">' +
    '<p class="author-card__eyebrow">Author</p>' +
    `<h3 class="author-card__name"><a href="${escapeHtml(authorHref(author.slug || data.slug))}">${escapeHtml(data.name || author.name)}</a></h3>` +
    `<p class="author-card__bio">${escapeHtml(data.bio || author.bio || '')}</p>` +
    '</div></aside>'
  );
}

function renderAuthorBio(props, ctx) {
  const slug = asString(props.authorSlug);
  const author = (ctx.authors || []).find((x) => {
    return (x.slug || (x.data && x.data.slug)) === slug;
  });
  if (!author) {
    return `<section class="template-empty" data-block="authorBio"${sectionAttr(ctx.sectionId)}><p>Author not found.</p></section>`;
  }
  const data = author.data || {};
  const avatar = mediaUrl(author.avatarId || data.avatarId);
  return (
    `<section class="author-bio" data-block="authorBio"${sectionAttr(ctx.sectionId)}>` +
    (avatar ? `<img class="author-bio__avatar" src="${escapeHtml(avatar)}" alt="" loading="lazy" decoding="async" />` : '') +
    '<div>' +
    '<p class="author-bio__eyebrow">Author</p>' +
    `<h2 class="author-bio__name">${escapeHtml(data.name || author.name)}</h2>` +
    `<p class="author-bio__bio">${escapeHtml(data.bio || author.bio || '')}</p>` +
    `<a class="author-bio__link" href="${escapeHtml(authorHref(author.slug || data.slug))}">More from this author <span aria-hidden="true">→</span></a>` +
    '</div></section>'
  );
}

function renderCategoryList(props, ctx) {
  const title = asString(props.title, 'Browse by topic');
  const showCount = asBool(props.showCount);
  const items = ctx.categories || [];
  const pills = items
    .map((c) => {
      const data = c.data || {};
      const count = c.count != null ? c.count : (data.count != null ? data.count : '·');
      return (
        `<a class="pill pill--count" href="${escapeHtml(categoryHref(c.slug || data.slug))}">` +
        `<span class="pill__label">${escapeHtml(data.name || c.name)}</span>` +
        (showCount
          ? `<span class="pill__count" aria-label="article count">${escapeHtml(String(count))}</span>`
          : '') +
        '</a>'
      );
    })
    .join('');
  return (
    `<section class="template-section" data-block="categoryList"${sectionAttr(ctx.sectionId)}>` +
    '<div class="section-header">' +
    `<h2>${escapeHtml(title)}</h2>` +
    '</div>' +
    `<div class="pill-grid">${pills}</div></section>`
  );
}

function renderRichText(props, ctx) {
  const body = asString(props.body, '');
  const dropCap = asBool(props.dropCap);
  const html = renderMarkdown(body, { dropCap });
  return `<section class="rich-text prose${dropCap ? ' prose--drop-cap' : ''}" data-block="richText"${sectionAttr(ctx.sectionId)}>${html}</section>`;
}

function renderCallToAction(props, ctx) {
  const headline = asString(props.headline, 'Ready to ship faster?');
  const description = asString(props.description);
  const buttonLabel = asString(props.buttonLabel, 'Learn more');
  const buttonHref = asString(props.buttonHref, '#');
  const variant = asString(props.variant, 'primary');
  const layout = asString(props.layout, 'banner');
  const pattern = asString(props.pattern, 'none');
  const patternClass = pattern === 'none' ? '' : ` cta--pattern-${escapeHtml(pattern)}`;
  const inner =
    '<div class="cta__copy">' +
    `<h2>${escapeHtml(headline)}</h2>` +
    (description ? `<p>${escapeHtml(description)}</p>` : '') +
    '</div>' +
    `<a class="btn btn-${escapeHtml(variant)}" href="${escapeHtml(buttonHref)}" aria-label="${escapeHtml(buttonLabel)}">${escapeHtml(buttonLabel)} <span aria-hidden="true">→</span></a>`;
  return `<section class="cta cta--${escapeHtml(variant)} cta--${escapeHtml(layout)}${patternClass}" data-block="callToAction"${sectionAttr(ctx.sectionId)}>${inner}</section>`;
}

function renderImageBanner(props, ctx) {
  const imageId = asString(props.imageId);
  const caption = asString(props.caption);
  const credit = asString(props.credit);
  const height = asString(props.height, 'medium');
  const parallax = asBool(props.parallax);
  const src = mediaUrl(imageId);
  if (!src) {
    return `<section class="template-empty" data-block="imageBanner"${sectionAttr(ctx.sectionId)}><p>Image not set.</p></section>`;
  }
  const parallaxClass = parallax ? ' image-banner--parallax' : '';
  const cap =
    caption || credit
      ? `<figcaption>${caption ? `<span class="image-banner__caption">${escapeHtml(caption)}</span>` : ''}${credit ? `<span class="image-banner__credit">${escapeHtml(credit)}</span>` : ''}</figcaption>`
      : '';
  return `<figure class="image-banner image-banner--${escapeHtml(height)}${parallaxClass}" data-block="imageBanner"${sectionAttr(ctx.sectionId)}><img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" loading="lazy" decoding="async" />${cap}</figure>`;
}

function renderFeatureGrid(props, ctx) {
  const title = asString(props.title, 'Features');
  const columns = Math.min(4, Math.max(1, asNumber(props.columns, 3)));
  const items = Array.isArray(props.items) ? props.items : [];
  const cards = items
    .map(
      (it) =>
        '<div class="feature feature--icon">' +
        `<div class="feature__icon" aria-hidden="true">${escapeHtml(firstNonEmptyString(it.icon, '★'))}</div>` +
        `<h3>${escapeHtml(it.title || '')}</h3>` +
        `<p>${escapeHtml(it.body || '')}</p>` +
        '</div>',
    )
    .join('');
  return (
    `<section class="template-section feature-grid" data-block="featureGrid"${sectionAttr(ctx.sectionId)} style="--cols:${columns}">` +
    '<div class="section-header">' +
    `<h2>${escapeHtml(title)}</h2>` +
    '</div>' +
    `<div class="feature-grid__items">${cards}</div></section>`
  );
}

function renderSeparator(props, ctx) {
  const spacing = asString(props.spacing, 'medium');
  return `<hr class="template-separator template-separator--${escapeHtml(spacing)}" data-block="separator"${sectionAttr(ctx.sectionId)} />`;
}

function renderEmbed(props, ctx) {
  const url = asString(props.url);
  const title = asString(props.title, 'Embedded content');
  const aspect = asString(props.aspect, '16/9');
  if (!url) return '';
  return (
    `<div class="embed" data-block="embed"${sectionAttr(ctx.sectionId)} style="aspect-ratio:${escapeHtml(aspect)}">` +
    `<iframe src="${escapeHtml(url)}" title="${escapeHtml(title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>` +
    '</div>'
  );
}

/* ---------------------------------------------------------------------------
 * Public registry
 * ------------------------------------------------------------------------- */

export const renderers = {
  hero: renderHero,
  articleGrid: renderArticleGrid,
  articleList: renderArticleList,
  authorCard: renderAuthorCard,
  authorBio: renderAuthorBio,
  categoryList: renderCategoryList,
  richText: renderRichText,
  callToAction: renderCallToAction,
  imageBanner: renderImageBanner,
  featureGrid: renderFeatureGrid,
  separator: renderSeparator,
  embed: renderEmbed,
};

export function renderSection(section, ctx) {
  const fn = renderers[section && section.type];
  if (!fn) {
    return `<!-- unknown block type: ${escapeHtml(section && section.type)} -->`;
  }
  try {
    return fn(section.props || {}, ctx);
  } catch (err) {
    return `<!-- render error in ${escapeHtml(section && section.type)}: ${escapeHtml(String(err))} -->`;
  }
}

export { renderMarkdown };
