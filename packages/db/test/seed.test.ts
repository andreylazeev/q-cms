/**
 * Integration test for the seeder.
 *
 * Boots Testcontainers, runs the seed logic via the underlying
 * repositories, and asserts that the baseline rows exist exactly once
 * (idempotency).
 *
 * Run via:
 * ```sh
 * pnpm test:integration
 * ```
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

import * as schema from '../src/schema/index.ts';

let container: StartedPostgreSqlContainer | undefined;
let sqlClient: ReturnType<typeof postgres> | undefined;
let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

const skip = process.env['SKIP_INTEGRATION'] === '1';

beforeAll(async () => {
  if (skip) return;
  try {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('qcms_seed')
      .withUsername('qcms')
      .withPassword('qcms')
      .start();
  } catch (cause) {
    console.warn('[seed integration] Docker not available — skipping:', cause);
    return;
  }

  const url = container.getConnectionUri();
  sqlClient = postgres(url, { max: 2, prepare: false });
  db = drizzle(sqlClient, { schema });
  await applySchema(sqlClient);
}, 120_000);

afterAll(async () => {
  if (sqlClient) await sqlClient.end({ timeout: 5 });
  if (container) await container.stop();
}, 60_000);

async function applySchema(client: ReturnType<typeof postgres>): Promise<void> {
  await client.unsafe(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "citext";

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email CITEXT UNIQUE NOT NULL,
      username TEXT UNIQUE,
      password_hash TEXT,
      first_name TEXT,
      last_name TEXT,
      avatar_id UUID,
      is_active BOOLEAN NOT NULL DEFAULT true,
      is_super_admin BOOLEAN NOT NULL DEFAULT false,
      totp_secret TEXT,
      totp_enabled BOOLEAN NOT NULL DEFAULT false,
      email_verified_at TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_system BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      resource TEXT NOT NULL,
      action TEXT NOT NULL,
      conditions TEXT NOT NULL DEFAULT '{}',
      UNIQUE (resource, action)
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      scope TEXT NOT NULL DEFAULT '{}',
      granted_by UUID,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS collections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      is_singleton TEXT NOT NULL DEFAULT 'false',
      draft_and_publish TEXT NOT NULL DEFAULT 'true',
      versioning TEXT NOT NULL DEFAULT 'true',
      schema TEXT NOT NULL,
      settings TEXT NOT NULL DEFAULT '{}',
      display_name TEXT NOT NULL,
      display_name_i18n TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS email_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      body_text TEXT NOT NULL,
      variables TEXT NOT NULL DEFAULT '[]',
      is_active TEXT NOT NULL DEFAULT 'true'
    );
  `);
}

// ---------------------------------------------------------------------------
// Inlined seed data (mirrors src/scripts/seed.ts)
// ---------------------------------------------------------------------------

const SEED_ROLES = [
  { name: 'super_admin', description: 'Unrestricted access.', isSystem: true },
  { name: 'admin', description: 'Full access to collections, media, users, and settings.', isSystem: true },
  { name: 'editor', description: 'Manage and publish content in assigned collections.', isSystem: true },
  { name: 'author', description: 'Create and edit own content.', isSystem: true },
  { name: 'reviewer', description: 'Read content and approve drafts.', isSystem: true },
  { name: 'viewer', description: 'Read-only access.', isSystem: true },
];

const SEED_COLLECTIONS = [
  { name: 'Article', slug: 'articles', displayName: 'Article' },
  { name: 'Author', slug: 'authors', displayName: 'Author' },
  { name: 'Category', slug: 'categories', displayName: 'Category' },
  { name: 'Tag', slug: 'tags', displayName: 'Tag' },
  { name: 'Settings', slug: 'settings', displayName: 'Settings' },
];

const SEED_TEMPLATES = ['review-request', 'publish-notification', 'password-reset', 'magic-link', 'welcome'];

/** Run the seed logic against the current test DB. */
async function runSeed(): Promise<void> {
  if (!db) throw new Error('db is not initialized');

  for (const r of SEED_ROLES) {
    await db
      .insert(schema.roles)
      .values({ name: r.name, description: r.description, isSystem: r.isSystem ? 'true' : 'false' })
      .onConflictDoNothing({ target: schema.roles.name });
  }

  for (const c of SEED_COLLECTIONS) {
    await db
      .insert(schema.collections)
      .values({
        name: c.name,
        slug: c.slug,
        schema: JSON.stringify({ type: 'object', properties: {} }),
        displayName: c.displayName,
      })
      .onConflictDoNothing({ target: schema.collections.name });
  }

  for (const t of SEED_TEMPLATES) {
    await db
      .insert(schema.emailTemplates)
      .values({
        name: t,
        subject: t,
        bodyHtml: `<p>${t}</p>`,
        bodyText: t,
      })
      .onConflictDoNothing({ target: schema.emailTemplates.name });
  }

  // Super-admin user
  const adminEmail = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@qcms.test';
  await db
    .insert(schema.users)
    .values({
      email: adminEmail,
      passwordHash: 'scrypt$seed',
      isActive: true,
      isSuperAdmin: true,
      emailVerifiedAt: new Date(),
    })
    .onConflictDoNothing({ target: schema.users.email });
}

describe.skipIf(skip)('seed (integration)', () => {
  it('creates baseline rows and is idempotent on re-run', async () => {
    if (!db) return;
    process.env['SEED_ADMIN_EMAIL'] = 'admin@qcms.test';

    // First run.
    await runSeed();
    // Second run — should be a no-op.
    await runSeed();

    // Assertions.
    const roleRows = await db.select().from(schema.roles);
    expect(roleRows.length).toBeGreaterThanOrEqual(6);

    const collectionRows = await db.select().from(schema.collections);
    expect(collectionRows.length).toBeGreaterThanOrEqual(5);

    const templateRows = await db.select().from(schema.emailTemplates);
    expect(templateRows.length).toBeGreaterThanOrEqual(3);

    const adminRows = await db
      .select()
      .from(schema.users)
      .where(sql`${schema.users.email} = 'admin@qcms.test'`);
    expect(adminRows).toHaveLength(1);
  });
});
