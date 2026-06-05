import { beforeEach, describe, expect, it } from 'vitest';
import { buildRouter } from '../../src/router.ts';
import { seedIfEmpty } from '../../src/lib/stubs/index.ts';

describe('buildRouter entry mounts', () => {
  beforeEach(async () => {
    await seedIfEmpty();
  });

  it('serves entries at the public /api/v1/collections/:slug/entries/:id path', async () => {
    const app = buildRouter();
    const res = await app.request('/api/v1/collections/authors/entries/e_authors');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe('e_authors');
  });
});
