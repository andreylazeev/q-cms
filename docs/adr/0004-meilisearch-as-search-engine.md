# ADR-0004: Meilisearch as the search engine

**Status:** Accepted (2026-06-05)
**Deciders:** Eng Lead
**Context:** Pick a search engine for content search.

## Decision

We use **Meilisearch 1.10+** as the primary search engine, with Postgres `tsvector` as a fallback.

## Context

Requirements:
- Typo-tolerant full-text search
- Faceted search
- Real-time indexing (≤ 2s delay from publish)
- Low ops overhead
- Self-hostable

## Options Considered

### Option A: Meilisearch (chosen)
- ✅ Sub-50ms latency
- ✅ Typo tolerance out of the box
- ✅ Faceting, ranking, filters
- ✅ Simple deployment (single binary)
- ✅ Rust-based, memory-mapped
- ❌ In-memory (limited by RAM; need snapshots to S3)
- ❌ No vector search (yet — coming in 1.13+)

### Option B: Elasticsearch
- ✅ Mature, full-featured
- ✅ Vector search
- ❌ Heavy ops (JVM, complex config)
- ❌ Slow startup
- ❌ Overkill for v1.0

### Option C: Algolia
- ✅ Best UX
- ❌ SaaS only (no self-host)
- ❌ Expensive at scale

### Option D: Postgres FTS
- ✅ No new infra
- ❌ No typo tolerance
- ❌ No faceting
- ❌ Slower for large datasets
- ✅ Good fallback when Meilisearch is down

## Decision

Meilisearch for primary, Postgres FTS as automatic fallback (search service returns from Meilisearch if available, else queries `tsvector`).

## Consequences

- BullMQ job `reindex` syncs entries to Meilisearch on publish.
- One Meilisearch index per collection per locale (e.g. `articles_en`, `articles_ru`).
- S3 snapshots every 6 hours for disaster recovery.
- If Meilisearch fails, search endpoint automatically falls back to PG.
