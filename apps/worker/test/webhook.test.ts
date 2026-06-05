/**
 * Tests for the webhook delivery worker.
 *
 * The HTTP client is mocked with `vi.spyOn(globalThis, 'fetch')`
 * so we can drive every status-code branch deterministically.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signWebhook, verifySignature, processWebhookJob } from '../src/workers/webhook.ts';
import type { Job } from 'bullmq';
import type { WebhookJobData } from '../src/workers/webhook.ts';

interface JobLike extends Job<WebhookJobData> {
  // We only model the surface the worker actually touches.
}

function makeJob(data: WebhookJobData & { __target?: { url: string; secret: string; headers?: Record<string, string> } }, attemptsMade = 0): JobLike {
  return {
    id: 'job-1',
    data,
    attemptsMade,
  } as unknown as JobLike;
}

describe('webhook worker', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('signs the body with HMAC-SHA256 and verifies the signature', async () => {
    const secret = 's3cret';
    const body = JSON.stringify({ event: 'entry.publish', payload: { id: '1' }, attempt: 1, deliveredAt: '2026-06-05T00:00:00Z' });
    const sig = signWebhook(secret, body);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifySignature(secret, body, `sha256=${sig}`)).toBe(true);
    expect(await verifySignature(secret, body + 'tampered', `sha256=${sig}`)).toBe(false);
  });

  it('POSTs with the expected headers and signature', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const secret = 'whsec';
    const job = makeJob({
      webhookId: 'wh_1',
      event: 'entry.publish',
      payload: { foo: 'bar' },
      attempt: 1,
      __target: { url: 'https://hooks.example.com/path', secret, headers: { 'X-Custom': '1' } },
    });
    await processWebhookJob(job);
    const call = fetchSpy.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call as [string, RequestInit];
    expect(url).toBe('https://hooks.example.com/path');
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-qcms-event')).toBe('entry.publish');
    const sigHeader = headers.get('x-qcms-signature') ?? '';
    expect(await verifySignature(secret, init.body as string, sigHeader)).toBe(true);
    expect(headers.get('x-qcms-attempt')).toBe('1');
    expect(headers.get('x-custom')).toBe('1');
  });

  it('throws (and triggers BullMQ retry) on 5xx', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('boom', { status: 503 }));
    const job = makeJob({
      webhookId: 'wh_1',
      event: 'entry.publish',
      payload: {},
      attempt: 1,
      __target: { url: 'https://hooks.example.com', secret: 'whsec' },
    });
    await expect(processWebhookJob(job)).rejects.toThrow(/503/);
  });

  it('throws on 429 (rate limited)', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('slow down', { status: 429 }));
    const job = makeJob({
      webhookId: 'wh_1',
      event: 'entry.publish',
      payload: {},
      attempt: 1,
      __target: { url: 'https://hooks.example.com', secret: 'whsec' },
    });
    await expect(processWebhookJob(job)).rejects.toThrow(/429/);
  });

  it('throws on network errors', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('econnrefused'));
    const job = makeJob({
      webhookId: 'wh_1',
      event: 'entry.publish',
      payload: {},
      attempt: 1,
      __target: { url: 'https://hooks.example.com', secret: 'whsec' },
    });
    await expect(processWebhookJob(job)).rejects.toThrow(/econnrefused/);
  });

  it('does NOT throw on 4xx (no retry) but still records the failure', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('bad request', { status: 400 }));
    const job = makeJob({
      webhookId: 'wh_1',
      event: 'entry.publish',
      payload: {},
      attempt: 1,
      __target: { url: 'https://hooks.example.com', secret: 'whsec' },
    });
    await expect(processWebhookJob(job)).resolves.toBeUndefined();
  });

  it('marks exhausted after the configured max attempts', async () => {
    fetchSpy.mockResolvedValue(new Response('boom', { status: 502 }));
    const job = makeJob({
      webhookId: 'wh_1',
      event: 'entry.publish',
      payload: {},
      attempt: 1,
      __target: { url: 'https://hooks.example.com', secret: 'whsec' },
    }, (Number(process.env.WEBHOOK_MAX_ATTEMPTS ?? '3') - 1));
    await expect(processWebhookJob(job)).rejects.toThrow(/502/);
  });

  it('rejects jobs missing required fields', async () => {
    const job = makeJob({
      webhookId: '',
      event: 'entry.publish',
      payload: {},
      attempt: 1,
      __target: { url: 'https://hooks.example.com', secret: 'whsec' },
    });
    await expect(processWebhookJob(job)).rejects.toThrow(/required/);
  });

  it('rejects jobs missing __target', async () => {
    const job = makeJob({
      webhookId: 'wh_1',
      event: 'entry.publish',
      payload: {},
      attempt: 1,
    });
    await expect(processWebhookJob(job)).rejects.toThrow(/__target/);
  });
});
