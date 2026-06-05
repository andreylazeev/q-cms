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
    const collection: Collection = {
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
    };
    store.collections.set(collection.id, collection);
  }
}
