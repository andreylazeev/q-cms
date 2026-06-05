/**
 * Tests for the health route.
 */

import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { healthRouter } from '../../src/routes/health.ts';

function makeApp() {
  const app = new Hono();
  app.route('/', healthRouter);
  return app;
}

describe('GET /health', () => {
  it('returns 200 with status and uptime', async () => {
    const res = await makeApp().request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; uptime: number; service: string };
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });
});

describe('GET /ready', () => {
  it('returns 200 with checks when all services are healthy', async () => {
    const res = await makeApp().request('/ready');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; checks: Record<string, string> };
    expect(body.status).toBe('ok');
    expect(body.checks['postgres']).toMatch(/ok/);
    expect(body.checks['redis']).toMatch(/ok/);
    expect(body.checks['meilisearch']).toMatch(/ok/);
  });
});

describe('GET /metrics', () => {
  it('returns prometheus exposition', async () => {
    const res = await makeApp().request('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const text = await res.text();
    expect(text).toContain('# HELP');
  });
});
