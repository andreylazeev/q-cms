/**
 * Email tables: `email_templates`, `email_queue`.
 *
 * Mirrors DATA_MODEL.md §5.
 *
 * Notes:
 * - `email_templates.variables` is `JSONB` (array of variable names).
 * - `email_queue.status` is a `pgEnum` matching `EmailStatus`.
 */

import { customType, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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

export const emailStatusEnum = pgEnum('email_status', [
  'pending',
  'sent',
  'failed',
  'bounced',
]);

// ---------------------------------------------------------------------------
// email_templates
// ---------------------------------------------------------------------------

export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  bodyText: text('body_text').notNull(),
  variables: jsonb('variables').notNull().default([]),
  isActive: text('is_active').notNull().default('true'),
});

export type EmailTemplateRow = typeof emailTemplates.$inferSelect;
export type EmailTemplateInsert = typeof emailTemplates.$inferInsert;

// ---------------------------------------------------------------------------
// email_queue
// ---------------------------------------------------------------------------

export const emailQueue = pgTable(
  'email_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toEmail: text('to_email').notNull(),
    fromEmail: text('from_email').notNull(),
    subject: text('subject').notNull(),
    bodyHtml: text('body_html').notNull(),
    bodyText: text('body_text').notNull(),
    templateName: text('template_name'),
    variables: jsonb('variables'),
    status: emailStatusEnum('status').notNull().default('pending'),
    attempts: text('attempts').notNull().default('0'),
    lastError: text('last_error'),
    scheduledAt: timestamptz('scheduled_at').notNull().defaultNow(),
    sentAt: timestamptz('sent_at'),
  },
  (t) => ({
    statusIdx: index('idx_email_queue_status').on(t.status),
    scheduledIdx: index('idx_email_queue_scheduled').on(t.scheduledAt),
  }),
);

export type EmailQueueRow = typeof emailQueue.$inferSelect;
export type EmailQueueInsert = typeof emailQueue.$inferInsert;
