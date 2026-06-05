/**
 * Q-CMS public template engine — orchestrator.
 *
 * Boots on DOMContentLoaded, finds every
 * `<main data-template-root data-template-slug="…">`, fetches the
 * template, fetches the site context, renders, and dispatches
 * `q-cms:template-rendered`. Reacts to:
 *
 *   - `q-cms:theme-changed` — re-render with the new theme tokens
 *   - `q-cms:re-render`     — re-render after a data mutation
 *   - `storage` (qcms_theme) — cross-tab theme sync
 *
 * @module templates/core
 */

import { loadTemplate, loadSiteContext } from './fetch.js';
import { renderSection } from './blocks.js';
import { setSectionRenderer, renderTemplate, reconcile } from './render.js';

setSectionRenderer(renderSection);

const SKELETON_HTML = `
  <div class="qcms-skeleton" aria-hidden="true">
    <div class="qcms-skeleton__block"></div>
    <div class="qcms-skeleton__block"></div>
    <div class="qcms-skeleton__block"></div>
  </div>
`;

/** Per-root render-state cache so we can diff. */
const rootState = new WeakMap();

function showSkeleton(host) {
  if (!host) return;
  if (host.querySelector('.qcms-skeleton')) return;
  host.insertAdjacentHTML('afterbegin', SKELETON_HTML);
}

function hideSkeleton(host) {
  if (!host) return;
  const el = host.querySelector('.qcms-skeleton');
  if (el) el.remove();
}

function showFallbackBadge(message) {
  if (document.querySelector('.qcms-fallback-badge')) return;
  const badge = document.createElement('div');
  badge.className = 'qcms-fallback-badge';
  badge.setAttribute('role', 'status');
  badge.innerHTML = `${message} <button type="button" aria-label="Dismiss">×</button>`;
  badge.querySelector('button')?.addEventListener('click', () => badge.remove());
  document.body.appendChild(badge);
}

function removeFallbackBadge() {
  const el = document.querySelector('.qcms-fallback-badge');
  if (el) el.remove();
}

async function renderRoot(root) {
  const slug = root.getAttribute('data-template-slug');
  if (!slug) return;
  if (root.getAttribute('data-template-skip') === 'true') return;
  if (root.getAttribute('data-template-rendered') !== 'true') {
    root.setAttribute('data-template-rendered', 'true');
  }

  showSkeleton(root);

  try {
    const [spec, ctx] = await Promise.all([loadTemplate(slug), loadSiteContext()]);
    hideSkeleton(root);
    if (!spec) {
      showFallbackBadge('Using fallback content');
      console.warn('template-engine: no spec for slug', slug);
      return;
    }
    removeFallbackBadge();
    // Stash for diff re-renders.
    rootState.set(root, { spec, ctx });
    renderTemplate(root, spec, ctx);
    root.dispatchEvent(new CustomEvent('q-cms:template-rendered', { bubbles: true }));
  } catch (err) {
    hideSkeleton(root);
    showFallbackBadge('Using fallback content');
    console.warn('template-engine: failed to render template', slug, err);
  }
}

function getAllRoots() {
  return Array.from(document.querySelectorAll('[data-template-root]'));
}

function reRenderAll() {
  for (const root of getAllRoots()) {
    const state = rootState.get(root);
    if (state) {
      renderTemplate(root, state.spec, state.ctx);
    } else {
      void renderRoot(root);
    }
  }
}

function onThemeChanged() {
  // Theme change doesn't need new data — the CSS variables have
  // already been updated by theme.js. We just trigger a no-op
  // reconcile so freshly mounted sections get the fade-in again
  // and the user sees visual feedback for the theme switch.
  for (const root of getAllRoots()) {
    const state = rootState.get(root);
    if (state) {
      // Reset animations on existing children by re-rendering.
      const html = (state.spec.sections || [])
        .map((s) => renderSection(s, state.ctx))
        .join('\n');
      reconcile(root, html);
    }
  }
}

function onReRender() {
  reRenderAll();
}

function boot() {
  for (const root of getAllRoots()) {
    void renderRoot(root);
  }
  // Cross-component events.
  window.addEventListener('q-cms:theme-changed', onThemeChanged);
  window.addEventListener('q-cms:re-render', onReRender);
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'qcms_theme') {
      onThemeChanged();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Programmatic API for testing / advanced integrations.
window.QCMS_TEMPLATES = window.QCMS_TEMPLATES || {};
window.QCMS_TEMPLATES.render = function (spec, ctx) {
  const host = document.createElement('div');
  const local = ctx || {
    site: { name: '', description: '', defaultLocale: 'en' },
    articles: [],
    authors: [],
    categories: [],
  };
  return (() => {
    renderTemplate(host, spec || { sections: [] }, local);
    return host.innerHTML;
  })();
};
window.QCMS_TEMPLATES.renderSection = renderSection;
window.QCMS_TEMPLATES.reRender = reRenderAll;
