/**
 * Session repository — stub pending real DB-backed implementation.
 *
 * TODO: Replace with `SessionRepository` in `@q-cms/db` once one exists.
 * The `sessions` table exists in the schema; direct queries could be
 * wired here if needed before a dedicated repo is built.
 *
 * @module lib/repos/sessions
 */

import type { Session } from '@q-cms/core';

// In-memory store for now.
const store = new Map<string, Session>();

export interface SessionRepo {
  create(session: Session): Promise<Session>;
  findByTokenHash(hash: string): Promise<Session | null>;
  revoke(id: string): Promise<void>;
}

export const sessionRepo: SessionRepo = {
  async create(s) {
    store.set(s.id, s);
    return s;
  },

  async findByTokenHash(hash) {
    for (const s of store.values()) {
      if ((s as unknown as Record<string, unknown>)['tokenHash'] === hash) return s;
    }
    return null;
  },

  async revoke(id) {
    const s = store.get(id);
    if (s) store.set(id, { ...s, revokedAt: new Date().toISOString() as Session['revokedAt'] });
  },
};
