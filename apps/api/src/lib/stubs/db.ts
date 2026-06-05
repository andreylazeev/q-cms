/**
 * Temporary local stub for `@q-cms/db`.
 *
 * Provides the in-memory repository abstractions that the API uses
 * during development and tests. The real package is being built in
 * parallel by another agent — once it lands, the API should swap the
 * imports back to `@q-cms/db` and remove this module.
 *
 * The repository pattern here intentionally mirrors what we expect
 * the Drizzle-backed implementation to expose, so call sites do not
 * need to change when we cut over.
 *
 * @module lib/stubs/db
 */

import {
  type AuditLogEntry,
  type Collection,
  type Entry,
  type EntryRevision,
  type Media,
  type Role,
  type Session,
  type User,
  type UserId,
  type Webhook,
  type WebhookDelivery,
  type Json,
  type PageInfo,
  type Paginated,
  type EntryStatus,
} from './core-shim.ts';

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

interface TemplateRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  locale: string;
  sections: ReadonlyArray<{
    id: string;
    type: string;
    props: Record<string, unknown>;
    children?: ReadonlyArray<{ id: string; type: string; props: Record<string, unknown> }>;
  }>;
  meta: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Store {
  users: Map<string, User>;
  sessions: Map<string, Session>;
  apiTokens: Map<string, { id: string; userId: string; tokenHash: string; prefix: string; scopes: string[]; createdAt: string; revokedAt: string | null; lastUsedAt: string | null; expiresAt: string | null; name: string }>;
  roles: Map<string, Role>;
  userRoles: Map<string, Set<string>>;
  collections: Map<string, Collection>;
  entries: Map<string, Entry>;
  entryRevisions: Map<string, EntryRevision>;
  media: Map<string, Media>;
  webhooks: Map<string, Webhook>;
  webhookDeliveries: Map<string, WebhookDelivery>;
  auditLog: Map<string, AuditLogEntry>;
  templates: Map<string, TemplateRecord>;
}

function createStore(): Store {
  return {
    users: new Map(),
    sessions: new Map(),
    apiTokens: new Map(),
    roles: new Map(),
    userRoles: new Map(),
    collections: new Map(),
    entries: new Map(),
    entryRevisions: new Map(),
    media: new Map(),
    webhooks: new Map(),
    webhookDeliveries: new Map(),
    auditLog: new Map(),
    templates: new Map(),
  };
}

const globalKey = Symbol.for('@q-cms/api/stub-db');
type GlobalWithStore = typeof globalThis & { [globalKey]?: Store };
const g = globalThis as GlobalWithStore;
if (!g[globalKey]) g[globalKey] = createStore();
const store: Store = g[globalKey] as Store;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

let counter = 0;
function genId(): string {
  counter += 1;
  const rand = Math.random().toString(16).slice(2, 14).padEnd(12, '0');
  return `${Date.now().toString(16)}${counter.toString(16).padStart(4, '0')}${rand}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function paginate<T extends { id: string }>(
  items: readonly T[],
  page: { limit: number; cursor: string | null; withTotal: boolean },
): Paginated<T> {
  const start = page.cursor ? Math.max(0, Number(Buffer.from(page.cursor, 'base64url').toString('utf8')) || 0) : 0;
  const slice = items.slice(start, start + page.limit);
  const nextStart = start + slice.length;
  const hasNext = nextStart < items.length;
  const hasPrev = start > 0;
  const pageInfo: PageInfo = {
    nextCursor: hasNext ? Buffer.from(String(nextStart)).toString('base64url') : null,
    prevCursor: hasPrev ? Buffer.from(String(Math.max(0, start - page.limit))).toString('base64url') : null,
    limit: page.limit,
    total: page.withTotal ? items.length : null,
  };
  return { data: slice, page: pageInfo };
}

// ---------------------------------------------------------------------------
// User repository
// ---------------------------------------------------------------------------

export interface UserRepo {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(page: { limit: number; cursor: string | null; withTotal: boolean }): Promise<Paginated<User>>;
  create(input: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  update(id: string, patch: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User>;
  delete(id: string): Promise<void>;
  setRoles(userId: string, roleIds: readonly string[]): Promise<void>;
  getRoles(userId: string): Promise<readonly Role[]>;
}

export const userRepo: UserRepo = {
  async findById(id) {
    return store.users.get(id) ?? null;
  },
  async findByEmail(email) {
    for (const u of store.users.values()) if (u.email === email) return u;
    return null;
  },
  async list(page) {
    return paginate([...store.users.values()], page);
  },
  async create(input) {
    const id = genId();
    const user: User = { ...input, id: id as UserId, createdAt: nowIso(), updatedAt: nowIso() };
    store.users.set(id, user);
    return user;
  },
  async update(id, patch) {
    const existing = store.users.get(id);
    if (!existing) throw new Error('User not found');
    const updated: User = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt, updatedAt: nowIso() };
    store.users.set(id, updated);
    return updated;
  },
  async delete(id) {
    store.users.delete(id);
    store.userRoles.delete(id);
  },
  async setRoles(userId, roleIds) {
    store.userRoles.set(userId, new Set(roleIds));
  },
  async getRoles(userId) {
    const ids = store.userRoles.get(userId);
    if (!ids) return [];
    return [...ids].map((id) => store.roles.get(id)).filter((r): r is Role => Boolean(r));
  },
};

// ---------------------------------------------------------------------------
// Collection repository
// ---------------------------------------------------------------------------

export interface CollectionRepo {
  list(): Promise<readonly Collection[]>;
  findBySlug(slug: string): Promise<Collection | null>;
  findById(id: string): Promise<Collection | null>;
}

export const collectionRepo: CollectionRepo = {
  async list() {
    return [...store.collections.values()];
  },
  async findBySlug(slug) {
    for (const c of store.collections.values()) if (c.slug === slug) return c;
    return null;
  },
  async findById(id) {
    return store.collections.get(id) ?? null;
  },
};

// ---------------------------------------------------------------------------
// Entry repository
// ---------------------------------------------------------------------------

export interface EntryRepo {
  list(query: {
    collectionId: string;
    status?: readonly (EntryStatus | '*')[];
    locale?: readonly string[];
    limit: number;
    cursor: string | null;
    withTotal: boolean;
  }): Promise<Paginated<Entry>>;
  findById(id: string): Promise<Entry | null>;
  findBySlug(collectionId: string, slug: string, locale: string): Promise<Entry | null>;
  create(input: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entry>;
  update(id: string, patch: Partial<Omit<Entry, 'id' | 'createdAt'>>): Promise<Entry>;
  delete(id: string): Promise<void>;
  listRevisions(entryId: string): Promise<readonly EntryRevision[]>;
  saveRevision(revision: Omit<EntryRevision, 'id' | 'createdAt'>): Promise<EntryRevision>;
}

export const entryRepo: EntryRepo = {
  async list({ collectionId, status, locale, limit, cursor, withTotal }) {
    let items = [...store.entries.values()].filter((e) => e.collectionId === collectionId);
    if (status && status.length > 0 && !(status.length === 1 && status[0] === '*')) {
      const allowed = status.filter((s): s is EntryStatus => s !== '*');
      if (allowed.length > 0) {
        items = items.filter((e) => allowed.includes(e.status));
      }
    }
    if (locale && locale.length > 0) {
      items = items.filter((e) => locale.includes(e.locale));
    }
    return paginate(items, { limit, cursor, withTotal });
  },
  async findById(id) {
    return store.entries.get(id) ?? null;
  },
  async findBySlug(collectionId, slug, locale) {
    for (const e of store.entries.values()) {
      if (e.collectionId === collectionId && e.locale === locale && e.slug === slug) return e;
    }
    return null;
  },
  async create(input) {
    const id = genId();
    const entry: Entry = { ...input, id: id as Entry['id'], createdAt: nowIso(), updatedAt: nowIso() };
    store.entries.set(id, entry);
    return entry;
  },
  async update(id, patch) {
    const existing = store.entries.get(id);
    if (!existing) throw new Error('Entry not found');
    const updated: Entry = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt, updatedAt: nowIso() };
    store.entries.set(id, updated);
    return updated;
  },
  async delete(id) {
    store.entries.delete(id);
  },
  async listRevisions(entryId) {
    return [...store.entryRevisions.values()].filter((r) => r.entryId === entryId);
  },
  async saveRevision(rev) {
    const id = genId();
    const created: EntryRevision = { ...rev, id, createdAt: nowIso() };
    store.entryRevisions.set(id, created);
    return created;
  },
};

// ---------------------------------------------------------------------------
// Singleton repository (treats a singleton as an entry with no slug uniqueness)
// ---------------------------------------------------------------------------

export interface SingletonRepo {
  find(collectionId: string, locale: string): Promise<Entry | null>;
  upsert(entry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Entry>;
}

export const singletonRepo: SingletonRepo = {
  async find(collectionId, locale) {
    for (const e of store.entries.values()) {
      if (e.collectionId === collectionId && e.locale === locale) return e;
    }
    return null;
  },
  async upsert(input) {
    const existing = await singletonRepo.find(input.collectionId, input.locale);
    if (existing) return entryRepo.update(existing.id, input);
    return entryRepo.create(input);
  },
};

// ---------------------------------------------------------------------------
// Media repository
// ---------------------------------------------------------------------------

export interface MediaRepo {
  list(page: { limit: number; cursor: string | null; withTotal: boolean }): Promise<Paginated<Media>>;
  findById(id: string): Promise<Media | null>;
  create(input: Omit<Media, 'id' | 'createdAt' | 'updatedAt'>): Promise<Media>;
  update(id: string, patch: Partial<Omit<Media, 'id' | 'createdAt'>>): Promise<Media>;
  delete(id: string): Promise<void>;
}

export const mediaRepo: MediaRepo = {
  async list(page) {
    return paginate([...store.media.values()], page);
  },
  async findById(id) {
    return store.media.get(id) ?? null;
  },
  async create(input) {
    const id = genId();
    const media: Media = { ...input, id: id as Media['id'], createdAt: nowIso(), updatedAt: nowIso() };
    store.media.set(id, media);
    return media;
  },
  async update(id, patch) {
    const existing = store.media.get(id);
    if (!existing) throw new Error('Media not found');
    const updated: Media = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt, updatedAt: nowIso() };
    store.media.set(id, updated);
    return updated;
  },
  async delete(id) {
    store.media.delete(id);
  },
};

// ---------------------------------------------------------------------------
// Webhook repository
// ---------------------------------------------------------------------------

export interface WebhookRepo {
  list(page: { limit: number; cursor: string | null; withTotal: boolean }): Promise<Paginated<Webhook>>;
  findById(id: string): Promise<Webhook | null>;
  create(input: Omit<Webhook, 'id' | 'createdAt'>): Promise<Webhook>;
  update(id: string, patch: Partial<Omit<Webhook, 'id' | 'createdAt'>>): Promise<Webhook>;
  delete(id: string): Promise<void>;
  listDeliveries(webhookId: string): Promise<readonly WebhookDelivery[]>;
  recordDelivery(delivery: Omit<WebhookDelivery, 'id'>): Promise<WebhookDelivery>;
  findDelivery(id: string): Promise<WebhookDelivery | null>;
}

export const webhookRepo: WebhookRepo = {
  async list(page) {
    return paginate([...store.webhooks.values()], page);
  },
  async findById(id) {
    return store.webhooks.get(id) ?? null;
  },
  async create(input) {
    const id = genId();
    const wh: Webhook = { ...input, id, createdAt: nowIso() };
    store.webhooks.set(id, wh);
    return wh;
  },
  async update(id, patch) {
    const existing = store.webhooks.get(id);
    if (!existing) throw new Error('Webhook not found');
    const updated: Webhook = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt };
    store.webhooks.set(id, updated);
    return updated;
  },
  async delete(id) {
    store.webhooks.delete(id);
  },
  async listDeliveries(webhookId) {
    return [...store.webhookDeliveries.values()].filter((d) => d.webhookId === webhookId);
  },
  async recordDelivery(delivery) {
    const id = genId();
    const d: WebhookDelivery = { ...delivery, id };
    store.webhookDeliveries.set(id, d);
    return d;
  },
  async findDelivery(id) {
    return store.webhookDeliveries.get(id) ?? null;
  },
};

// ---------------------------------------------------------------------------
// Audit repository
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
  record(entry: Omit<AuditLogEntry, 'id' | 'occurredAt'>): Promise<AuditLogEntry>;
}

export const auditRepo: AuditRepo = {
  async list({ actorId, action, resourceType, limit, cursor, withTotal }) {
    let items = [...store.auditLog.values()];
    if (actorId) items = items.filter((a) => a.actorId === actorId);
    if (action) items = items.filter((a) => a.action === action);
    if (resourceType) items = items.filter((a) => a.resourceType === resourceType);
    return paginate(items, { limit, cursor, withTotal });
  },
  async record(entry) {
    const id = genId();
    const e: AuditLogEntry = { ...entry, id, occurredAt: nowIso() };
    store.auditLog.set(id, e);
    return e;
  },
};

// ---------------------------------------------------------------------------
// Role repository
// ---------------------------------------------------------------------------

export interface RoleRepo {
  list(): Promise<readonly Role[]>;
  findById(id: string): Promise<Role | null>;
  create(input: Omit<Role, 'id' | 'createdAt'>): Promise<Role>;
  update(id: string, patch: Partial<Omit<Role, 'id' | 'createdAt'>>): Promise<Role>;
  /** Throws on system roles. */
  delete(id: string): Promise<void>;
}

export const roleRepo: RoleRepo = {
  async list() {
    return [...store.roles.values()];
  },
  async findById(id) {
    return store.roles.get(id) ?? null;
  },
  async create(input) {
    const id = genId();
    const role: Role = { ...input, id: id as Role['id'], createdAt: nowIso() };
    store.roles.set(id, role);
    return role;
  },
  async update(id, patch) {
    const existing = store.roles.get(id);
    if (!existing) throw new Error('Role not found');
    const updated: Role = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt };
    store.roles.set(id, updated);
    return updated;
  },
  async delete(id) {
    const role = store.roles.get(id);
    if (!role) throw new Error('Role not found');
    if (role.isSystem) throw new Error('Cannot delete system role');
    store.roles.delete(id);
  },
};

// ---------------------------------------------------------------------------
// Session repository
// ---------------------------------------------------------------------------

export interface SessionRepo {
  create(session: Omit<Session, 'id' | 'createdAt'>): Promise<Session>;
  findByTokenHash(hash: string): Promise<Session | null>;
  revoke(id: string): Promise<void>;
}

export const sessionRepo: SessionRepo = {
  async create(s) {
    const id = genId();
    const session: Session = { ...s, id: id as Session['id'], createdAt: nowIso() };
    store.sessions.set(id, session);
    return session;
  },
  async findByTokenHash(hash) {
    for (const s of store.sessions.values()) if (s.tokenHash === hash) return s;
    return null;
  },
  async revoke(id) {
    const s = store.sessions.get(id);
    if (s) store.sessions.set(id, { ...s, revokedAt: nowIso() });
  },
};

// ---------------------------------------------------------------------------
// Template repository
// ---------------------------------------------------------------------------

export interface TemplateRepo {
  list(): Promise<readonly TemplateRecord[]>;
  findById(id: string): Promise<TemplateRecord | null>;
  findBySlug(slug: string): Promise<TemplateRecord | null>;
  create(input: Omit<TemplateRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<TemplateRecord>;
  update(id: string, patch: Partial<Omit<TemplateRecord, 'id' | 'createdAt'>>): Promise<TemplateRecord>;
  delete(id: string): Promise<void>;
}

export const templateRepo: TemplateRepo = {
  async list() {
    return [...store.templates.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  },
  async findById(id) {
    return store.templates.get(id) ?? null;
  },
  async findBySlug(slug) {
    for (const t of store.templates.values()) if (t.slug === slug) return t;
    return null;
  },
  async create(input) {
    const id = genId();
    const record: TemplateRecord = {
      ...input,
      id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.templates.set(id, record);
    return record;
  },
  async update(id, patch) {
    const existing = store.templates.get(id);
    if (!existing) throw new Error('Template not found');
    const updated: TemplateRecord = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    };
    store.templates.set(id, updated);
    return updated;
  },
  async delete(id) {
    store.templates.delete(id);
  },
};

// ---------------------------------------------------------------------------
// Health probes
// ---------------------------------------------------------------------------

export interface HealthChecks {
  postgres(): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }>;
  redis(): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }>;
  meilisearch(): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }>;
}

/** Stub probes — real implementation will ping actual services. */
export const healthChecks: HealthChecks = {
  async postgres() {
    return { ok: true, latencyMs: 1 };
  },
  async redis() {
    return { ok: true, latencyMs: 1 };
  },
  async meilisearch() {
    return { ok: true, latencyMs: 1 };
  },
};

// ---------------------------------------------------------------------------
// Seed (development only)
// ---------------------------------------------------------------------------

let seeded = false;

/**
 * Insert a minimal set of system roles + collections on first call.
 * Idempotent — safe to invoke at module init time.
 */
export async function seedIfEmpty(): Promise<void> {
  if (seeded) return;
  seeded = true;
  if (store.roles.size === 0) {
    const systemRoles: Role[] = ['super-admin', 'admin', 'editor', 'author', 'reviewer', 'viewer'].map((name) => ({
      id: name as Role['id'],
      name,
      description: `System role: ${name}`,
      isSystem: true,
      createdAt: nowIso(),
    }));
    for (const r of systemRoles) store.roles.set(r.id, r);
  }
  if (store.collections.size === 0) {
    const collections: Collection[] = [
      {
        id: 'articles' as Collection['id'],
        name: 'Article',
        slug: 'articles',
        isSingleton: false,
        draftAndPublish: true,
        versioning: true,
        schema: { type: 'object' } as Json,
        settings: {},
        displayName: 'Articles',
        displayNameI18n: {},
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: 'authors' as Collection['id'],
        name: 'Author',
        slug: 'authors',
        isSingleton: false,
        draftAndPublish: false,
        versioning: false,
        schema: { type: 'object' } as Json,
        settings: {},
        displayName: 'Authors',
        displayNameI18n: {},
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: 'categories' as Collection['id'],
        name: 'Category',
        slug: 'categories',
        isSingleton: false,
        draftAndPublish: false,
        versioning: false,
        schema: { type: 'object' } as Json,
        settings: {},
        displayName: 'Categories',
        displayNameI18n: {},
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: 'site' as Collection['id'],
        name: 'Site',
        slug: 'site',
        isSingleton: true,
        draftAndPublish: false,
        versioning: false,
        schema: { type: 'object' } as Json,
        settings: {},
        displayName: 'Site Settings',
        displayNameI18n: {},
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ];
    for (const c of collections) store.collections.set(c.id, c);
  }

  if (store.users.size === 0) {
    // Pre-hashed PBKDF2 of `changeme` (matches the auth stub's hash format).
    // Generated at seed-time so verifyPassword() round-trips correctly.
    const passwordHash = await hashPasswordDevOnly('changeme');
    const users: User[] = [
      {
        id: 'u_admin' as User['id'],
        email: 'admin@q-cms.local',
        username: 'admin',
        firstName: 'Anya',
        lastName: 'Lazareva',
        passwordHash,
        isActive: true,
        isSuperAdmin: true,
        totpEnabled: false,
        totpSecret: null,
        lastLoginAt: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: 'u_editor' as User['id'],
        email: 'editor@q-cms.local',
        username: 'editor',
        firstName: 'Mark',
        lastName: 'Chen',
        passwordHash,
        isActive: true,
        isSuperAdmin: false,
        totpEnabled: false,
        totpSecret: null,
        lastLoginAt: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: 'u_author' as User['id'],
        email: 'author@q-cms.local',
        username: 'author',
        firstName: 'Sofia',
        lastName: 'Volkova',
        passwordHash,
        isActive: true,
        isSuperAdmin: false,
        totpEnabled: false,
        totpSecret: null,
        lastLoginAt: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ];
    for (const u of users) store.users.set(u.id, u);
    store.userRoles.set('u_admin', new Set(['super-admin']));
    store.userRoles.set('u_editor', new Set(['editor']));
    store.userRoles.set('u_author', new Set(['author']));
  }

  if (store.media.size === 0) {
    const mediaItems: Media[] = [
      makeMedia('m_hero', 'hero-mountain.jpg', 'image/jpeg', 482_113, 1920, 1080, '#7c8d9e', 'published'),
      makeMedia('m_cover1', 'aurora-borealis.jpg', 'image/jpeg', 612_940, 1920, 1280, '#1e3a8a', 'published'),
      makeMedia('m_cover2', 'forest-trail.jpg', 'image/jpeg', 528_004, 1920, 1280, '#2d5a2d', 'published'),
      makeMedia('m_cover3', 'desert-dunes.jpg', 'image/jpeg', 397_821, 1920, 1280, '#c2956b', 'published'),
      makeMedia('m_cover4', 'city-night.jpg', 'image/jpeg', 445_670, 1920, 1280, '#1f1f3a', 'published'),
      makeMedia('m_avatar1', 'avatar-sofia.png', 'image/png', 24_512, 256, 256, '#d4a574', 'published'),
      makeMedia('m_avatar2', 'avatar-mark.png', 'image/png', 28_104, 256, 256, '#7a9d96', 'published'),
      makeMedia('m_avatar3', 'avatar-anya.png', 'image/png', 22_870, 256, 256, '#b07a7a', 'published'),
    ];
    for (const m of mediaItems) store.media.set(m.id, m);
  }

  if (store.entries.size === 0) {
    const articles: Entry[] = [
      makeEntry('e_intro', 'articles', 'Welcome to Q-CMS', 'welcome-to-q-cms', 'published', {
        title: 'Welcome to Q-CMS',
        slug: 'welcome-to-q-cms',
        excerpt: 'A block-first, API-first headless CMS — designed for teams that move fast.',
        body: 'Q-CMS is a next-generation headless CMS with an integrated admin panel and block-based editor. Built for speed, flexibility, and predictable performance on the edge.\n\n## Why Q-CMS?\n\nMost headless CMSes force you to choose between a great editor experience and a great API. We refuse the trade-off. The admin app and the public API are first-class citizens of the same codebase, sharing types end-to-end.\n\n## What is in the v0.1 Seed\n\n- A full RBAC model with 6 system roles and 24 default permissions\n- Three demo content types: Articles, Authors, Categories\n- The complete admin shell: dashboard, collections, media, users, settings\n- A documented REST + OpenAPI surface for every collection\n- A real Postgres-backed data layer with migrations and seed data',
        coverId: 'm_hero',
        authorId: 'u_admin',
        publishedAt: '2026-06-01T10:00:00.000Z',
      }),
      makeEntry('e_changelog', 'articles', 'v0.1 Seed — what is included', 'v0-1-seed', 'published', {
        title: 'v0.1 Seed — what is included',
        slug: 'v0-1-seed',
        excerpt: 'Roles, permissions, collections, the admin shell, and the API contract — all wired up and ready to extend.',
        body: 'The first public seed of Q-CMS. Read on for the highlights of what is in scope and what is coming next.\n\n## Scope\n\nEverything you need to ship a content site: collections, entries, media, users, roles, webhooks, search. Everything you need to operate it: migrations, seed, observability, metrics.\n\n## Out of scope (for v0.2)\n\nReal-time collaboration, GraphQL gateway, and the multi-tenant control plane. All three are scoped and on the roadmap — see the engineering blog for details.',
        coverId: 'm_cover1',
        authorId: 'u_editor',
        publishedAt: '2026-06-02T14:30:00.000Z',
      }),
      makeEntry('e_arch', 'articles', 'Architecture in one diagram', 'architecture', 'published', {
        title: 'Architecture in one diagram',
        slug: 'architecture',
        excerpt: 'Hono at the edge, Next.js for admin, BullMQ for jobs, Postgres for truth.',
        body: 'A guided tour through the runtime topology: API, admin, workers, realtime, and the storage layer.\n\n## The runtime\n\nThe API ships as a single Hono bundle that runs anywhere Node or Bun runs. The admin is a Next.js 15 app with RSC and Server Actions. Background work goes through BullMQ on Redis. Realtime collaboration uses Hocuspocus. The source of truth is Postgres 17.\n\n## The contracts\n\nThe same OpenAPI document powers the admin SDK, the public API client, and the third-party documentation. Drift between the schema and the implementation is caught at build time.',
        coverId: 'm_cover2',
        authorId: 'u_author',
        publishedAt: '2026-06-03T09:15:00.000Z',
      }),
      makeEntry('e_blocks', 'articles', 'Block-first authoring', 'block-first', 'in_review', {
        title: 'Block-first authoring',
        slug: 'block-first',
        excerpt: 'Why we built the editor around blocks — and what it lets content teams ship without waiting on engineering.',
        body: 'Blocks trade rigid templates for composable primitives. Here is what that buys you.',
        coverId: 'm_cover3',
        authorId: 'u_author',
        publishedAt: null,
      }),
      makeEntry('e_draft', 'articles', 'Edge cache primer', 'edge-cache-primer', 'draft', {
        title: 'Edge cache primer',
        slug: 'edge-cache-primer',
        excerpt: 'Cache strategies for public content. Stale-while-revalidate, tag invalidation, and the trade-offs.',
        body: 'In progress. Drafted in the open.',
        coverId: 'm_cover5',
        authorId: 'u_editor',
        publishedAt: null,
      }),
      makeEntry('e_archived', 'articles', 'Deprecated: API tokens legacy', 'api-tokens-legacy', 'archived', {
        title: 'Deprecated: API tokens legacy',
        slug: 'api-tokens-legacy',
        excerpt: 'The old qcs_legacy_ prefix is no longer accepted. Migrate to the new format.',
        body: 'Historical context for the migration.',
        coverId: null,
        authorId: 'u_admin',
        publishedAt: '2026-04-12T08:00:00.000Z',
      }),
      makeEntry('e_roadmap', 'articles', 'Roadmap: H2 2026', 'roadmap-h2-2026', 'published', {
        title: 'Roadmap: H2 2026',
        slug: 'roadmap-h2-2026',
        excerpt: 'Webhooks v2, real-time collaboration, and the public GraphQL gateway.',
        body: 'Our plans for the second half of 2026.\n\n## Now (June)\n\n- Block-based editor GA\n- Webhooks v1 (retries, signing, dead-letter)\n- Public read API + reference consumers\n\n## Next (July–September)\n\n- Real-time collaboration via Y.js + Hocuspocus\n- Public GraphQL gateway\n- Multi-tenant control plane',
        coverId: 'm_cover4',
        authorId: 'u_admin',
        publishedAt: '2026-05-22T11:00:00.000Z',
      }),
      makeEntry('e_authors', 'authors', 'Sofia Volkova', 'sofia-volkova', 'published', {
        name: 'Sofia Volkova',
        bio: 'Field journalist turned technical writer. Currently documenting the architecture track at Q-CMS.',
        avatarId: 'm_avatar1',
      }),
      makeEntry('e_authors2', 'authors', 'Mark Chen', 'mark-chen', 'published', {
        name: 'Mark Chen',
        bio: 'Editor-in-chief. Edits everything that ships to docs.q-cms.dev.',
        avatarId: 'm_avatar2',
      }),
      makeEntry('e_authors3', 'authors', 'Anya Lazareva', 'anya-lazareva', 'published', {
        name: 'Anya Lazareva',
        bio: 'Product lead. Owns the editor roadmap and ships in the admin app every Friday.',
        avatarId: 'm_avatar3',
      }),
      makeEntry('e_cat_eng', 'categories', 'Engineering', 'engineering', 'published', {
        name: 'Engineering',
        description: 'Deep dives into runtime, schema, and infrastructure.',
      }),
      makeEntry('e_cat_prod', 'categories', 'Product', 'product', 'published', {
        name: 'Product',
        description: 'Roadmap, release notes, and how we work.',
      }),
      makeEntry('e_cat_company', 'categories', 'Company', 'company', 'published', {
        name: 'Company',
        description: 'Hiring, mission, and the people behind Q-CMS.',
      }),
      // Singleton — site settings, used by the public site.
      makeEntry('e_site', 'site', 'Site settings', 'site', 'published', {
        siteName: 'Q-CMS Field Notes',
        siteDescription: 'A field journal from the team building the next-generation headless CMS.',
        defaultLocale: 'en',
        supportedLocales: ['en', 'ru', 'de'],
      }),
    ];
    for (const e of articles) store.entries.set(e.id, e);
  }

  if (store.templates.size === 0) {
    const templates: TemplateRecord[] = [
      makeTemplate(
        'tpl_home',
        'home-default',
        'Home default',
        'Landing page: hero + feature grid + article grid + category list + CTA.',
        [
          {
            id: 'sec_hero',
            type: 'hero',
            props: {
              eyebrow: 'Welcome',
              headline: 'Building the next-generation headless CMS',
              description: 'Engineering, product, and process notes from the team behind Q-CMS.',
              ctaLabel: 'Browse articles',
              ctaHref: '/articles/',
              imageId: 'm_hero',
              align: 'left',
            },
          },
          {
            id: 'sec_features',
            type: 'featureGrid',
            props: {
              title: 'Why Q-CMS',
              columns: 3,
              items: [
                { icon: 'zap', title: 'Fast', body: 'Edge-native runtime.' },
                { icon: 'shield', title: 'Safe', body: 'Type-safe contracts end-to-end.' },
                { icon: 'globe', title: 'Global', body: 'Localized out of the box.' },
              ],
            },
          },
          {
            id: 'sec_latest',
            type: 'articleGrid',
            props: {
              title: 'Latest articles',
              limit: 6,
              showCover: true,
              showExcerpt: true,
              showMeta: true,
            },
          },
          {
            id: 'sec_categories',
            type: 'categoryList',
            props: { title: 'Browse by topic' },
          },
          {
            id: 'sec_cta',
            type: 'callToAction',
            props: {
              headline: 'Want to follow along?',
              description: 'Read the architecture notes, changelog, and roadmap.',
              buttonLabel: 'Read the changelog',
              buttonHref: '/articles/v0-1-seed/',
              variant: 'primary',
            },
          },
        ],
      ),
      makeTemplate(
        'tpl_article',
        'article-default',
        'Article default',
        'Article page: rich-text body + author bio + related article grid.',
        [
          {
            id: 'sec_article_richtext',
            type: 'richText',
            props: {
              body: '## Body\n\nArticle body is rendered by the entry data binding.',
            },
          },
          {
            id: 'sec_article_author',
            type: 'authorBio',
            props: { authorSlug: 'sofia-volkova' },
          },
          {
            id: 'sec_article_related',
            type: 'articleGrid',
            props: {
              title: 'Related',
              limit: 3,
              showCover: true,
              showExcerpt: false,
              showMeta: true,
            },
          },
        ],
      ),
    ];
    for (const t of templates) store.templates.set(t.id, t);
  }
}

// ---------------------------------------------------------------------------
// Dev-only helpers (seed)
// ---------------------------------------------------------------------------

/** PBKDF2 hash that matches the format the auth stub verifies. */
async function hashPasswordDevOnly(plain: string): Promise<string> {
  const salt = Buffer.from('devseed0000000000', 'utf8');
  const { pbkdf2 } = await import('node:crypto');
  const derived = await new Promise<Buffer>((resolve, reject) => {
    pbkdf2(plain, salt, 210_000, 32, 'sha256', (err, key) => {
      if (err) reject(err);
      else if (key) resolve(key);
      else reject(new Error('pbkdf2 returned no key'));
    });
  });
  return `pbkdf2$210000$${salt.toString('base64')}$${derived.toString('base64')}`;
}

function makeMedia(
  id: string,
  filename: string,
  mimeType: string,
  size: number,
  width: number,
  height: number,
  color: string,
  status: 'draft' | 'published' = 'published',
): Media {
  return {
    id: id as Media['id'],
    filename,
    mimeType,
    sizeBytes: size,
    width,
    height,
    alt: filename.replace(/\.[^.]+$/, '').replace(/-/g, ' '),
    caption: null,
    folderId: null,
    storageKey: `media/${id}/${filename}`,
    checksumSha256: id.padEnd(64, '0'),
    status,
    createdBy: 'u_admin' as Media['createdBy'],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  } as Media;
}

function makeEntry(
  id: string,
  collectionSlug: string,
  title: string,
  slug: string,
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'archived',
  data: Record<string, unknown>,
): Entry {
  const publishedAt =
    status === 'published'
      ? new Date(Date.now() - Math.floor(Math.random() * 5_184_000_000)).toISOString()
      : null;
  return {
    id: id as Entry['id'],
    collectionId: collectionSlug as Entry['collectionId'],
    slug,
    status,
    locale: 'en',
    data: data as Entry['data'],
    version: 1,
    publishedAt,
    createdBy: 'u_admin' as Entry['createdBy'],
    updatedBy: 'u_admin' as Entry['updatedBy'],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Page-template seed (home + article defaults)
// ---------------------------------------------------------------------------

function makeTemplate(
  id: string,
  slug: string,
  name: string,
  description: string,
  sections: TemplateRecord['sections'],
): TemplateRecord {
  return {
    id,
    slug,
    name,
    description,
    locale: 'en',
    sections,
    meta: {},
    createdBy: 'u_admin',
    createdAt: '2026-06-05T11:00:00.000Z',
    updatedAt: '2026-06-05T11:00:00.000Z',
  };
}
