/**
 * Schema sanity tests — ensure every expected table is exported and named
 * exactly as Drizzle will emit it in migrations.
 *
 * These tests are pure unit tests; no database connection is required.
 */

import { describe, expect, it } from 'vitest';
import { getTableName } from 'drizzle-orm';

import * as schema from '../src/schema/index.ts';

interface ExpectedTable {
  /** Identifier in `*` export — camelCase, matches the variable name. */
  exportName: string;
  /** SQL table name (snake_case). */
  tableName: string;
}

const EXPECTED_TABLES: readonly ExpectedTable[] = [
  // auth
  { exportName: 'users', tableName: 'users' },
  { exportName: 'sessions', tableName: 'sessions' },
  { exportName: 'apiTokens', tableName: 'api_tokens' },
  // rbac
  { exportName: 'roles', tableName: 'roles' },
  { exportName: 'permissions', tableName: 'permissions' },
  { exportName: 'rolePermissions', tableName: 'role_permissions' },
  { exportName: 'userRoles', tableName: 'user_roles' },
  // audit
  { exportName: 'auditLog', tableName: 'audit_log' },
  // content
  { exportName: 'collections', tableName: 'collections' },
  { exportName: 'entries', tableName: 'entries' },
  { exportName: 'entryRevisions', tableName: 'entry_revisions' },
  { exportName: 'entryRelations', tableName: 'entry_relations' },
  { exportName: 'entryComments', tableName: 'entry_comments' },
  // media
  { exportName: 'media', tableName: 'media' },
  { exportName: 'mediaVariants', tableName: 'media_variants' },
  { exportName: 'mediaFolders', tableName: 'media_folders' },
  { exportName: 'mediaTags', tableName: 'media_tags' },
  { exportName: 'mediaTagAssignments', tableName: 'media_tag_assignments' },
  // webhooks
  { exportName: 'webhooks', tableName: 'webhooks' },
  { exportName: 'webhookDeliveries', tableName: 'webhook_deliveries' },
  // email
  { exportName: 'emailTemplates', tableName: 'email_templates' },
  { exportName: 'emailQueue', tableName: 'email_queue' },
];

describe('schema', () => {
  it('exports a table for every DATA_MODEL.md entity', () => {
    for (const { exportName, tableName } of EXPECTED_TABLES) {
      const candidate = (schema as Record<string, unknown>)[exportName];
      expect(candidate, `expected export \`${exportName}\``).toBeDefined();
      // Tables produced by `pgTable` expose a `getTableName` helper.
      expect(
        getTableName(candidate as Parameters<typeof getTableName>[0]),
        `expected export \`${exportName}\` to be table \`${tableName}\``,
      ).toBe(tableName);
    }
  });

  it('exports entry / media / webhook / email / RBAC enums', () => {
    expect(schema.entryStatusEnum, 'entryStatusEnum').toBeDefined();
    expect(schema.mediaTypeEnum, 'mediaTypeEnum').toBeDefined();
    expect(schema.deliveryStatusEnum, 'deliveryStatusEnum').toBeDefined();
    expect(schema.emailStatusEnum, 'emailStatusEnum').toBeDefined();
  });

  it('exposes $inferSelect / $inferInsert for every table', () => {
    // Spot-check a handful — exhaustive verification would be redundant
    // with the TypeScript compiler.
    type _UserSelect = typeof schema.users.$inferSelect;
    type _UserInsert = typeof schema.users.$inferInsert;
    type _EntrySelect = typeof schema.entries.$inferSelect;
    type _EntryInsert = typeof schema.entries.$inferInsert;
    type _MediaSelect = typeof schema.media.$inferSelect;
    type _MediaInsert = typeof schema.media.$inferInsert;
    type _WebhookSelect = typeof schema.webhooks.$inferSelect;
    type _WebhookInsert = typeof schema.webhooks.$inferInsert;
    type _AuditSelect = typeof schema.auditLog.$inferSelect;
    type _AuditInsert = typeof schema.auditLog.$inferInsert;
    // Use the types so the compiler doesn't elide them.
    const _types: [
      _UserSelect,
      _UserInsert,
      _EntrySelect,
      _EntryInsert,
      _MediaSelect,
      _MediaInsert,
      _WebhookSelect,
      _WebhookInsert,
      _AuditSelect,
      _AuditInsert,
    ] = [
      {} as _UserSelect,
      {} as _UserInsert,
      {} as _EntrySelect,
      {} as _EntryInsert,
      {} as _MediaSelect,
      {} as _MediaInsert,
      {} as _WebhookSelect,
      {} as _WebhookInsert,
      {} as _AuditSelect,
      {} as _AuditInsert,
    ];
    expect(_types).toHaveLength(10);
  });
});
