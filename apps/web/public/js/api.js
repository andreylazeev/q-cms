/**
 * Q-CMS public site — shared client.
 *
 * Wraps the public read API with a couple of helpers used by every
 * page. All requests hit the same origin via the static server's
 * `/api/*` proxy.
 */

const API = {
  async site() {
    const r = await fetch('/api/v1/public/site');
    if (!r.ok) throw new Error(`site ${r.status}`);
    return (await r.json()).data.attributes;
  },
  async entries() {
    const r = await fetch('/api/v1/public/entries');
    if (!r.ok) throw new Error(`entries ${r.status}`);
    const body = await r.json();
    return body.data.map((d) => d.attributes);
  },
  async entry(collection, slug) {
    const r = await fetch(`/api/v1/public/entries/${collection}/${slug}`);
    if (!r.ok) throw new Error(`entry ${r.status}`);
    return (await r.json()).data.attributes;
  },
  async collections() {
    const r = await fetch('/api/v1/public/collections');
    if (!r.ok) throw new Error(`collections ${r.status}`);
    return (await r.json()).data;
  },
};

/** Resolve a cover/avatar media id to a public URL. The admin serves
 *  the demo SVGs from `/media/<id>.svg`; in production this would be
 *  a signed URL from the media service. */
function mediaUrl(id) {
  if (!id) return null;
  return `/media/${id}.svg`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function readTime(text) {
  if (!text) return '1 min read';
  const words = String(text).split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return `${minutes} min read`;
}

function byPublishedDesc(a, b) {
  const ad = a.publishedAt ?? a.updatedAt ?? '';
  const bd = b.publishedAt ?? b.updatedAt ?? '';
  return bd.localeCompare(ad);
}

/** Render a basic markdown-ish body (##, blank lines → paragraph).
 *  We do not pull a full markdown lib — the editor stores TipTap
 *  JSON in production, so this is just for the demo. */
function renderBody(body) {
  if (!body) return '';
  const parts = String(body).split(/\n\n+/);
  return parts
    .map((p) => {
      const trimmed = p.trim();
      if (trimmed.startsWith('## ')) {
        return `<h2>${escapeHtml(trimmed.slice(3))}</h2>`;
      }
      return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.QCMS = { API, mediaUrl, formatDate, readTime, byPublishedDesc, renderBody, escapeHtml };
