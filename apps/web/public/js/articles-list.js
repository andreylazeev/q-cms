/**
 * Articles index — list of all published articles, with a sidebar of
 * recent posts + categories.
 */
(async () => {
  const { API, mediaUrl, formatDate, byPublishedDesc, escapeHtml } = window.QCMS;

  const listEl = document.querySelector('[data-list]');
  const countEl = document.querySelector('[data-count]');
  const sidebarEl = document.querySelector('[data-sidebar]');

  let articles = [];
  let categories = [];
  try {
    const all = await API.entries();
    articles = all.filter((e) => e.collectionId === 'articles').sort(byPublishedDesc);
    categories = all.filter((e) => e.collectionId === 'categories');
  } catch (err) {
    if (listEl) listEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    return;
  }

  if (countEl) countEl.textContent = `${articles.length} article${articles.length === 1 ? '' : 's'}`;

  if (listEl) {
    listEl.innerHTML = articles
      .map((e) => {
        const d = e.data;
        const cover = mediaUrl(d.coverId);
        return `
          <a class="index-row" href="/articles/${e.slug}/">
            <div class="index-row__cover">
              ${cover
                ? `<img src="${cover}" alt="" style="width:100%;height:100%;object-fit:cover" />`
                : `<div class="index-row__cover index-row__cover--empty" style="background:#e8e4dd;width:100%;height:100%"></div>`}
            </div>
            <div>
              <h3>${escapeHtml(d.title ?? e.slug ?? '')}</h3>
              <p class="index-row__excerpt">${escapeHtml(d.excerpt ?? '')}</p>
            </div>
            <div class="index-row__author">${escapeHtml(d.authorId ?? 'staff')}</div>
            <div class="index-row__date">${formatDate(e.publishedAt)}</div>
          </a>
        `;
      })
      .join('');
  }

  if (sidebarEl) {
    const recent = articles.slice(0, 4);
    sidebarEl.innerHTML = `
      <div style="margin-bottom:1.5rem">
        <h4>Recent</h4>
        <ul>
          ${recent
            .map(
              (e) =>
                `<li><a href="/articles/${e.slug}/">${escapeHtml(e.data.title ?? e.slug)}</a></li>`,
            )
            .join('')}
        </ul>
      </div>
      <div>
        <h4>Categories</h4>
        <ul>
          ${categories
            .map(
              (c) =>
                `<li><a href="/categories/">${escapeHtml(c.data.name ?? c.slug)}</a></li>`,
            )
            .join('')}
        </ul>
      </div>
      <div>
        <h4>RSS</h4>
        <p style="color:var(--color-fg-muted);font-size:0.8rem">
          Subscribe to <a href="#">/feed.xml</a> for updates.
        </p>
      </div>
    `;
  }
})();
