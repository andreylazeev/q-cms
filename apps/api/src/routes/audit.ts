/**
 * Audit log query route.
 *
 * GET /api/v1/audit-log
 *   Filters: actorId, action, resourceType, from, to, limit, cursor.
 *
 * @module routes/audit
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { auditRepo } from '../lib/stubs/index.ts';
import { serializeCollection } from '../lib/jsonapi.ts';
import { cursorPaginationSchema } from '../lib/zod-helpers.ts';

export const auditRouter = new Hono();

const auditQuerySchema = cursorPaginationSchema.extend({
  actorId: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  resourceType: z.string().min(1).optional(),
});

auditRouter.get('/audit-log', async (c) => {
  const q = auditQuerySchema.parse(c.req.query());
  const result = await auditRepo.list({
    ...(q.actorId ? { actorId: q.actorId } : {}),
    ...(q.action ? { action: q.action } : {}),
    ...(q.resourceType ? { resourceType: q.resourceType } : {}),
    limit: q.limit,
    cursor: q.cursor ?? null,
    withTotal: q.withTotal ?? false,
  });
  return c.json(serializeCollection('AuditLog', result.data, {
    pageInfo: {
      hasNext: result.page.nextCursor !== null,
      hasPrev: result.page.prevCursor !== null,
      startCursor: result.page.prevCursor,
      endCursor: result.page.nextCursor,
    },
    totalCount: result.page.total ?? undefined,
  }));
});
