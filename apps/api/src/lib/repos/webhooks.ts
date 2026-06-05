/**
 * Webhook repository adapter.
 *
 * Wraps `@q-cms/db`'s `WebhookRepository` and exposes the same flat
 * interface the route handlers expect.
 *
 * @module lib/repos/webhooks
 */

import { WebhookRepository } from '@q-cms/db';
import type { Paginated, Webhook, WebhookDelivery } from '@q-cms/core';
import { getDb } from '../db.ts';

let cached: WebhookRepository | undefined;

function repo(): WebhookRepository {
  if (!cached) cached = new WebhookRepository(getDb());
  return cached;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WebhookRepo {
  list(page: { limit: number; cursor: string | null; withTotal: boolean }): Promise<Paginated<Webhook>>;
  findById(id: string): Promise<Webhook | null>;
  create(input: Record<string, unknown>): Promise<Webhook>;
  update(id: string, patch: Record<string, unknown>): Promise<Webhook>;
  delete(id: string): Promise<void>;
  listDeliveries(webhookId: string, page?: { limit?: number; cursor?: string | null }): Promise<Paginated<WebhookDelivery>>;
  recordDelivery(delivery: Record<string, unknown>): Promise<WebhookDelivery>;
  findDelivery(id: string): Promise<WebhookDelivery | null>;
}

export const webhookRepo: WebhookRepo = {
  async list(page) {
    const cursorNum = page.cursor ? Number(page.cursor) : 1;
    const limit = page.limit;
    return repo().list({ page: cursorNum, pageSize: limit });
  },

  async findById(id) {
    const result = await repo().findById(id);
    return result.ok ? result.value : null;
  },

  async create(input) {
    return repo().create(input as Parameters<WebhookRepository['create']>[0]);
  },

  async update(id, patch) {
    return repo().update(id, patch as Parameters<WebhookRepository['update']>[0]);
  },

  async delete(id) {
    await repo().delete(id);
  },

  async listDeliveries(webhookId, page) {
    const cursorNum = page?.cursor ? Number(page.cursor) : 1;
    const limit = page?.limit ?? 20;
    return repo().getDeliveries(webhookId, { page: cursorNum, pageSize: limit });
  },

  async recordDelivery(delivery) {
    const webhookIdValue = delivery.webhookId as string;
    // The stub shape puts webhookId inline; the real repo takes it as first arg.
    const input = delivery as Parameters<WebhookRepository['recordDelivery']>[1];
    return repo().recordDelivery(webhookIdValue, input);
  },

  async findDelivery(_id) {
    // TODO: `WebhookRepository` doesn't expose a `findDelivery` method yet.
    return null;
  },
};
