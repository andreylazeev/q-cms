/**
 * Q-CMS public template engine — fetch + cache.
 *
 * Owns the network calls to the public API and the small in-memory
 * + sessionStorage cache so re-renders (theme switch, re-render
 * event) are instant.
 *
 * @module templates/fetch
 */

const TEMPLATE_CACHE_KEY = 'qcms_template_cache_v1';
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

function fetchJson(url) {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}

function readSessionCache() {
  try {
    const raw = window.sessionStorage.getItem(TEMPLATE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && parsed.__expires && parsed.__expires < Date.now()) {
      window.sessionStorage.removeItem(TEMPLATE_CACHE_KEY);
      return {};
    }
    delete parsed.__expires;
    return parsed;
  } catch {
    return {};
  }
}

function writeSessionCache(map) {
  try {
    const payload = Object.assign({}, map, { __expires: Date.now() + SESSION_TTL_MS });
    window.sessionStorage.setItem(TEMPLATE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore — private mode, quota, etc. */
  }
}

const memoryCache = new Map();
const sessionBacked = readSessionCache();
for (const [k, v] of Object.entries(sessionBacked)) {
  memoryCache.set(k, v);
}

/**
 * Fetch a template by slug. Caches the result in memory + a short
 * sessionStorage entry keyed by slug.
 */
export function loadTemplate(slug) {
  if (!slug) return Promise.resolve(null);
  if (memoryCache.has(slug)) {
    return Promise.resolve(memoryCache.get(slug));
  }
  return fetchJson('/api/v1/public/templates/' + encodeURIComponent(slug))
    .then((body) => {
      const spec = (body && body.data && body.data.attributes) || null;
      if (spec) {
        memoryCache.set(slug, spec);
        const session = readSessionCache();
        session[slug] = spec;
        writeSessionCache(session);
      }
      return spec;
    });
}

/** Drop a slug from the cache (useful for tests / manual reloads). */
export function invalidateTemplate(slug) {
  memoryCache.delete(slug);
  const session = readSessionCache();
  delete session[slug];
  writeSessionCache(session);
}

/**
 * Load the site context (settings + articles + authors + categories).
 * Cached on `window.__QCMS_SITE_CTX__` for the lifetime of the page.
 */
export function loadSiteContext() {
  if (window.__QCMS_SITE_CTX__) return Promise.resolve(window.__QCMS_SITE_CTX__);
  return fetchJson('/api/v1/public/site')
    .then((body) => {
      const site = (body && body.data && body.data.attributes) || {};
      const ctx = {
        site: {
          name: site.siteName || 'Q-CMS Field Notes',
          description: site.siteDescription || '',
          defaultLocale: site.defaultLocale || 'en',
        },
        articles: [],
        authors: [],
        categories: [],
      };
      return Promise.all([
        fetchJson('/api/v1/public/entries')
          .then((b) => {
            ctx.articles = (b.data || []).map((d) => Object.assign({}, d.attributes, { id: d.id }));
          })
          .catch(() => {}),
        fetchJson('/api/v1/public/entries/authors')
          .then((b) => {
            ctx.authors = (b.data || []).map((d) => Object.assign({}, d.attributes, { id: d.id }));
          })
          .catch(() => {}),
        fetchJson('/api/v1/public/entries/categories')
          .then((b) => {
            ctx.categories = (b.data || []).map((d) => Object.assign({}, d.attributes, { id: d.id }));
          })
          .catch(() => {}),
      ]).then(() => {
        window.__QCMS_SITE_CTX__ = ctx;
        return ctx;
      });
    })
    .catch(() => {
      const empty = {
        site: { name: 'Q-CMS Field Notes', description: '', defaultLocale: 'en' },
        articles: [],
        authors: [],
        categories: [],
      };
      window.__QCMS_SITE_CTX__ = empty;
      return empty;
    });
}
