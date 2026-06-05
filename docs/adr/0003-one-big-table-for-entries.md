# ADR-0003: One-Big-Table for entries

**Status:** Accepted (2026-06-05)
**Deciders:** Eng Lead, Architect
**Context:** How to store user-defined collections in Postgres.

## Decision

We use a **single `entries` table** with a JSONB `data` column for all content, rather than creating one Postgres table per collection.

## Context

The CMS lets users define collections at runtime. Two strategies:

1. **One table per collection** — DDL generated from schema.ts. Each collection becomes a real Postgres table with typed columns.
2. **One big table** — All entries live in one `entries` table; field values stored as JSONB.

## Options Considered

### Option A: One-Big-Table (chosen)

```
CREATE TABLE entries (
  id UUID,
  collection_id UUID,
  status entry_status,
  locale TEXT,
  data JSONB,
  ...
);
CREATE INDEX idx_entries_data ON entries USING GIN (data jsonb_path_ops);
CREATE INDEX idx_entries_collection_status ON entries (collection_id, status);
```

- ✅ Schema changes are config-only, no DDL.
- ✅ Easy multi-locale (one row per locale, all in same table).
- ✅ Easy cross-collection analytics ("all published this month").
- ✅ Indexes work via GIN on JSONB.
- ✅ Versioning via separate `entry_revisions` table (snapshots).
- ❌ Per-field indexes require generated columns.
- ❌ Less type safety per field (mitigated by Zod validation at API).

### Option B: One table per collection

- ✅ Per-field indexes are native.
- ✅ Stronger type safety.
- ❌ DDL changes on every schema change.
- ❌ Migration complexity: ALTER TABLE on potentially huge tables.
- ❌ No unified list/analytics across collections.
- ❌ Locale strategy awkward (one row per locale per table).
- ❌ Relations across collections require foreign keys to dynamic table names.

## Decision

We go with **Option A (One-Big-Table)** for v1.0. The trade-offs (less native per-field indexing) are mitigated by:
- `GENERATED ALWAYS AS` columns for commonly-queried fields (title, slug).
- GIN indexes on `data` for ad-hoc queries.
- Meilisearch for full-text + faceted search.

If a customer needs extreme per-field performance later (e.g., millions of rows with a specific query pattern), we can introduce table-per-collection as an opt-in optimization (v1.5+).

## Consequences

- All collection definitions are config (no DDL on schema change).
- Migrations are simpler.
- Performance: typical p99 < 50 ms for list queries with GIN + B-tree indexes.
- New collections become available instantly without migrations.
