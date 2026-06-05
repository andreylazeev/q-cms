/**
 * Q-CMS public template engine — shared helpers.
 *
 * Tiny utilities (escape, asString, etc.) used by every block
 * renderer and by the orchestrator. Kept tiny so the bundle stays
 * small and so the dependency between modules is obvious.
 *
 * @module templates/helpers
 */

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function asString(value, fallback) {
  return typeof value === 'string' ? value : fallback == null ? '' : fallback;
}

export function asNumber(value, fallback) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback == null ? 0 : fallback;
}

export function asBool(value) {
  return value === true || value === 'true' || value === 1;
}

export function mediaUrl(id) {
  if (typeof id !== 'string' || id.length === 0) return null;
  return '/media/' + id + '.svg';
}

export function articleHref(slug) {
  return '/articles/' + slug + '/';
}

export function authorHref(slug) {
  return '/authors/' + slug + '/';
}

export function categoryHref(slug) {
  return '/categories/' + slug + '/';
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function readTime(body) {
  const words = String(body == null ? '' : body).split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return minutes + ' min read';
}

export function firstString(...candidates) {
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return '';
}

/**
 * Stamp `data-section-id` on the rendered block, matching the
 * contract used by `packages/templates/src/blocks.ts`.
 */
export function sectionAttr(sectionId) {
  return typeof sectionId === 'string' && sectionId.length > 0
    ? ' data-section-id="' + escapeHtml(sectionId) + '"'
    : '';
}

export function firstNonEmptyString(...candidates) {
  return firstString(...candidates);
}
