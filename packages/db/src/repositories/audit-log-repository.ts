/**
 * Audit log repository — record actions and query history.
 *
 * Policy: see `./_shared.ts`. `record` is a fire-and-forget write that
 * maps unique violations to `ConflictError`; `query` returns a plain
 * array (audit reads are non-fallible beyond connection errors).
 */

import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { NotFoundError } from '@q-cms/core/errors';
import type { Result } from '@q-cms/core/result';
import { type UserId } from '@q-cms/core/branded';
import type { AuditLogEntry, Paginated } from '@q-cms/core/types';

import type { DrizzleClient } from '../client.ts';
import { auditLog, type AuditLogRow } from '../schema/index.ts';
import { toDomainError, tryFind } from './_shared.ts';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Input for `AuditLogRepository.record`. */
export interface RecordAuditInput {
  actorId?: UserId | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  diff?: Record<string, { from: unknown; to: unknown }> | null;
  context?: Record<string, unknown>;
  occurredAt?: Date;
}

/** Filter for `AuditLogRepository.query`. */
export interface QueryAuditInput {
  actorId?: UserId;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Row → Domain mapping
// ---------------------------------------------------------------------------

function mapAudit(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actorId: (row.actorId ?? null) as UserId | null,
    actorEmail: row.actorEmail,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    diff: row.diff as AuditLogEntry['diff'],
    context: (row.context ?? {}) as Record<string, unknown>,
    occurredAt: row.occurredAt.toISOString() as AuditLogEntry['occurredAt'],
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class AuditLogRepository {
  private readonly db: DrizzleClient;

  constructor(db: DrizzleClient) {
    this.db = db;
  }

  /** Persist a single audit event. */
  async record(input: RecordAuditInput): Promise<AuditLogEntry> {
    try {
      const [row] = await this.db
        .insert(auditLog)
        .values({
          actorId: input.actorId ?? null,
          actorEmail: input.actorEmail ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          diff: input.diff ?? null,
          context: input.context ?? {},
          occurredAt: input.occurredAt ?? new Date(),
        })
        .returning();
      if (!row) throw new Error('insert returned no row');
      return mapAudit(row);
    } catch (cause) {
      throw toDomainError(cause);
    }
  }

  /** Fetch a single audit row by ID — `Result<T, NotFoundError>`. */
  async findById(id: string): Promise<Result<AuditLogEntry, NotFoundError>> {
    return tryFind<AuditLogEntry>(async () => {
      const rows = await this.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.id, id))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return mapAudit(row);
    }, 'AuditLog');
  }

  /** Query audit entries with optional filters and pagination. */
  async query(input: QueryAuditInput = {}): Promise<Paginated<AuditLogEntry>> {
    const conditions: SQL[] = [];
    if (input.actorId) conditions.push(eq(auditLog.actorId, input.actorId));
    if (input.resourceType) conditions.push(eq(auditLog.resourceType, input.resourceType));
    if (input.resourceId) conditions.push(eq(auditLog.resourceId, input.resourceId));
    if (input.action) conditions.push(eq(auditLog.action, input.action));
    if (input.from) conditions.push(gte(auditLog.occurredAt, input.from));
    if (input.to) conditions.push(lte(auditLog.occurredAt, input.to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const pageSize = input.pageSize ?? 50;
    const page = input.page ?? 1;
    const offset = (page - 1) * pageSize;

    const rows = await this.db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.occurredAt))
      .limit(pageSize)
      .offset(offset);

    const totalRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where);
    const total = totalRows[0]?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: rows.map(mapAudit),
      page: {
        nextCursor: page < totalPages ? String(page + 1) : null,
        prevCursor: page > 1 ? String(page - 1) : null,
        limit: pageSize,
        total,
      },
    };
  }
}
