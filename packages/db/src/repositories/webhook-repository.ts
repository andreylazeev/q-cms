/**
 * Webhook repository — CRUD plus delivery tracking.
 *
 * Policy: see `./_shared.ts`. Reads return `Result`; writes throw on
 * irrecoverable errors and map unique violations to `ConflictError`.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { NotFoundError } from '@q-cms/core/errors';
import type { Result } from '@q-cms/core/result';
import type { UserId } from '@q-cms/core/branded';
import type {
  Paginated,
  Webhook,
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookEvent,
  WebhookRetryPolicy,
} from '@q-cms/core/types';

import type { DrizzleClient } from '../client.ts';
import {
  webhooks,
  webhookDeliveries,
  type WebhookRow,
  type WebhookDeliveryRow,
} from '../schema/index.ts';
import { toDomainError, tryFind } from './_shared.ts';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Input for `WebhookRepository.create`. */
export interface CreateWebhookInput {
  name: string;
  url: string;
  events: readonly WebhookEvent[];
  secret: string;
  headers?: Record<string, string>;
  isActive?: boolean;
  retryPolicy?: WebhookRetryPolicy;
  createdBy?: UserId | null;
}

/** Input for `WebhookRepository.update`. */
export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  events?: readonly WebhookEvent[];
  secret?: string;
  headers?: Record<string, string>;
  isActive?: boolean;
  retryPolicy?: WebhookRetryPolicy;
}

/** Input for `WebhookRepository.recordDelivery`. */
export interface RecordDeliveryInput {
  event: WebhookEvent;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempt?: number;
  responseCode?: number | null;
  responseBody?: string | null;
  responseHeaders?: Record<string, string> | null;
  errorMessage?: string | null;
  durationMs?: number | null;
  deliveredAt?: Date | null;
}

// ---------------------------------------------------------------------------
// Row → Domain mapping
// ---------------------------------------------------------------------------

function mapWebhook(row: WebhookRow): Webhook {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    events: (row.events ? row.events.split(',').filter(Boolean) : []) as readonly WebhookEvent[],
    secret: row.secret,
    headers: (row.headers ?? {}) as Record<string, string>,
    isActive: row.isActive === true,
    retryPolicy: row.retryPolicy as WebhookRetryPolicy,
    createdBy: (row.createdBy ?? null) as UserId | null,
    createdAt: row.createdAt.toISOString() as Webhook['createdAt'],
  };
}

function mapDelivery(row: WebhookDeliveryRow): WebhookDelivery {
  return {
    id: row.id,
    webhookId: row.webhookId,
    event: row.event as WebhookEvent,
    payload: row.payload as Record<string, unknown>,
    attempt: row.attempt,
    status: row.status,
    responseCode: row.responseCode,
    responseBody: row.responseBody,
    responseHeaders: row.responseHeaders as Record<string, string> | null,
    errorMessage: row.errorMessage,
    durationMs: row.durationMs,
    scheduledAt: row.scheduledAt.toISOString() as WebhookDelivery['scheduledAt'],
    deliveredAt: row.deliveredAt
      ? (row.deliveredAt.toISOString() as WebhookDelivery['deliveredAt'])
      : null,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class WebhookRepository {
  private readonly db: DrizzleClient;

  constructor(db: DrizzleClient) {
    this.db = db;
  }

  /** Find a webhook by primary key. */
  async findById(id: string): Promise<Result<Webhook, NotFoundError>> {
    return tryFind<Webhook>(async () => {
      const rows = await this.db
        .select()
        .from(webhooks)
        .where(eq(webhooks.id, id))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return mapWebhook(row);
    }, 'Webhook');
  }

  /** List webhooks (active + inactive). */
  async list(input: { activeOnly?: boolean; page?: number; pageSize?: number } = {}): Promise<Paginated<Webhook>> {
    const where = input.activeOnly ? eq(webhooks.isActive, true) : undefined;
    const pageSize = input.pageSize ?? 20;
    const page = input.page ?? 1;
    const offset = (page - 1) * pageSize;

    const rows = await this.db
      .select()
      .from(webhooks)
      .where(where)
      .orderBy(desc(webhooks.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhooks)
      .where(where);
    const total = totalRows[0]?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: rows.map(mapWebhook),
      page: {
        nextCursor: page < totalPages ? String(page + 1) : null,
        prevCursor: page > 1 ? String(page - 1) : null,
        limit: pageSize,
        total,
      },
    };
  }

  /** Create a webhook. */
  async create(input: CreateWebhookInput): Promise<Webhook> {
    try {
      const [row] = await this.db
        .insert(webhooks)
        .values({
          name: input.name,
          url: input.url,
          events: input.events.join(','),
          secret: input.secret,
          headers: input.headers ?? {},
          isActive: input.isActive ?? true,
          retryPolicy: input.retryPolicy ?? { maxAttempts: 3, backoff: 'exponential' },
          createdBy: input.createdBy ?? null,
        })
        .returning();
      if (!row) throw new Error('insert returned no row');
      return mapWebhook(row);
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Update a webhook. */
  async update(id: string, patch: UpdateWebhookInput): Promise<Webhook> {
    try {
      const updates: Partial<typeof webhooks.$inferInsert> = {};
      if (patch.name !== undefined) updates.name = patch.name;
      if (patch.url !== undefined) updates.url = patch.url;
      if (patch.events !== undefined) updates.events = patch.events.join(',');
      if (patch.secret !== undefined) updates.secret = patch.secret;
      if (patch.headers !== undefined) updates.headers = patch.headers;
      if (patch.isActive !== undefined) updates.isActive = patch.isActive;
      if (patch.retryPolicy !== undefined) updates.retryPolicy = patch.retryPolicy;

      const [row] = await this.db
        .update(webhooks)
        .set(updates)
        .where(eq(webhooks.id, id))
        .returning();
      if (!row) throw new NotFoundError('Webhook not found', { id });
      return mapWebhook(row);
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Hard delete a webhook (cascades to deliveries). */
  async delete(id: string): Promise<void> {
    try {
      const result = await this.db
        .delete(webhooks)
        .where(eq(webhooks.id, id))
        .returning();
      if (result.length === 0) throw new NotFoundError('Webhook not found', { id });
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Record a delivery attempt for a webhook. */
  async recordDelivery(
    webhookIdValue: string,
    input: RecordDeliveryInput,
  ): Promise<WebhookDelivery> {
    try {
      const [row] = await this.db
        .insert(webhookDeliveries)
        .values({
          webhookId: webhookIdValue,
          event: input.event,
          payload: input.payload,
          attempt: input.attempt ?? 1,
          status: input.status,
          responseCode: input.responseCode ?? null,
          responseBody: input.responseBody ?? null,
          responseHeaders: input.responseHeaders ?? null,
          errorMessage: input.errorMessage ?? null,
          durationMs: input.durationMs ?? null,
          deliveredAt: input.deliveredAt ?? null,
        })
        .returning();
      if (!row) throw new Error('insert returned no row');
      return mapDelivery(row);
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** List delivery attempts for a webhook, newest first. */
  async getDeliveries(
    webhookIdValue: string,
    options: { status?: WebhookDeliveryStatus; page?: number; pageSize?: number } = {},
  ): Promise<Paginated<WebhookDelivery>> {
    const conditions = [eq(webhookDeliveries.webhookId, webhookIdValue)];
    if (options.status) conditions.push(eq(webhookDeliveries.status, options.status));
    const where = and(...conditions);

    const pageSize = options.pageSize ?? 20;
    const page = options.page ?? 1;
    const offset = (page - 1) * pageSize;

    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(where)
      .orderBy(desc(webhookDeliveries.scheduledAt))
      .limit(pageSize)
      .offset(offset);

    const totalRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhookDeliveries)
      .where(where);
    const total = totalRows[0]?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: rows.map(mapDelivery),
      page: {
        nextCursor: page < totalPages ? String(page + 1) : null,
        prevCursor: page > 1 ? String(page - 1) : null,
        limit: pageSize,
        total,
      },
    };
  }
}
