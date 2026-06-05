(async () => {
  const { API, mediaUrl, escapeHtml } = window.QCMS;
  const listEl = document.querySelector('[data-list]');
  const countEl = document.querySelector('[data-count]');

  let authors = [];
  try {
    const all = await API.entries();
    authors = all.filter((e) => e.collectionId === 'authors');
  } catch (err) {
    if (listEl) listEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    return;
  }
  if (countEl) countEl.textContent = `${authors.length} contributor${authors.length === 1 ? '' : 's'}`;
  if (listEl) {
    listEl.innerHTML = authors
      .map((a) => {
        const avatar = mediaUrl(a.data.avatarId);
        const initials = (a.data.name ?? a.slug ?? '?')
          .split(' ')
          .map((s) => s.charAt(0).toUpperCase())
          .slice(0, 2)
          .join('');
        return `
          <div class="author-card">
            ${avatar
              ? `<img class="author-card__avatar" src="${avatar}" alt="${escapeHtml(a.data.name ?? '')}" />`
              : `<div class="author-card__avatar" style="background:#e8e4dd;display:grid;place-items:center;font-family:var(--font-sans);color:var(--color-fg-muted)">${escapeHtml(initials)}</div>`}
            <h3>${escapeHtml(a.data.name ?? a.slug ?? '')}</h3>
            <p>${escapeHtml(a.data.bio ?? '')}</p>
          </div>
        `;
      })
      .join('');
  }
})();
