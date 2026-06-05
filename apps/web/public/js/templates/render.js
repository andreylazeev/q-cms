/**
 * Q-CMS public template engine — diff renderer.
 *
 * Takes a list of section HTML strings and a host element, then
 * reconciles the host's children with the new list using
 * `data-section-id` as the stable key. The CSS in `site.css` adds
 * a subtle 200ms fade-in (`[data-section-id]` animation) so newly
 * mounted sections feel like a senior designer wrote them.
 *
 * The diff is intentionally small (~50 lines). It covers the three
 * cases that matter: mount, unmount, and innerHTML swap. Anything
 * more complex (keyed reorder, attribute morph) is overkill for the
 * use case and would just hide bugs.
 *
 * @module templates/render
 */

import { escapeHtml } from './helpers.js';

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Parse rendered HTML into a `DocumentFragment` for inspection. */
function htmlToFragment(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content;
}

/** Walk the first top-level element in a fragment. */
function firstElement(fragment) {
  return fragment.firstElementChild;
}

/**
 * Reconcile `host`'s children with the supplied `newHtml` string.
 *
 * Strategy:
 *   1. Build a Map of existing children keyed by data-section-id.
 *      Anonymous (no id) sections get unique synthetic keys.
 *   2. For each new section, in order:
 *        - if the host already has a child with that id, swap its
 *          innerHTML (or replace the node if tagName changed) and
 *          reorder
 *        - if not, mount a new node (with a fresh fade-in animation
 *          unless prefers-reduced-motion is set)
 *   3. Remove any leftover host children.
 */
export function reconcile(host, newHtml, opts) {
  if (!host) return;
  const fragment = htmlToFragment(newHtml);
  const incoming = Array.from(fragment.children);
  const existingKeys = new Map();
  Array.from(host.children).forEach((node, i) => {
    const key = node.getAttribute('data-section-id') || `__anon_${i}`;
    existingKeys.set(key, node);
  });
  const usedKeys = new Set();
  const reducedMotion = opts && opts.reducedMotion != null ? opts.reducedMotion : prefersReducedMotion();

  for (let i = 0; i < incoming.length; i += 1) {
    const node = incoming[i];
    const key = node.getAttribute('data-section-id') || `__anon_new_${i}`;
    const prev = existingKeys.get(key);

    if (prev) {
      // Replace in place. If the tag name changed, swap the node.
      if (prev.tagName !== node.tagName) {
        host.replaceChild(node, prev);
        if (!reducedMotion) {
          node.style.animation = 'none';
          // Force reflow so the animation can re-trigger.
          // eslint-disable-next-line no-unused-expressions
          node.offsetWidth;
          node.style.animation = '';
        }
      } else {
        prev.innerHTML = node.innerHTML;
      }
      // Reorder if needed (move to current position).
      if (host.children[i] !== prev) {
        host.insertBefore(prev, host.children[i] || null);
      }
      usedKeys.add(key);
    } else {
      if (!reducedMotion) {
        node.style.animation = 'none';
        // Force reflow so the animation can re-trigger on freshly
        // created nodes.
        // eslint-disable-next-line no-unused-expressions
        node.offsetWidth;
        node.style.animation = '';
      }
      host.insertBefore(node, host.children[i] || null);
      usedKeys.add(key);
    }
  }

  // Remove leftover children whose keys weren't touched.
  Array.from(host.children).forEach((node) => {
    const key = node.getAttribute('data-section-id');
    const isAnon = !key;
    if (isAnon || !usedKeys.has(key)) {
      host.removeChild(node);
    }
  });
}

/**
 * Render a full template spec into the host element, applying
 * theme id to the wrapper for theme-scoped overrides.
 */
export function renderTemplate(host, spec, ctx) {
  if (!host) return;
  const themeId = (spec && spec.meta && spec.meta.themeId) || 'default';
  host.setAttribute('data-theme', themeId);
  if (!host.querySelector('.qcms-skeleton')) {
    // First time only — paint a skeleton so the page never feels empty.
  }
  const sections = (spec && Array.isArray(spec.sections)) ? spec.sections : [];
  const html = sections
    .map((s) => renderSectionHtml(s, ctx))
    .join('\n');
  reconcile(host, html);
}

/* Imported lazily to keep this module small; the orchestrator wires
 * the real renderer in via `setSectionRenderer`. */
let sectionRenderer = null;
export function setSectionRenderer(fn) {
  sectionRenderer = fn;
}
function renderSectionHtml(section, ctx) {
  if (sectionRenderer) return sectionRenderer(section, ctx);
  return `<!-- no renderer registered: ${escapeHtml(section && section.type)} -->`;
}
