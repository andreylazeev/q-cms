import { describe, expect, it } from 'vitest';
import { buildEntryUpdateData } from '../src/lib/entry-editor';

describe('buildEntryUpdateData', () => {
  it('preserves author fields and writes edited title back to name', () => {
    const data = buildEntryUpdateData(
      {
        name: 'Sofia Volkova',
        bio: 'Field journalist',
        avatarId: 'm_avatar1',
      },
      {
        title: 'Sofia Edited',
        content: '',
        coverId: null,
        tags: [],
        seoTitle: 'SEO title',
        seoDescription: 'SEO description',
      },
    );

    expect(data).toEqual({
      name: 'Sofia Edited',
      bio: 'Field journalist',
      avatarId: 'm_avatar1',
      content: '',
      coverId: null,
      tags: [],
      seo: { title: 'SEO title', description: 'SEO description' },
    });
  });
});
