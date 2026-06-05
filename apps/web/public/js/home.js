/**
 * Home page: hero (from site settings) + featured article + grid.
 */
(async () => {
  const { API, mediaUrl, formatDate, byPublishedDesc, escapeHtml } = window.QCMS;

  const featured = document.querySelector('[data-featured]');
  const latest = document.querySelector('[data-latest]');
  const count = document.querySelector('[data-latest-count]');

  let entries = [];
  try {
    entries = (await API.entries())
      .filter((e) => e.collectionId === 'articles')
      .sort(byPublishedDesc);
  } catch (err) {
    if (featured) featured.innerHTML = `<p class="error">Could not load articles: ${escapeHtml(err.message)}</p>`;
    if (latest) latest.innerHTML = '';
    return;
  }

  if (count) count.textContent = `${entries.length} article${entries.length === 1 ? '' : 's'}`;

  // ----- Featured: the newest article -----
  if (featured && entries[0]) {
    const e = entries[0];
    const d = e.data;
    const cover = mediaUrl(d.coverId);
    featured.innerHTML = `
      <a class="featured-article__cover" href="/articles/${e.slug}/">
        ${cover ? `<img src="${cover}" alt="${escapeHtml(d.title ?? '')}" style="width:100%;height:100%;object-fit:cover" />` : ''}
      </a>
      <div class="featured-article__body">
        <p class="featured-article__eyebrow">Featured · ${formatDate(e.publishedAt)}</p>
        <h3><a href="/articles/${e.slug}/">${escapeHtml(d.title ?? e.slug ?? '')}</a></h3>
        <p class="featured-article__excerpt">${escapeHtml(d.excerpt ?? '')}</p>
        <div class="featured-article__meta">
          <span>${escapeHtml(readTimeValue(d.body))}</span>
          <span>·</span>
          <a href="/articles/${e.slug}/">Read article →</a>
        </div>
      </div>
    `;
  }

  // ----- Latest grid: skip the featured, show 6 more -----
  if (latest) {
    const rest = entries.slice(1, 7);
    if (rest.length === 0) {
      latest.innerHTML = `<p class="loading">More articles coming soon.</p>`;
    } else {
      latest.innerHTML = rest
        .map((e) => {
          const d = e.data;
          const cover = mediaUrl(d.coverId);
          return `
            <a class="article-card" href="/articles/${e.slug}/">
              <div class="article-card__cover">
                ${cover
                  ? `<img src="${cover}" alt="" style="width:100%;height:100%;object-fit:cover" />`
                  : `<div class="article-card__cover article-card__cover--empty">No cover</div>`}
              </div>
              <p class="article-card__eyebrow">${formatDate(e.publishedAt)}</p>
              <h3>${escapeHtml(d.title ?? e.slug ?? '')}</h3>
              <p class="article-card__excerpt">${escapeHtml(d.excerpt ?? '')}</p>
              <p class="article-card__meta">${escapeHtml(readTimeValue(d.body))}</p>
            </a>
          `;
        })
        .join('');
    }
  }

  function readTimeValue(body) {
    const words = String(body ?? '').split(/\s+/).length;
    const minutes = Math.max(1, Math.round(words / 220));
    return `${minutes} min read`;
  }
})();
