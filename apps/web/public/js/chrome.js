/**
 * Shared site chrome: header (site name, admin link) + footer.
 * Renders on every page; pulls the site settings from the public API.
 */
(async () => {
  const { API, escapeHtml } = window.QCMS;
  const adminLink = document.querySelector('[data-admin-link]');
  if (adminLink) {
    adminLink.href = 'http://localhost:3001/';
    adminLink.target = '_blank';
    adminLink.rel = 'noopener';
  }

  let site = {};
  try {
    site = await API.site();
  } catch (err) {
    console.warn('site settings fetch failed', err);
  }

  if (site.siteName) {
    const nameEl = document.querySelector('[data-site-name]');
    if (nameEl) nameEl.textContent = site.siteName;
    document.title = `${site.siteName}`;
  }
  if (site.siteDescription) {
    const descEl = document.querySelector('[data-site-description]');
    if (descEl) descEl.textContent = site.siteDescription;
  }
  if (site.siteName) {
    const taglineEl = document.querySelector('[data-site-tagline]');
    if (taglineEl) taglineEl.textContent = site.siteName + ' — engineering, product, and process notes.';
  }

  const year = new Date().getFullYear();
  const footer = document.querySelector('[data-footer]');
  if (footer) {
    footer.innerHTML = `
      <div class="site-footer__inner">
        <div>
          <h4>${escapeHtml(site.siteName ?? 'Q-CMS Field Notes')}</h4>
          <p style="margin:0;line-height:1.5">${escapeHtml(site.siteDescription ?? '')}</p>
        </div>
        <div>
          <h4>Read</h4>
          <ul>
            <li><a href="/articles/">All articles</a></li>
            <li><a href="/categories/">Categories</a></li>
            <li><a href="/authors/">Authors</a></li>
          </ul>
        </div>
        <div>
          <h4>Build</h4>
          <ul>
            <li><a href="http://localhost:3000/api/v1/docs" target="_blank" rel="noopener">API docs</a></li>
            <li><a href="http://localhost:3000/api/v1/openapi.json" target="_blank" rel="noopener">OpenAPI</a></li>
            <li><a href="http://localhost:3000/health" target="_blank" rel="noopener">Status</a></li>
          </ul>
        </div>
        <div>
          <h4>Manage</h4>
          <ul>
            <li><a href="http://localhost:3001/" target="_blank" rel="noopener">Admin</a></li>
          </ul>
        </div>
      </div>
      <div class="site-footer__bottom">
        <span>© ${year} Q-CMS. Built with the public read API.</span>
        <span>Powered by Postgres, Hono, and Next.js</span>
      </div>
    `;
  }
})();
