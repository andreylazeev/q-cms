/**
 * Q-CMS public template engine — entry point.
 *
 * The senior-designer pass split the engine into focused ES modules
 * under `/js/templates/{core,blocks,fetch,render,helpers}.js`. This
 * file is the thin entry that the HTML pages load with
 * `<script type="module" src="/js/template-engine.js">`. The
 * orchestrator lives in `core.js`; this file is the canonical
 * public path.
 *
 * Event contract (read by other subagents):
 *   - dispatches: `q-cms:template-rendered` (CustomEvent on root)
 *   - listens:   `q-cms:theme-changed` (re-renders with new theme)
 *   - listens:   `q-cms:re-render`     (re-render after data change)
 *   - listens:   `storage` (qcms_theme) (cross-tab theme sync)
 */
import './templates/core.js';
