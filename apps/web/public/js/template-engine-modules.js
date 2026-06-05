/**
 * Q-CMS template engine — preview bridge.
 *
 * The admin's PageBuilder `<Preview />` component embeds an iframe
 * that loads a small standalone document. That document can't
 * `import` ES modules the way the public site does (it's a data:
 * URI, not a real document), so this file is a plain `<script>`-
 * loadable bridge that re-exposes the block renderers on
 * `window.QCMS_PREVIEW_*` for the preview iframe to consume.
 *
 * On the public site itself, pages use the regular
 * `<script type="module" src="/js/template-engine.js">` path —
 * this file is only for the admin's preview iframe.
 *
 * @module templates/preview-bridge
 */
import { renderSection } from './templates/blocks.js';

window.QCMS_PREVIEW_BLOCKS = true;
window.QCMS_PREVIEW_RENDER_SECTION = renderSection;
