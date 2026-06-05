'use client';

/**
 * Preview — inline iframe that renders the in-memory template spec
 * using the public-site template engine.
 *
 * The iframe loads a small standalone document that:
 *   - imports the public-site `/js/templates/{core,blocks,fetch,render,helpers}.js`
 *     modules at runtime via dynamic import
 *   - listens for `q-cms-preview` postMessages carrying the spec +
 *     ctx
 *   - mounts a `<div data-template-root data-template-slug="…">`
 *     and lets the engine do the rest
 *
 * The parent posts the spec on every change. The iframe never
 * reloads — that's the point of using postMessage instead of
 * `iframe.srcdoc`.
 *
 * Responsive preview controls: Desktop (1280), Tablet (768),
 * Mobile (375). Click to resize the iframe; the wrapper centers
 * it.
 */

import { type BlockSpec, type RenderContext, renderBlock } from '@q-cms/templates';
import { registerBuiltinBlocks } from '@q-cms/templates';
import { ExternalLink, Monitor, Smartphone, Tablet, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { WEB_BASE_URL } from '../../lib/web-url.ts';
import type { SdkTemplate, SdkTemplateSection } from '../../lib/stubs/api-client.ts';
import { type PreviewData, usePreviewData } from './usePreviewData.ts';

registerBuiltinBlocks();

const PREVIEW_DOCUMENT = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Template preview</title>
    <link rel="stylesheet" href="/css/site.css" />
    <style>
      html, body { margin: 0; background: var(--color-bg, #f7f7f6); color: var(--color-fg, #1a1a1a); }
      body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
      .preview-shell { padding: 16px; }
      .preview-empty { color: var(--color-fg-muted, #6b6b6b); padding: 24px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="preview-shell">
      <main data-template-root data-template-slug="__preview__"></main>
    </div>
    <script>
      (function () {
        var root = document.querySelector('[data-template-root]');
        var renderSectionFn = null;
        var blocks = null;
        function injectScript(src) {
          return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.type = 'module';
            s.src = src;
            s.onload = function () { resolve(); };
            s.onerror = function (e) { reject(e); };
            document.head.appendChild(s);
          });
        }
        // Load the public engine's modules. We can't use static
        // <script type="module"> because we need the same-origin
        // fetch. Use a single module entry that re-exports the
        // renderer functions.
        injectScript('${WEB_BASE_URL}/js/template-engine-modules.js').then(function () {
          blocks = window.QCMS_PREVIEW_BLOCKS;
          renderSectionFn = window.QCMS_PREVIEW_RENDER_SECTION;
          if (!renderSectionFn) throw new Error('preview: blocks not exposed');
        });

        window.addEventListener('message', function (event) {
          var data = event.data;
          if (!data || data.type !== 'q-cms-preview') return;
          if (!renderSectionFn) return;
          var html = '';
          if (Array.isArray(data.sections)) {
            for (var i = 0; i < data.sections.length; i += 1) {
              html += renderSectionFn(data.sections[i], data.ctx || {});
            }
          }
          if (data.theme) root.setAttribute('data-theme', data.theme);
          if (data.mode) root.setAttribute('data-mode', data.mode);
          if (html.length === 0) {
            root.innerHTML = '<p class="preview-empty">Empty template.</p>';
          } else {
            root.innerHTML = html;
          }
        });
      })();
    </script>
  </body>
</html>
`;

const dataUri = (doc: string): string => {
  if (typeof btoa === 'function') {
    return `data:text/html;base64,${btoa(doc)}`;
  }
  return `data:text/html;charset=utf-8,${encodeURIComponent(doc)}`;
};

function renderSectionsToHtml(
  sections: ReadonlyArray<SdkTemplateSection>,
  data: PreviewData,
): string {
  const ctx: RenderContext = {
    locale: 'en',
    pathname: '/',
    site: { name: 'Preview', description: 'Live preview', defaultLocale: 'en' },
    themeId: null,
    sectionId: null,
    escape: (v) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;'),
    data,
  };
  return sections.map((s) => renderBlock(s, ctx)).join('\n');
}

type Device = 'desktop' | 'tablet' | 'mobile';
type Theme = 'default' | 'dark' | 'newspaper';
type Mode = 'light' | 'dark';

const DEVICE_WIDTHS: Record<Device, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
};

export interface PreviewProps {
  template: SdkTemplate;
  onClose: () => void;
}

export function Preview({ template, onClose }: PreviewProps): React.JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<Device>('desktop');
  const [theme, setTheme] = useState<Theme>('default');
  const [mode, setMode] = useState<Mode>('light');

  const previewData = usePreviewData();
  const ctx: RenderContext = useMemo(
    () => ({
      locale: 'en',
      pathname: '/',
      site: { name: 'Preview', description: '', defaultLocale: 'en' },
      themeId: theme,
      sectionId: null,
      escape: (v) => String(v ?? ''),
      data: previewData,
    }),
    [theme, previewData],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the iframe-ready flag only when navigating between templates, not on every section change
  useEffect(() => {
    setReady(false);
  }, [template.id]);

  useEffect(() => {
    if (!ready) return;
    const frame = iframeRef.current;
    if (!frame) return;
    const payload = {
      type: 'q-cms-preview',
      sections: template.sections,
      ctx,
      theme,
      mode,
    };
    try {
      frame.contentWindow?.postMessage(payload, '*');
    } catch {
      /* iframe not ready */
    }
  }, [ready, template.sections, ctx, theme, mode]);

  // Listen for messages from the iframe (no-op today; reserved for
  // future "request resize" / "scroll-to-section" handshakes).
  useEffect(() => {
    function onMessage(ev: MessageEvent): void {
      if (!ev.data || typeof ev.data !== 'object') return;
      // Reserved.
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const html = useMemo(
    () => renderSectionsToHtml(template.sections, previewData),
    [template.sections, previewData],
  );
  // Just to keep the variable referenced for tests/devtools.
  void html;

  return (
    <div className="page-builder__preview" data-testid="page-builder-preview">
      <div className="page-builder__preview-toolbar">
        <div className="page-builder__preview-devices" role="toolbar" aria-label="Preview width">
          <button
            type="button"
            className={`btn btn-ghost page-builder__icon-btn ${device === 'desktop' ? 'page-builder__icon-btn--active' : ''}`}
            onClick={() => setDevice('desktop')}
            aria-pressed={device === 'desktop'}
            data-testid="preview-device-desktop"
            title="Desktop (1280px)"
          >
            <Monitor size={14} /> Desktop
          </button>
          <button
            type="button"
            className={`btn btn-ghost page-builder__icon-btn ${device === 'tablet' ? 'page-builder__icon-btn--active' : ''}`}
            onClick={() => setDevice('tablet')}
            aria-pressed={device === 'tablet'}
            data-testid="preview-device-tablet"
            title="Tablet (768px)"
          >
            <Tablet size={14} /> Tablet
          </button>
          <button
            type="button"
            className={`btn btn-ghost page-builder__icon-btn ${device === 'mobile' ? 'page-builder__icon-btn--active' : ''}`}
            onClick={() => setDevice('mobile')}
            aria-pressed={device === 'mobile'}
            data-testid="preview-device-mobile"
            title="Mobile (375px)"
          >
            <Smartphone size={14} /> Mobile
          </button>
        </div>
        <div className="page-builder__preview-meta">
          <span className="page-builder__preview-count">
            {template.sections.length} section{template.sections.length === 1 ? '' : 's'}
          </span>
          <select
            className="input page-builder__preview-theme"
            value={theme}
            onChange={(e) => {
              const t = e.target.value as Theme;
              setTheme(t);
              if (t === 'dark') setMode('dark');
            }}
            aria-label="Theme"
            data-testid="preview-theme"
          >
            <option value="default">Default</option>
            <option value="dark">Dark</option>
            <option value="newspaper">Newspaper</option>
          </select>
          <label className="page-builder__preview-mode">
            <input
              type="checkbox"
              checked={mode === 'dark'}
              onChange={(e) => setMode(e.target.checked ? 'dark' : 'light')}
              data-testid="preview-mode-toggle"
            />
            <span>Dark mode</span>
          </label>
        </div>
        <div className="page-builder__preview-actions">
          <a
            href={`${WEB_BASE_URL}/?template=${encodeURIComponent(template.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
            data-testid="preview-open-public"
          >
            <ExternalLink size={14} /> Open
          </a>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            aria-label="Close preview"
            data-testid="preview-close"
          >
            <X size={14} /> Back to edit
          </button>
        </div>
      </div>
      <div className="page-builder__preview-stage" data-device={device}>
        <div className="page-builder__preview-frame" style={{ width: `${DEVICE_WIDTHS[device]}px` }}>
          <iframe
            ref={iframeRef}
            title="Template preview"
            src={dataUri(PREVIEW_DOCUMENT)}
            onLoad={() => setReady(true)}
            className="page-builder__preview-iframe"
            data-testid="page-builder-preview-iframe"
          />
        </div>
      </div>
    </div>
  );
}

// Re-export BlockSpec for convenience.
export type { BlockSpec };
