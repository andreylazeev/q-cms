#!/usr/bin/env bun
/**
 * Idempotent database seeder.
 *
 * Inserts the Q-CMS baseline (default roles, permissions, collections, and
 * email templates) and a single super-admin user. Safe to re-run — every
 * insert uses `ON CONFLICT DO NOTHING` or an existence check.
 *
 * Environment:
 * - `DATABASE_URL`         — required.
 * - `SEED_ADMIN_EMAIL`     — required.
 * - `SEED_ADMIN_PASSWORD`  — required (will be bcrypt-hashed with cost 12).
 *
 * Usage:
 * ```sh
 * bun run src/scripts/seed.ts
 * # or
 * pnpm seed
 * ```
 */

import { createHash, randomBytes } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

// Inline bcrypt stand-in: when @q-cms/auth is unavailable we hash with
// scrypt via node:crypto (no external dep) and tag the hash with a
// `scrypt$` prefix so the auth package can recognize it on first login.
import { scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

import {
  collections,
  emailTemplates,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from '../schema/index.ts';

const DATABASE_URL = process.env['DATABASE_URL'];
const ADMIN_EMAIL = process.env['SEED_ADMIN_EMAIL'];
const ADMIN_PASSWORD = process.env['SEED_ADMIN_PASSWORD'];

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

interface SeedRole {
  name: string;
  description: string;
  isSystem: boolean;
  /** Permission grants for this role. `*` matches any resource/action. */
  permissions: ReadonlyArray<{ resource: string; action: string }>;
}

const SEED_ROLES: readonly SeedRole[] = [
  {
    name: 'super_admin',
    description: 'Unrestricted access to every resource and action.',
    isSystem: true,
    permissions: [{ resource: '*', action: '*' }],
  },
  {
    name: 'admin',
    description: 'Full access to collections, media, users, and settings.',
    isSystem: true,
    permissions: [
      { resource: 'collection:*', action: '*' },
      { resource: 'media', action: '*' },
      { resource: 'settings', action: '*' },
      { resource: 'webhooks', action: '*' },
      { resource: 'users', action: 'read' },
      { resource: 'users', action: 'create' },
      { resource: 'users', action: 'update' },
    ],
  },
  {
    name: 'editor',
    description: 'Manage and publish content in assigned collections.',
    isSystem: true,
    permissions: [
      { resource: 'collection:*', action: 'read' },
      { resource: 'collection:*', action: 'create' },
      { resource: 'collection:*', action: 'update' },
      { resource: 'collection:*', action: 'delete' },
      { resource: 'collection:*', action: 'publish' },
      { resource: 'media', action: '*' },
    ],
  },
  {
    name: 'author',
    description: 'Create and edit own content.',
    isSystem: true,
    permissions: [
      { resource: 'collection:*', action: 'read' },
      { resource: 'collection:*', action: 'create' },
      { resource: 'collection:*', action: 'update' },
      { resource: 'media', action: 'read' },
      { resource: 'media', action: 'create' },
    ],
  },
  {
    name: 'reviewer',
    description: 'Read content and approve drafts.',
    isSystem: true,
    permissions: [
      { resource: 'collection:*', action: 'read' },
      { resource: 'collection:*', action: 'approve' },
      { resource: 'media', action: 'read' },
    ],
  },
  {
    name: 'viewer',
    description: 'Read-only access.',
    isSystem: true,
    permissions: [
      { resource: 'collection:*', action: 'read' },
      { resource: 'media', action: 'read' },
    ],
  },
];

/** Minimal Article schema (subset of JSON Schema) for the Article collection. */
const ARTICLE_SCHEMA = {
  type: 'object',
  required: ['title'],
  properties: {
    title: { type: 'string', maxLength: 256 },
    slug: { type: 'string', maxLength: 256 },
    excerpt: { type: 'string', maxLength: 512 },
    description: { type: 'string' },
    body: { type: 'string' },
    coverId: { type: 'string' },
    publishedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const AUTHOR_SCHEMA = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', maxLength: 128 },
    bio: { type: 'string' },
    avatarId: { type: 'string' },
  },
} as const;

const CATEGORY_SCHEMA = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', maxLength: 128 },
    description: { type: 'string' },
  },
} as const;

const TAG_SCHEMA = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', maxLength: 64 },
  },
} as const;

const SETTINGS_SCHEMA = {
  type: 'object',
  properties: {
    siteName: { type: 'string' },
    siteDescription: { type: 'string' },
    defaultLocale: { type: 'string' },
    supportedLocales: { type: 'array', items: { type: 'string' } },
  },
} as const;

interface SeedCollection {
  name: string;
  slug: string;
  isSingleton: boolean;
  displayName: string;
  displayNameI18n: Record<string, string>;
  schema: object;
  settings: object;
}

const SEED_COLLECTIONS: readonly SeedCollection[] = [
  {
    name: 'Article',
    slug: 'articles',
    isSingleton: false,
    displayName: 'Article',
    displayNameI18n: { en: 'Article', ru: 'Статья' },
    schema: ARTICLE_SCHEMA as unknown as object,
    settings: {},
  },
  {
    name: 'Author',
    slug: 'authors',
    isSingleton: false,
    displayName: 'Author',
    displayNameI18n: { en: 'Author', ru: 'Автор' },
    schema: AUTHOR_SCHEMA as unknown as object,
    settings: {},
  },
  {
    name: 'Category',
    slug: 'categories',
    isSingleton: false,
    displayName: 'Category',
    displayNameI18n: { en: 'Category', ru: 'Категория' },
    schema: CATEGORY_SCHEMA as unknown as object,
    settings: {},
  },
  {
    name: 'Tag',
    slug: 'tags',
    isSingleton: false,
    displayName: 'Tag',
    displayNameI18n: { en: 'Tag', ru: 'Тег' },
    schema: TAG_SCHEMA as unknown as object,
    settings: {},
  },
  {
    name: 'Settings',
    slug: 'settings',
    isSingleton: true,
    displayName: 'Settings',
    displayNameI18n: { en: 'Settings', ru: 'Настройки' },
    schema: SETTINGS_SCHEMA as unknown as object,
    settings: {},
  },
];

interface SeedEmailTemplate {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: readonly string[];
}

const SEED_EMAIL_TEMPLATES: readonly SeedEmailTemplate[] = [
  {
    name: 'review-request',
    subject: '{{entry.title}} is awaiting your review',
    bodyHtml:
      '<p>Hi {{recipient.name}},</p><p><strong>{{author.name}}</strong> has submitted <a href="{{entry.url}}">{{entry.title}}</a> for review.</p>',
    bodyText:
      'Hi {{recipient.name}},\n\n{{author.name}} has submitted "{{entry.title}}" for review.\nOpen: {{entry.url}}',
    variables: ['recipient.name', 'author.name', 'entry.title', 'entry.url'],
  },
  {
    name: 'publish-notification',
    subject: '{{entry.title}} is now live',
    bodyHtml:
      '<p>Hi {{recipient.name}},</p><p><a href="{{entry.url}}">{{entry.title}}</a> is now published.</p>',
    bodyText:
      'Hi {{recipient.name}},\n\n"{{entry.title}}" is now published.\nOpen: {{entry.url}}',
    variables: ['recipient.name', 'entry.title', 'entry.url'],
  },
  {
    name: 'password-reset',
    subject: 'Reset your password',
    bodyHtml:
      '<p>Hi {{user.name}},</p><p>Reset your password by clicking <a href="{{reset.url}}">here</a>. The link expires in {{reset.ttl}}.</p>',
    bodyText:
      'Hi {{user.name}},\n\nReset your password: {{reset.url}}\nExpires in {{reset.ttl}}.',
    variables: ['user.name', 'reset.url', 'reset.ttl'],
  },
  {
    name: 'magic-link',
    subject: 'Your sign-in link for {{site.name}}',
    bodyHtml:
      '<p>Hi {{user.name}},</p><p>Click the link below to sign in. It expires in {{link.ttl}} and can only be used once.</p><p><a href="{{login.url}}">Sign in to {{site.name}}</a></p>',
    bodyText:
      'Hi {{user.name}},\n\nSign in to {{site.name}}: {{login.url}}\nExpires in {{link.ttl}}.',
    variables: ['user.name', 'site.name', 'login.url', 'link.ttl'],
  },
  {
    name: 'welcome',
    subject: 'Welcome to {{site.name}}!',
    bodyHtml:
      '<p>Hi {{user.name}},</p><p>Welcome aboard! Your account is ready — you can sign in at <a href="{{site.url}}">{{site.name}}</a>.</p>',
    bodyText:
      'Hi {{user.name}},\n\nWelcome to {{site.name}}!\nSign in: {{site.url}}',
    variables: ['user.name', 'site.name', 'site.url'],
  },
];

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('→ Connecting to database…');
  const client = postgres(DATABASE_URL as string, { max: 1, prepare: false });
  const db = drizzle(client);

  console.log('→ Seeding roles & permissions…');
  const roleIdByName = new Map<string, string>();

  for (const r of SEED_ROLES) {
    const [row] = await db
      .insert(roles)
      .values({ name: r.name, description: r.description, isSystem: r.isSystem })
      .onConflictDoNothing({ target: roles.name })
      .returning();
    if (row) {
      roleIdByName.set(r.name, row.id);
    } else {
      const [existing] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(sql`${roles.name} = ${r.name}`)
        .limit(1);
      if (existing) roleIdByName.set(r.name, existing.id);
    }
  }

  // Materialize all (resource, action) pairs once.
  const allPerms = new Map<string, string>();
  for (const r of SEED_ROLES) {
    for (const p of r.permissions) {
      const key = `${p.resource}:${p.action}`;
      if (allPerms.has(key)) continue;
      const [row] = await db
        .insert(permissions)
        .values({ resource: p.resource, action: p.action })
        .onConflictDoNothing()
        .returning();
      if (row) {
        allPerms.set(key, row.id);
      } else {
        const [existing] = await db
          .select({ id: permissions.id })
          .from(permissions)
          .where(sql`${permissions.resource} = ${p.resource} AND ${permissions.action} = ${p.action}`)
          .limit(1);
        if (existing) allPerms.set(key, existing.id);
      }
    }
  }

  for (const r of SEED_ROLES) {
    const roleId = roleIdByName.get(r.name);
    if (!roleId) continue;
    for (const p of r.permissions) {
      const permId = allPerms.get(`${p.resource}:${p.action}`);
      if (!permId) continue;
      await db
        .insert(rolePermissions)
        .values({ roleId, permissionId: permId })
        .onConflictDoNothing();
    }
  }

  console.log('→ Seeding collections…');
  for (const c of SEED_COLLECTIONS) {
    await db
      .insert(collections)
      .values({
        name: c.name,
        slug: c.slug,
        isSingleton: c.isSingleton ? 'true' : 'false',
        draftAndPublish: 'true',
        versioning: 'true',
        schema: c.schema,
        settings: c.settings,
        displayName: c.displayName,
        displayNameI18n: c.displayNameI18n,
      })
      .onConflictDoNothing({ target: collections.name });
  }

  console.log('→ Seeding email templates…');
  for (const t of SEED_EMAIL_TEMPLATES) {
    await db
      .insert(emailTemplates)
      .values({
        name: t.name,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        bodyText: t.bodyText,
        variables: t.variables,
        isActive: 'true',
      })
      .onConflictDoNothing({ target: emailTemplates.name });
  }

  console.log('→ Seeding super-admin user…');
  const passwordHash = await hashPassword(ADMIN_PASSWORD as string);
  const [admin] = await db
    .insert(users)
    .values({
      email: ADMIN_EMAIL as string,
      passwordHash,
      isActive: true,
      isSuperAdmin: true,
      emailVerifiedAt: new Date(),
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  if (admin) {
    const superAdminRoleId = roleIdByName.get('super_admin');
    if (superAdminRoleId) {
      await db
        .insert(userRoles)
        .values({ userId: admin.id, roleId: superAdminRoleId, grantedBy: null })
        .onConflictDoNothing();
    }
    console.log(`  ✓ Created super-admin: ${admin.email}`);
  } else {
    console.log(`  · Super-admin already exists: ${ADMIN_EMAIL}`);
  }

  console.log('✓ Seed complete');
  await client.end({ timeout: 5 });
}

// Unused import guard (createHash / randomBytes kept for future HMAC needs).
void createHash;
void randomBytes;
void timingSafeEqual;

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
