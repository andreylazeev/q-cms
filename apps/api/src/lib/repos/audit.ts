/**
 * Audit log repository adapter.
 *
 * Wraps `@q-cms/db`'s `AuditLogRepository` and exposes the same flat
 * interface the route handlers expect.
 *
 * @module lib/repos/audit
 */

import { AuditLogRepository } from '@q-cms/db';
import type { AuditLogEntry, Paginated, UserId } from '@q-cms/core';
import { getDb } from '../db.ts';

let cached: AuditLogRepository | undefined;

function repo(): AuditLogRepository {
  if (!cached) cached = new AuditLogRepository(getDb());
  return cached;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AuditRepo {
  list(query: {
    actorId?: string;
    action?: string;
    resourceType?: string;
    limit: number;
    cursor: string | null;
    withTotal: boolean;
  }): Promise<Paginated<AuditLogEntry>>;
  record(entry: {
    actorId?: string | null;
    actorEmail?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    diff?: Record<string, { from: unknown; to: unknown }> | null;
    context?: Record<string, unknown>;
  }): Promise<AuditLogEntry>;
}

export const auditRepo: AuditRepo = {
  async list({ actorId, action, resourceType, limit, cursor, withTotal }) {
    const cursorNum = cursor ? Number(cursor) : 1;
    return repo().query({
      actorId: actorId as UserId | undefined,
      action,
      resourceType,
      page: cursorNum,
      pageSize: limit,
    });
  },

  async record(entry) {
    return repo().record(entry as Parameters<AuditLogRepository['record']>[0]);
  },
};
