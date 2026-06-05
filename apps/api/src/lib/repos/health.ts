/**
 * Health-check probes.
 *
 * Pings downstream services and returns structured results for the
 * readiness endpoint.
 *
 * @module lib/repos/health
 */

import { getDb } from '../db.ts';
import { getEnv } from '../../env.ts';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface HealthChecks {
  postgres(): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }>;
  redis(): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }>;
  meilisearch(): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }>;
}

export const healthChecks: HealthChecks = {
  async postgres() {
    const start = Date.now();
    try {
      const db = getDb();
      await db.execute({ sql: 'SELECT 1', params: [] });
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async redis() {
    const start = Date.now();
    try {
      const env = getEnv();
      const url = new URL(env.REDIS_URL);
      const conn = await (await import('node:net')).createConnection({
        host: url.hostname,
        port: Number(url.port) || 6379,
      });
      await new Promise<void>((resolve, reject) => {
        conn.once('connect', () => {
          conn.write('PING\r\n');
        });
        conn.once('data', () => {
          conn.destroy();
          resolve();
        });
        conn.once('error', reject);
        setTimeout(() => { conn.destroy(); reject(new Error('timeout')); }, 2_000);
      });
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, error: 'redis unreachable' };
    }
  },

  async meilisearch() {
    const start = Date.now();
    try {
      const env = getEnv();
      const resp = await fetch(`${env.MEILI_URL}/health`, {
        headers: env.MEILI_MASTER_KEY
          ? { Authorization: `Bearer ${env.MEILI_MASTER_KEY}` }
          : {},
        signal: AbortSignal.timeout(3_000),
      });
      if (!resp.ok) throw new Error(`status ${resp.status}`);
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
};
