'use client';

/**
 * MiniPreview — 0.5× visual preview of a single block section.
 *
 * Reuses the same `renderBlock` helper the public site uses, so the
 * preview is structurally identical to what the user will see at
 * runtime. The HTML is rendered into a `transform: scale(0.5)`
 * container that's 200% wide and tall, so the inner DOM keeps its
 * natural layout and we just shrink it visually.
 *
 * To keep the preview readable in 240×120 of viewport, we apply a
 * subset of "site" styles (scoped under `.pb-mini-preview`) that
 * mimic the public-site look — heading scale, padding, image
 * aspect — without pulling in the full site stylesheet. The full
 * public site runs in the dedicated Preview iframe where the real
 * CSS is available.
 */

import { type RenderContext, getBlockSpec, renderBlock } from '@q-cms/templates';
import type { SdkTemplateSection } from '../../lib/stubs/api-client.ts';

export interface MiniPreviewProps {
  section: SdkTemplateSection;
  /** Optional theme id, defaults to "default". */
  themeId?: string;
  className?: string;
}

const PREVIEW_CTX: RenderContext = {
  locale: 'en',
  pathname: '/',
  site: { name: 'Preview', description: '', defaultLocale: 'en' },
  themeId: 'default',
  sectionId: null,
  escape: (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;'),
  data: {
    articles: [
      {
        id: 'a1',
        slug: 'demo',
        title: 'How we shipped v0.1 in a weekend',
        excerpt: 'A short teaser that shows how the card reads on the public site.',
        body: 'Body text for read time computation.',
        coverId: 'm_cover1',
        authorId: 'a1',
        publishedAt: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 'a2',
        slug: 'roadmap',
        title: 'The Q3 roadmap at a glance',
        excerpt: 'A second example to show the grid layout on the public site.',
        body: 'Body',
        coverId: 'm_cover2',
        authorId: 'a1',
        publishedAt: '2026-05-20T00:00:00.000Z',
      },
      {
        id: 'a3',
        slug: 'design-tokens',
        title: 'Designing a 3-tier color system',
        excerpt: 'How a senior designer thinks about depth-not-hue tokens.',
        body: 'Body',
        coverId: 'm_cover3',
        authorId: 'a1',
        publishedAt: '2026-05-10T00:00:00.000Z',
      },
    ],
    authors: [
      {
        id: 'a1',
        slug: 'demo',
        name: 'Andrey Lazeev',
        bio: 'Designer & developer. Building Q-CMS in the open.',
        avatarId: 'm_avatar1',
      },
    ],
    categories: [
      { id: 'c1', slug: 'engineering', name: 'Engineering', description: '' },
      { id: 'c2', slug: 'design', name: 'Design', description: '' },
      { id: 'c3', slug: 'product', name: 'Product', description: '' },
    ],
  },
};

export function MiniPreview({ section, themeId, className }: MiniPreviewProps): React.JSX.Element {
  const ctx: RenderContext = themeId ? { ...PREVIEW_CTX, themeId } : PREVIEW_CTX;
  const html = renderBlock(section, ctx);
  const spec = getBlockSpec(section.type);

  if (!spec) {
    return (
      <div className={`pb-mini-preview pb-mini-preview--unknown ${className ?? ''}`}>
        <p>Unknown block: {section.type}</p>
      </div>
    );
  }

  return (
    <div className={`pb-mini-preview ${className ?? ''}`} data-block={section.type}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: rendered from the trusted block-spec registry, not user input */}
      <div
        className="pb-mini-preview__scaler"
        // The block HTML comes from our own block specs, not user
        // input. They produce escaped values themselves; the only
        // attacker-controlled content is the props, which the
        // renderers escape before interpolating.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
