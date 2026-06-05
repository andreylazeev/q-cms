/**
 * Article page — single entry. Reads the slug from the URL and fetches
 * the matching published article.
 */
(async () => {
  const { API, mediaUrl, formatDate, renderBody, escapeHtml } = window.QCMS;

  const root = document.querySelector('[data-article]');
  // The dev server doesn't URL-decode path params, so derive slug
  // from the URL ourselves.
  const match = /\/articles\/([^/]+)\/?$/.exec(location.pathname);
  const slug = match ? decodeURIComponent(match[1]) : '';

  if (!slug) {
    if (root) root.innerHTML = `<p class="error">No slug in URL.</p>`;
    return;
  }

  let entry;
  try {
    entry = await API.entry('articles', slug);
  } catch (err) {
    if (root)
      root.innerHTML = `
        <p class="error">Article not found.</p>
        <p style="text-align:center;margin-top:1rem"><a href="/articles/">← Back to all articles</a></p>
      `;
    return;
  }

  const d = entry.data;
  const cover = mediaUrl(d.coverId);
  document.title = `${d.title ?? slug} · Q-CMS Field Notes`;

  if (root) {
    root.innerHTML = `
      <a class="article__back" href="/articles/">← All articles</a>
      <p class="article__eyebrow">${formatDate(entry.publishedAt)}</p>
      <h1>${escapeHtml(d.title ?? slug)}</h1>
      <p class="article__excerpt">${escapeHtml(d.excerpt ?? '')}</p>
      <div class="article__meta">
        <span>By ${escapeHtml(d.authorId ?? 'staff')}</span>
        <span>·</span>
        <span>${escapeHtml(readTimeValue(d.body))}</span>
        <span>·</span>
        <span>en</span>
      </div>
      ${cover ? `<div class="article__cover"><img src="${cover}" alt="" style="width:100%;height:100%;object-fit:cover" /></div>` : ''}
      <div class="article__body">${renderBody(d.body)}</div>
      <div class="article__footer">
        <a href="/articles/">← All articles</a>
        <a href="#" data-admin-link>Edit in admin →</a>
      </div>
    `;
    const editLink = root.querySelector('[data-admin-link]');
    if (editLink) {
      editLink.href = `http://localhost:3001/collections/articles/${entry.id ?? ''}`;
      editLink.target = '_blank';
      editLink.rel = 'noopener';
    }
  }

  function readTimeValue(body) {
    const words = String(body ?? '').split(/\s+/).length;
    const minutes = Math.max(1, Math.round(words / 220));
    return `${minutes} min read`;
  }
})();
