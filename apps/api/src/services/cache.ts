/**
 * Cache service — thin Redis wrapper.
 *
 * Falls back to an in-memory `Map` when Redis is unavailable so unit
 * tests can run without infrastructure. The interface mirrors what
 * we'd expect from a Redis-backed adapter (`get/set/del/delPattern`).
 *
 * @module services/cache
 */

import Redis from 'ioredis';

export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  delPattern(pattern: string): Promise<number>;
  mget(keys: readonly string[]): Promise<(string | null)[]>;
  close(): Promise<void>;
}

class InMemoryCache implements CacheClient {
  private store = new Map<string, { value: string; expiresAt: number | null }>();
  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  async set(key: string, value: string, ttl: number): Promise<void> {
    const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }
  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
  async delPattern(pattern: string): Promise<number> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let count = 0;
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        count += 1;
      }
    }
    return count;
  }
  async mget(keys: readonly string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map((k) => this.get(k)));
  }
  async close(): Promise<void> {
    this.store.clear();
  }
}

class RedisCache implements CacheClient {
  constructor(private readonly client: Redis) {}
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }
  async set(key: string, value: string, ttl: number): Promise<void> {
    if (ttl > 0) await this.client.set(key, value, 'EX', ttl);
    else await this.client.set(key, value);
  }
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
  async delPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let removed = 0;
    do {
      const [next, batch] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (batch.length > 0) {
        removed += await this.client.del(...batch);
      }
    } while (cursor !== '0');
    return removed;
  }
  async mget(keys: readonly string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    return this.client.mget(...keys);
  }
  async close(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}

let cached: CacheClient | undefined;

/**
 * Return a process-wide cache client. Uses Redis when `REDIS_URL` is
 * set, otherwise an in-memory fallback.
 */
export function getCache(): CacheClient {
  if (cached) return cached;
  const url = process.env['REDIS_URL'];
  if (url) {
    const client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
    cached = new RedisCache(client);
  } else {
    cached = new InMemoryCache();
  }
  return cached;
}

/** Override the cache (used by tests). */
export function setCache(client: CacheClient): void {
  cached = client;
}

/** Close and reset the singleton. */
export async function closeCache(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = undefined;
  }
}
