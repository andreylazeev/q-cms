/**
 * Webhook tables: `webhooks`, `webhook_deliveries`.
 *
 * Mirrors DATA_MODEL.md §4.
 *
 * Notes:
 * - `webhooks.events` is a `TEXT[]` — modeled as comma-separated text for
 *   Drizzle v0.36 portability; the application layer parses to
 *   `readonly WebhookEvent[]`.
 * - `webhooks.headers` is `JSONB`.
 * - `webhooks.retry_policy` is `JSONB` (typed by `WebhookRetryPolicy` in core).
 * - `webhook_deliveries.status` is a `pgEnum` matching `WebhookDeliveryStatus`.
 */

import {
  boolean,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { users } from './auth.ts';

const jsonb = customType<{ data: unknown; driverData: unknown }>({
  dataType() {
    return 'jsonb';
  },
  toDriver(value: unknown): string {
    return JSON.stringify(value ?? null);
  },
  fromDriver(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') return value ? JSON.parse(value) : null;
    return value;
  },
});

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'pending',
  'success',
  'failed',
  'exhausted',
]);

// ---------------------------------------------------------------------------
// webhooks
// ---------------------------------------------------------------------------

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  /** Comma-separated event identifiers; application layer splits. */
  events: text('events').notNull().default('[]'),
  secret: text('secret').notNull(),
  headers: jsonb('headers').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  retryPolicy: jsonb('retry_policy')
    .notNull()
    .default({ maxAttempts: 3, backoff: 'exponential', initialDelayMs: 1000 }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

export type WebhookRow = typeof webhooks.$inferSelect;
export type WebhookInsert = typeof webhooks.$inferInsert;

// ---------------------------------------------------------------------------
// webhook_deliveries
// ---------------------------------------------------------------------------

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    webhookId: uuid('webhook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    payload: jsonb('payload').notNull(),
    attempt: integer('attempt').notNull().default(1),
    status: deliveryStatusEnum('status').notNull(),
    responseCode: integer('response_code'),
    responseBody: text('response_body'),
    responseHeaders: jsonb('response_headers'),
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms'),
    scheduledAt: timestamptz('scheduled_at').notNull().defaultNow(),
    deliveredAt: timestamptz('delivered_at'),
  },
  (t) => ({
    webhookIdx: index('idx_deliveries_webhook').on(t.webhookId, t.scheduledAt.desc()),
    pendingIdx: index('idx_deliveries_pending')
      .on(t.scheduledAt)
      .where(sql`${t.status} = 'pending'`),
  }),
);

export type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect;
export type WebhookDeliveryInsert = typeof webhookDeliveries.$inferInsert;
