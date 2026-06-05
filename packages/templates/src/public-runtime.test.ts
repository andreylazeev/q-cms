import { describe, expect, it } from 'vitest';

import { renderSection } from '../../../apps/web/public/js/templates/blocks.js';

describe('public template runtime', () => {
  it('stamps the template section id on rendered public blocks', () => {
    const html = renderSection(
      { id: 'sec_hero', type: 'hero', props: { headline: 'Visible hero' } },
      {
        site: { name: 'Q-CMS', description: 'Block-first CMS', defaultLocale: 'en' },
        articles: [],
        authors: [],
        categories: [],
      },
    );

    expect(html).toContain('Visible hero');
    expect(html).toContain('data-section-id="sec_hero"');
  });
});
