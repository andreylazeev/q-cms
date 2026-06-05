/**
 * Audit log table — DATA_MODEL.md §1.5.
 *
 * Stores denormalized actor information so audit rows survive user deletion.
 * Partitioned by `occurred_at` (range, monthly) in production deployments;
 * the migration generator emits the base table; partitioning is created
 * out-of-band via the `drizzle/partitioned_audit_log.sql` migration.
 */

import { customType, pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';

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

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id'),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    diff: jsonb('diff'),
    context: jsonb('context').notNull().default({}),
    occurredAt: timestamptz('occurred_at').notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index('idx_audit_actor').on(t.actorId, t.occurredAt.desc()),
    resourceIdx: index('idx_audit_resource').on(t.resourceType, t.resourceId, t.occurredAt.desc()),
    actionIdx: index('idx_audit_action').on(t.action, t.occurredAt.desc()),
  }),
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type AuditLogInsert = typeof auditLog.$inferInsert;
