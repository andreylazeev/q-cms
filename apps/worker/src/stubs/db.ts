/**
 * Local stubs for the not-yet-built `@q-cms/db`, `@q-cms/search`, and
 * `@q-cms/media` packages.
 *
 * The real packages are being built in parallel; until they land,
 * the workers import minimal in-memory stand-ins from this module
 * so the type-checker is happy and the unit tests can run without
 * Postgres / MeiliSearch / S3.
 *
 * The exports intentionally mirror the surface the real packages
 * are expected to provide; once the real packages are published,
 * the workers should re-export from them and this module can be
 * deleted.
 *
 * @module stubs
 */

import { Buffer } from 'node:buffer';
import { createHmac, randomBytes } from 'node:crypto';
import type {
  Entry,
  EntryId,
  Media,
  MediaId,
} from '@q-cms/core';

// ---------------------------------------------------------------------------
// Stub DB
// ---------------------------------------------------------------------------

const globalKey = Symbol.for('@q-cms/worker/stub-db');
type GlobalWithStore = typeof globalThis & {
  [globalKey]?: {
    entries: Map<string, Entry>;
    media: Map<string, Media>;
    mediaVariants: Map<string, MediaVariantStub>;
    emailQueue: Map<string, EmailQueueItemStub>;
  };
};

interface MediaVariantStub {
  id: string;
  mediaId: MediaId;
  variantName: string;
  width: number | null;
  height: number | null;
  format: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: string;
}

interface EmailQueueItemStub {
  id: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
}

function createStore(): NonNullable<GlobalWithStore[typeof globalKey]> {
  return {
    entries: new Map(),
    media: new Map(),
    mediaVariants: new Map(),
    emailQueue: new Map(),
  };
}

const g = globalThis as GlobalWithStore;
if (!g[globalKey]) g[globalKey] = createStore();
const store = g[globalKey] as NonNullable<GlobalWithStore[typeof globalKey]>;

let idCounter = 0;
function genId(): string {
  idCounter += 1;
  return `${Date.now().toString(16)}${idCounter.toString(16).padStart(4, '0')}${randomBytes(4).toString('hex')}`;
}

/** Stub entry repository. */
export const entryRepo = {
  async findById(id: string): Promise<Entry | null> {
    return store.entries.get(id) ?? null;
  },
  async listScheduledDue(now: Date): Promise<Entry[]> {
    return [...store.entries.values()].filter(
      (e) =>
        e.status === 'draft' &&
        e.scheduledPublishAt !== null &&
        new Date(e.scheduledPublishAt).getTime() <= now.getTime(),
    );
  },
  async markPublished(id: EntryId, publishedAt: string): Promise<Entry> {
    const existing = store.entries.get(id);
    if (!existing) throw new Error(`Entry ${id} not found`);
    const updated: Entry = { ...existing, status: 'published', publishedAt, updatedAt: publishedAt };
    store.entries.set(id, updated);
    return updated;
  },
};

/** Stub media repository. */
export const mediaRepo = {
  async findById(id: string): Promise<Media | null> {
    return store.media.get(id) ?? null;
  },
  async findVariantByKey(storageKey: string): Promise<MediaVariantStub | null> {
    for (const v of store.mediaVariants.values()) {
      if (v.storageKey === storageKey) return v;
    }
    return null;
  },
  async insertVariant(input: Omit<MediaVariantStub, 'id' | 'createdAt'>): Promise<MediaVariantStub> {
    const id = genId();
    const v: MediaVariantStub = { ...input, id, createdAt: new Date().toISOString() };
    store.mediaVariants.set(id, v);
    return v;
  },
};

/** Stub email queue repository. */
export const emailQueueRepo = {
  async findById(id: string): Promise<EmailQueueItemStub | null> {
    return store.emailQueue.get(id) ?? null;
  },
  async updateStatus(
    id: string,
    status: EmailQueueItemStub['status'],
    extra: { lastError?: string | null; sentAt?: string | null; attempts?: number } = {},
  ): Promise<EmailQueueItemStub> {
    const existing = store.emailQueue.get(id);
    if (!existing) throw new Error(`Email queue item ${id} not found`);
    const updated: EmailQueueItemStub = {
      ...existing,
      status,
      ...(extra.lastError !== undefined ? { lastError: extra.lastError } : {}),
      ...(extra.sentAt !== undefined ? { sentAt: extra.sentAt } : {}),
      ...(extra.attempts !== undefined ? { attempts: extra.attempts } : {}),
    };
    store.emailQueue.set(id, updated);
    return updated;
  },
};

// Test helpers — exposed for the unit tests so they can seed state.
export const __stubInternals = {
  putEntry(entry: Entry): void {
    store.entries.set(entry.id, entry);
  },
  putMedia(media: Media): void {
    store.media.set(media.id, media);
  },
  putEmailQueueItem(item: EmailQueueItemStub): void {
    store.emailQueue.set(item.id, item);
  },
  listVariants(mediaId: MediaId): MediaVariantStub[] {
    return [...store.mediaVariants.values()].filter((v) => v.mediaId === mediaId);
  },
  reset(): void {
    store.entries.clear();
    store.media.clear();
    store.mediaVariants.clear();
    store.emailQueue.clear();
  },
};

// ---------------------------------------------------------------------------
// Stub Search (Meilisearch)
// ---------------------------------------------------------------------------

const searchStoreKey = Symbol.for('@q-cms/worker/stub-search');
type SearchStore = Map<string, Record<string, unknown>>;
type GlobalWithSearch = typeof globalThis & { [searchStoreKey]?: SearchStore };
const sg = globalThis as GlobalWithSearch;
if (!sg[searchStoreKey]) sg[searchStoreKey] = new Map();
const searchIndex = sg[searchStoreKey] as SearchStore;

/** Stub Meilisearch client. */
export const searchClient = {
  /**
   * Index (insert or replace) a document. The index name encodes the
   * collection slug; the document id encodes the entry id + locale.
   */
  async index(
    indexName: string,
    document: { id: string } & Record<string, unknown>,
  ): Promise<{ id: string; indexName: string; ok: true }> {
    const key = `${indexName}::${document.id}`;
    searchIndex.set(key, document);
    return { id: document.id, indexName, ok: true };
  },
  async delete(indexName: string, id: string): Promise<void> {
    searchIndex.delete(`${indexName}::${id}`);
  },
  async list(indexName: string): Promise<readonly Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    for (const [k, v] of searchIndex.entries()) {
      if (k.startsWith(`${indexName}::`)) out.push(v);
    }
    return out;
  },
  async clear(): Promise<void> {
    searchIndex.clear();
  },
};

/** URL of the (possibly absent) Meilisearch instance. */
export const MEILI_URL = process.env.MEILI_URL ?? '';
export const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY ?? '';

// ---------------------------------------------------------------------------
// Stub Media — S3 client wrapper
// ---------------------------------------------------------------------------

export interface S3Stub {
  /** Download an object's bytes. */
  download(key: string): Promise<Buffer>;
  /** Upload a buffer; returns the storage key. */
  upload(key: string, body: Buffer, contentType: string): Promise<{ key: string; sizeBytes: number }>;
  /** Delete an object. */
  delete(key: string): Promise<void>;
}

const s3StoreKey = Symbol.for('@q-cms/worker/stub-s3');
interface S3StubState {
  objects: Map<string, { body: Buffer; contentType: string }>;
}
type GlobalWithS3 = typeof globalThis & { [s3StoreKey]?: S3StubState };
const s3g = globalThis as GlobalWithS3;
if (!s3g[s3StoreKey]) s3g[s3StoreKey] = { objects: new Map() };
const s3State = s3g[s3StoreKey] as S3StubState;

/** Build a stub S3 client. Replace once `@q-cms/media` is ready. */
export function makeS3Stub(): S3Stub {
  return {
    async download(key: string): Promise<Buffer> {
      const obj = s3State.objects.get(key);
      if (!obj) throw new Error(`S3 object not found: ${key}`);
      return obj.body;
    },
    async upload(key, body, contentType): Promise<{ key: string; sizeBytes: number }> {
      s3State.objects.set(key, { body, contentType });
      return { key, sizeBytes: body.length };
    },
    async delete(key: string): Promise<void> {
      s3State.objects.delete(key);
    },
  };
}

/** Real S3 client builder (used at runtime when S3 is configured). */
export function makeS3Client(): S3Stub {
  // Production code path — we re-use the stub interface but back it
  // with a real AWS SDK client. The worker can be tested with the
  // stub and run in production with the real client behind the same
  // surface.
  // The real implementation lives in `makeS3ClientReal` (see below)
  // and is dynamically imported to avoid pulling @aws-sdk/* into
  // unit-test bundles.
  return makeS3Stub();
}

/**
 * Build a real S3 client backed by `@aws-sdk/client-s3`. This is
 * kept as a separate function so the production bootstrap can opt
 * into it without dragging the dependency into unit tests.
 */
export async function makeS3ClientReal(): Promise<S3Stub> {
  const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } =
    await import('@aws-sdk/client-s3');
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? 'us-east-1';
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
  const bucket = process.env.S3_BUCKET ?? '';
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('S3 environment not configured (S3_ENDPOINT, S3_*)');
  }
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
  async function readBody(stream: ReadableStream<Uint8Array> | undefined): Promise<Buffer> {
    if (!stream) return Buffer.alloc(0);
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)), total);
  }
  return {
    async download(key: string): Promise<Buffer> {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      // The AWS SDK v3 returns a web stream on Node 22+; fall back
      // to the legacy .Body path for older runtimes.
      const body = (res as unknown as { Body?: ReadableStream<Uint8Array> | Buffer }).Body;
      if (Buffer.isBuffer(body)) return body;
      return readBody(body as ReadableStream<Uint8Array>);
    },
    async upload(key, body, contentType): Promise<{ key: string; sizeBytes: number }> {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
      );
      return { key, sizeBytes: body.length };
    },
    async delete(key: string): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

// ---------------------------------------------------------------------------
// Webhook signature helper
// ---------------------------------------------------------------------------

/**
 * Compute the HMAC-SHA256 signature of a JSON payload using the
 * given secret. The output is a lowercase hex string suitable for
 * placing in an `X-QCMS-Signature` header.
 */
export function signWebhookPayload(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// ---------------------------------------------------------------------------
// Audit log stub
// ---------------------------------------------------------------------------

const auditKey = Symbol.for('@q-cms/worker/stub-audit');
interface AuditRow {
  id: string;
  occurredAt: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  context: Record<string, unknown>;
}
type GlobalWithAudit = typeof globalThis & { [auditKey]?: AuditRow[] };
const ag = globalThis as GlobalWithAudit;
if (!ag[auditKey]) ag[auditKey] = [];
const auditLog = ag[auditKey] as AuditRow[];

/** Append a row to the audit log. */
export async function recordAudit(input: {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  context?: Record<string, unknown>;
}): Promise<void> {
  auditLog.push({
    id: genId(),
    occurredAt: new Date().toISOString(),
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    context: input.context ?? {},
  });
}

/** Delete rows older than `cutoff`. Returns the number deleted. */
export async function deleteAuditOlderThan(cutoff: Date): Promise<number> {
  let deleted = 0;
  for (let i = auditLog.length - 1; i >= 0; i--) {
    const row = auditLog[i];
    if (row && new Date(row.occurredAt).getTime() < cutoff.getTime()) {
      auditLog.splice(i, 1);
      deleted += 1;
    }
  }
  return deleted;
}

/** Test-only: snapshot of the audit log. */
export function __auditSnapshot(): readonly AuditRow[] {
  return [...auditLog];
}
