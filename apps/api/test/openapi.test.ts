/**
 * Tests for the OpenAPI spec generator.
 */

import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { openApiSpecHandler, docsHandler } from '../src/openapi.ts';

function makeApp() {
  const app = new Hono();
  app.get('/api/v1/openapi.json', openApiSpecHandler);
  app.get('/api/v1/docs', docsHandler);
  return app;
}

describe('openapi', () => {
  it('returns valid JSON', async () => {
    const res = await makeApp().request('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it('declares OpenAPI 3.1.0', async () => {
    const res = await makeApp().request('/api/v1/openapi.json');
    const body = (await res.json()) as { openapi: string; info: { title: string; version: string } };
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toBe('Q-CMS API');
  });

  it('declares every documented path', async () => {
    const res = await makeApp().request('/api/v1/openapi.json');
    const body = (await res.json()) as { paths: Record<string, unknown> };
    const required = [
      '/health', '/ready', '/metrics',
      '/auth/login', '/auth/refresh', '/auth/logout', '/auth/magic-link', '/auth/me',
      '/users', '/users/{id}',
      '/collections', '/collections/{slug}',
      '/collections/{slug}/entries', '/collections/{slug}/entries/{id}',
      '/collections/{slug}/entries/{id}/publish',
      '/collections/{slug}/entries/{id}/unpublish',
      '/collections/{slug}/entries/{id}/duplicate',
      '/collections/{slug}/entries/{id}/revisions',
      '/singletons/{slug}',
      '/media', '/media/{id}', '/media/{id}/render',
      '/webhooks', '/webhooks/{id}', '/webhooks/{id}/deliveries',
      '/audit-log', '/search', '/roles', '/bulk',
    ];
    for (const p of required) {
      expect(body.paths[p]).toBeDefined();
    }
  });
});
