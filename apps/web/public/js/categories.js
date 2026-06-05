(async () => {
  const { API, escapeHtml } = window.QCMS;
  const listEl = document.querySelector('[data-list]');
  const countEl = document.querySelector('[data-count]');

  let categories = [];
  let articles = [];
  try {
    const all = await API.entries();
    categories = all.filter((e) => e.collectionId === 'categories');
    articles = all.filter((e) => e.collectionId === 'articles');
  } catch (err) {
    if (listEl) listEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    return;
  }

  if (countEl) countEl.textContent = `${categories.length} topic${categories.length === 1 ? '' : 's'}`;
  if (listEl) {
    listEl.innerHTML = categories
      .map((c) => {
        // In production this would join through a categoryId field; the
        // demo articles don't have one yet, so show a placeholder count.
        const count = Math.max(1, Math.round(articles.length / Math.max(1, categories.length)));
        return `
          <a class="tag" href="/articles/">
            ${escapeHtml(c.data.name ?? c.slug)}
            <span class="tag__count">${count} article${count === 1 ? '' : 's'}</span>
          </a>
        `;
      })
      .join('');
  }
})();
