# ADR-0001: PostgreSQL as the only primary database

**Status:** Accepted (2026-06-05)
**Deciders:** Eng Lead, Architect
**Context:** Need to pick the primary data store for Q-CMS.

## Decision

We use **PostgreSQL 16+** as the only primary database. No MongoDB, MySQL, or other backends are supported in v1.0.

## Context

The CMS needs:
- A flexible content schema (collections defined at runtime).
- Strong consistency for relational data (entries ↔ relations ↔ users).
- Full-text search with typo tolerance (nice to have built-in).
- Pub/sub for realtime features.
- Mature tooling and operations.

## Options Considered

### Option A: PostgreSQL (chosen)
- ✅ JSONB columns for flexible content data
- ✅ `to_tsvector` for built-in full-text search
- ✅ LISTEN/NOTIFY for pub/sub
- ✅ Generated columns for indexable denormalized fields
- ✅ Point-in-time recovery, partitioning
- ✅ Battle-tested, huge ecosystem
- ❌ Single-node scaling story requires partitioning + read replicas

### Option B: MongoDB
- ✅ Native JSON storage
- ✅ Horizontal scaling built-in
- ❌ No native pub/sub (only change streams since 4.0)
- ❌ No real full-text search without Atlas
- ❌ Vendor lock-in (Atlas for serious use)
- ❌ Worse consistency guarantees
- ❌ Smaller pool of experienced ops people

### Option C: MySQL
- ❌ Worse JSON support
- ❌ No LISTEN/NOTIFY
- ❌ Less mature partitioning

## Consequences

- All content data lives in one `entries` table with JSONB `data` column.
- Single `entry_relations` table for relations graph.
- Search has a fallback path via `tsvector` if Meilisearch is down.
- Migrations are pure SQL (no ORM-specific migration tool needed).
- HA via streaming replication + Patroni.
