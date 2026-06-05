/**
 * Webhook CRUD + delivery routes.
 *
 * Endpoints:
 *   GET    /api/v1/webhooks
 *   POST   /api/v1/webhooks
 *   PATCH  /api/v1/webhooks/{id}
 *   DELETE /api/v1/webhooks/{id}
 *   GET    /api/v1/webhooks/{id}/deliveries
 *   POST   /api/v1/webhooks/{id}/deliveries/{deliveryId}/retry
 *
 * @module routes/webhooks
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { NotFoundError, type Webhook, type WebhookDelivery } from '../lib/stubs/core-shim.ts';
import { webhookRepo } from '../lib/stubs/index.ts';
import { serializeResource, serializeCollection } from '../lib/jsonapi.ts';
import { cursorPaginationSchema } from '../lib/zod-helpers.ts';
import { enqueue, QUEUE_NAMES } from '../services/queue.ts';

export const webhooksRouter = new Hono();

const eventEnum = z.enum([
  'entry.create',
  'entry.update',
  'entry.publish',
  'entry.unpublish',
  'entry.delete',
  'media.upload',
  'media.delete',
  'user.create',
  'user.update',
  'user.delete',
  'role.assign',
  'role.revoke',
]);

const retryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(20).default(3),
  backoff: z.enum(['linear', 'exponential', 'fixed']).default('exponential'),
  initialDelayMs: z.number().int().min(0).max(86_400_000).default(1_000),
});

const createWebhookSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  events: z.array(eventEnum).min(1).max(32),
  secret: z.string().min(16),
  headers: z.record(z.string()).optional(),
  isActive: z.boolean().default(true),
  retryPolicy: retryPolicySchema.optional(),
});

const updateWebhookSchema = createWebhookSchema.partial();

/** GET /webhooks */
webhooksRouter.get('/', async (c) => {
  const page = cursorPaginationSchema.parse(c.req.query());
  const result = await webhookRepo.list({
    limit: page.limit,
    cursor: page.cursor ?? null,
    withTotal: page.withTotal ?? false,
  });
  return c.json(serializeCollection('Webhook', result.data, {
    pageInfo: {
      hasNext: result.page.nextCursor !== null,
      hasPrev: result.page.prevCursor !== null,
      startCursor: result.page.prevCursor,
      endCursor: result.page.nextCursor,
    },
    totalCount: result.page.total ?? undefined,
  }));
});

/** POST /webhooks */
webhooksRouter.post('/', async (c) => {
  const body = createWebhookSchema.parse(await c.req.json().catch(() => ({})));
  const wh = await webhookRepo.create({
    name: body.name,
    url: body.url,
    events: body.events,
    secret: body.secret,
    headers: body.headers ?? {},
    isActive: body.isActive,
    retryPolicy: body.retryPolicy ?? { maxAttempts: 3, backoff: 'exponential', initialDelayMs: 1_000 },
    createdBy: (c.get('user')?.id ?? null) as Webhook['createdBy'],
  });
  return c.json(serializeResource('Webhook', wh.id, publicWebhook(wh)), 201);
});

/** PATCH /webhooks/{id} */
webhooksRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = updateWebhookSchema.parse(await c.req.json().catch(() => ({})));
  const wh = await webhookRepo.update(id, {
    ...(body.name ? { name: body.name } : {}),
    ...(body.url ? { url: body.url } : {}),
    ...(body.events ? { events: body.events } : {}),
    ...(body.secret ? { secret: body.secret } : {}),
    ...(body.headers ? { headers: body.headers } : {}),
    ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    ...(body.retryPolicy ? { retryPolicy: body.retryPolicy } : {}),
  });
  return c.json(serializeResource('Webhook', wh.id, publicWebhook(wh)));
});

/** DELETE /webhooks/{id} */
webhooksRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await webhookRepo.delete(id);
  return c.body(null, 204);
});

/** GET /webhooks/{id}/deliveries */
webhooksRouter.get('/:id/deliveries', async (c) => {
  const id = c.req.param('id');
  const wh = await webhookRepo.findById(id);
  if (!wh) throw new NotFoundError('Webhook not found');
  const deliveries = await webhookRepo.listDeliveries(id);
  return c.json(serializeCollection('WebhookDelivery', deliveries.map((d) => ({
    id: d.id,
    webhookId: d.webhookId,
    event: d.event,
    attempt: d.attempt,
    status: d.status,
    responseCode: d.responseCode,
    durationMs: d.durationMs,
    scheduledAt: d.scheduledAt,
    deliveredAt: d.deliveredAt,
  })), {
    pageInfo: { hasNext: false, hasPrev: false, startCursor: null, endCursor: null },
    totalCount: deliveries.length,
  }));
});

/** POST /webhooks/{id}/deliveries/{deliveryId}/retry */
webhooksRouter.post('/:id/deliveries/:deliveryId/retry', async (c) => {
  const id = c.req.param('id');
  const deliveryId = c.req.param('deliveryId');
  const wh = await webhookRepo.findById(id);
  if (!wh) throw new NotFoundError('Webhook not found');
  const delivery = await webhookRepo.findDelivery(deliveryId);
  if (!delivery) throw new NotFoundError('Delivery not found');
  await enqueue(QUEUE_NAMES.webhookDelivery, {
    webhookId: id,
    event: delivery.event,
    payload: (delivery.payload ?? {}) as Record<string, unknown>,
    attempt: delivery.attempt + 1,
  });
  return c.json({ data: { id: deliveryId, type: 'WebhookRetry', attributes: { queued: true } } });
});

function publicWebhook(w: Webhook): Record<string, unknown> {
  return {
    name: w.name,
    url: w.url,
    events: w.events,
    isActive: w.isActive,
    headers: w.headers,
    retryPolicy: w.retryPolicy,
    createdBy: w.createdBy,
    createdAt: w.createdAt,
  };
}

// Re-export for tests
export type { WebhookDelivery };
