# ARCHITECTURE — Q-CMS

**Версия:** 1.0
**Дата:** 2026-06-05

Документ дополняет [SPEC.md](./SPEC.md) детальными диаграммами, sequence-диаграммами и описанием потоков данных.

---

## 1. C4-диаграммы

### 1.1. Level 1 — System Context

```
┌────────────────────────────────────────────────────────────────────┐
│                     Q-CMS — System Context                        │
└────────────────────────────────────────────────────────────────────┘

  ┌──────────────────┐
  │  Content Editor  │──── HTTPS ─────┐
  │  (Olga, browser) │                │
  └──────────────────┘                │
                                      ▼
  ┌──────────────────┐        ┌──────────────────┐
  │  Backend / FE Dev │───────▶│                  │
  │  (CLI / SDK)      │        │     Q-CMS        │
  └──────────────────┘        │                  │
                              │   Headless CMS   │
  ┌──────────────────┐        │                  │
  │  End User        │──── HTTPS ─▶│              │
  │  (consumer site) │        │                  │
  └──────────────────┘        └──────────────────┘
                                      │
                                      │  (optional)
                                      ▼
                              ┌──────────────────┐
                              │  IdP (OIDC/SAML) │
                              │  e.g. Keycloak   │
                              └──────────────────┘
```

### 1.2. Level 2 — Containers

```
┌────────────────────────────────────────────────────────────────────┐
│                     Q-CMS — Containers                            │
└────────────────────────────────────────────────────────────────────┘

┌─────────────┐    HTTPS/JSON    ┌─────────────────────────────┐
│ Admin UI    │────────────────▶ │                             │
│ Next.js 15  │                  │   Hono API                  │
│ (RSC + CSR) │                  │   Bun runtime               │
└─────────────┘                  │   REST + GraphQL + SSE      │
                                 │                             │
┌─────────────┐                  │   • Auth middleware         │
│ Developer   │  REST/GraphQL    │   • RBAC middleware         │
│ SDK / CLI   │────────────────▶ │   • Rate limit              │
└─────────────┘                  │   • OpenTelemetry           │
                                 │   • OpenAPI + GraphQL SDL   │
                                 │                             │
┌─────────────┐                  │                             │
│ Public      │  REST/GraphQL    │                             │
│ Website     │────────────────▶ │                             │
│ (Next.js/   │                  └──────┬────────┬────────┬────┘
│  Nuxt/      │                         │        │        │
│  Astro)     │                         │        │        │
└─────────────┘                         ▼        ▼        ▼
                                   ┌────────┐┌───────┐┌────────┐
                                   │Postgres││ Redis ││ Meili  │
                                   │  17    ││  7.x  ││ 1.10   │
                                   └────────┘└───┬───┘└────────┘
                                                  │
                                                  ▼
                                            ┌─────────┐
                                            │ BullMQ  │
                                            │ workers │
                                            └────┬────┘
                                                 │
                                                 ▼
                                            ┌─────────┐
                                            │   S3    │
                                            │ (media) │
                                            └─────────┘
```

### 1.3. Level 3 — Components (API service)

```
┌────────────────────────────────────────────────────────────────┐
│                    Hono API — Components                      │
└────────────────────────────────────────────────────────────────┘

HTTP request
     │
     ▼
┌──────────────────────────────────────┐
│  Router (Hono)                       │
│  /api/v1/{collection}/...           │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Middleware stack                    │
│  1. Request ID (UUID v7)            │
│  2. Logging (Pino)                  │
│  3. CORS                            │
│  4. Rate limit (Redis token bucket) │
│  5. Auth (Better Auth)              │
│  6. RBAC check                      │
│  7. OpenTelemetry span              │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Handler (REST or GraphQL resolver) │
│  1. Validate input (Zod)            │
│  2. Call service                    │
│  3. Serialize response              │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Application Service                │
│  - EntryService                     │
│  - MediaService                     │
│  - UserService                      │
│  - WebhookService                   │
│  - SearchService                    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Domain (entities, value objects)   │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Infrastructure (adapters)          │
│  - DrizzleRepository                │
│  - RedisCache                       │
│  - S3Storage                        │
│  - MeiliSearchAdapter               │
│  - BullMQAdapter                    │
│  - EmailAdapter                     │
└──────────────────────────────────────┘
```

---

## 2. Sequence-диаграммы

### 2.1. Публикация статьи (entry.publish)

```
Editor            Admin UI            API (Hono)         Postgres         Redis        BullMQ       Meilisearch
  │                  │                   │                 │               │             │              │
  │  click Publish   │                   │                 │               │             │              │
  ├─────────────────▶│                   │                 │               │             │              │
  │                  │ POST /entries/42/publish            │               │             │              │
  │                  ├──────────────────▶│                 │               │             │              │
  │                  │                   │ BEGIN           │               │             │              │
  │                  │                   ├────────────────▶│               │             │              │
  │                  │                   │ UPDATE status='published'      │             │              │
  │                  │                   ├────────────────▶│               │             │              │
  │                  │                   │ INSERT entry_revisions         │             │              │
  │                  │                   ├────────────────▶│               │             │              │
  │                  │                   │ COMMIT          │               │             │              │
  │                  │                   ├────────────────▶│               │             │              │
  │                  │                   │ NOTIFY 'entry_publish:42'      │             │              │
  │                  │                   ├────────────────▶│               │             │              │
  │                  │                   │ DEL entry:42:*  │               │             │              │
  │                  │                   ├───────────────────────────────▶│             │              │
  │                  │                   │ enqueue 'reindex-entry'        │             │              │
  │                  │                   ├─────────────────────────────────────────────▶│              │
  │                  │                   │ enqueue 'webhook'            │             │              │
  │                  │                   ├─────────────────────────────────────────────▶│              │
  │                  │ 200 OK            │                 │               │             │              │
  │                  │◀──────────────────┤                 │               │             │              │
  │  toast: OK       │                   │                 │               │             │  (worker)    │
  │◀─────────────────┤                   │                 │               │             │  index doc   │
  │                  │                   │                 │               │             ├─────────────▶│
  │                  │                   │                 │               │             │              │
```

### 2.2. Получение списка с cache

```
Client           API                Redis            Postgres
  │               │                  │                  │
  │ GET /articles?locale=ru          │                  │
  ├──────────────▶│                  │                  │
  │               │ GET list:Article:ru:abc123          │
  │               ├─────────────────▶│                  │
  │               │ MISS             │                  │
  │               │◀─────────────────┤                  │
  │               │ SELECT * FROM entries WHERE...       │
  │               ├─────────────────────────────────────▶│
  │               │ rows                              │
  │               │◀─────────────────────────────────────┤
  │               │ SETEX list:Article:ru:abc123 300 ... │
  │               ├─────────────────▶│                  │
  │               │ 200 OK (data, meta, facets)         │
  │◀──────────────┤                  │                  │
```

### 2.3. Realtime collab (editor)

```
Editor A       Admin UI A         Collab Server     Postgres      Editor B      Admin UI B
  │               │                    │                │              │              │
  │  type "H"     │                    │                │              │              │
  ├──────────────▶│  Y.Doc update      │                │              │              │
  │               ├───────────────────▶│                │              │              │
  │               │                    │ encode (y-protocols)          │              │
  │               │                    │ persist to PG (debounce 30s)  │              │
  │               │                    ├───────────────▶│              │              │
  │               │                    │ broadcast (awareness + update)│              │
  │               │                    ├──────────────────────────────────────────────▶│
  │               │                    │                                │  render      │
  │               │                    │                                ├──────────────▶│
```

### 2.4. Media upload

```
Browser         Admin UI           API (Hono)         S3          BullMQ      Sharp      Postgres
  │               │                    │                │            │           │           │
  │ drop file     │                    │                │            │           │           │
  ├──────────────▶│                    │                │            │           │           │
  │               │ POST /media (multipart)             │            │           │           │
  │               ├───────────────────▶│                │            │           │           │
  │               │                    │ validate (size, mime)         │           │           │
  │               │                    │ generate assetId (UUID)       │           │           │
  │               │                    │ PUT original                  │           │           │
  │               │                    ├───────────────▶│              │           │           │
  │               │                    │ enqueue 'process-image'      │           │           │
  │               │                    ├───────────────────────────────▶│           │           │
  │               │ 202 Accepted (assetId, status: processing)         │           │           │
  │               │◀───────────────────┤                │              │           │           │
  │  show placeholder                │                │              │           │           │
  │◀──────────────┤                    │                │              │           │           │
  │               │                    │                │ (worker)    │           │           │
  │               │                    │                │ generate variants (8 sizes)        │
  │               │                    │                │              │           │           │
  │               │                    │                │ PUT variants │           │           │
  │               │                    │                │◀─────────────┤           │           │
  │               │                    │                │              │  INSERT media + variants           │
  │               │                    │                │              │           ├──────────▶│
  │ SSE: media.ready(assetId)        │                │              │           │           │
  │               │◀───────────────────┤                │              │           │           │
  │ update UI     │                    │                │              │           │           │
```

---

## 3. Потоки данных

### 3.1. Read path (публичные клиенты)

```
CDN (cache miss)
  → API edge worker
  → Redis (cache miss)
  → Postgres
  → Redis SETEX (300s)
  → Response (Cache-Control: public, s-maxage=60)
  → CDN (cache hit, ≤ 60s edge TTL)
```

### 3.2. Write path (publish)

```
Admin UI
  → API (Hono) — auth, RBAC, validate
  → Postgres (transaction)
  → Postgres NOTIFY (subscribers: dashboard, collab)
  → Redis DEL (cache invalidation)
  → BullMQ enqueue:
      - reindex (Meilisearch)
      - webhook (HTTP POST)
      - email (notify subscribers)
  → 200 OK
```

### 3.3. Background job pipeline

```
entry.publish
  ├─→ [queue: reindex]   → Meilisearch (sync, ≤ 1s)
  ├─→ [queue: webhook]   → HTTP POST с retry (3 попытки, exp backoff)
  ├─→ [queue: email]     → SMTP для подписчиков
  └─→ [queue: cdn]       → Cloudflare cache purge (по config)

media.upload
  ├─→ [queue: image]     → Sharp variants → S3
  ├─→ [queue: thumbnail] → thumbnail generation
  └─→ [queue: index]     → Meilisearch index

entry.update (draft)
  └─→ (nothing async, sync write)
```

---

## 4. Модули и границы

### 4.1. Bounded contexts

```
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│  Content       │   │  Identity      │   │  Media         │
│  (entries,     │   │  (users,       │   │  (assets,      │
│   collections, │   │   roles,       │   │   variants,    │
│   relations)   │   │   auth,        │   │   folders)     │
│                │   │   sessions)    │   │                │
└───────┬────────┘   └────────┬───────┘   └────────┬───────┘
        │                     │                     │
        └──────────┬──────────┴──────────┬──────────┘
                   │                     │
            ┌──────▼──────┐      ┌───────▼──────┐
            │  Workflow   │      │  Search      │
            │  (states,   │      │  (indexes,   │
            │   audit)    │      │   queries)   │
            └─────────────┘      └──────────────┘
```

Каждый контекст — отдельный пакет в monorepo:
- `packages/content`
- `packages/identity`
- `packages/media`
- `packages/workflow`
- `packages/search`

Контексты общаются через events (`ContentPublished`, `MediaProcessed`) и/или прямые вызовы сервисов (через интерфейсы).

### 4.2. Гексагональная архитектура (Ports & Adapters)

```
                ┌─────────────────────────────┐
                │  Application (use-cases)    │
                │  - PublishEntry             │
                │  - UploadMedia              │
                │  - SearchEntries            │
                └──────────────┬──────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
        │   Ports   │    │   Ports   │    │   Ports   │
        │ (interfaces)   │           │    │           │
        │ EntryRepo │    │ Cache     │    │ Search    │
        └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
              │                │                │
        ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
        │ Adapters  │    │           │    │           │
        │ DrizzleRepo    │ Redis    │    │ Meili     │
        └───────────┘    └───────────┘    └───────────┘
```

Domain не импортирует Infrastructure. Зависимости через DI-контейнер (`@q-cms/di`).

---

## 5. Масштабирование

### 5.1. Горизонтальное

| Компонент | Stateless | Scaling strategy |
|---|---|---|
| API (Hono) | ✅ | Kubernetes HPA по CPU + custom metric `q_cms_request_rate` |
| Admin UI (Next.js) | ✅ | CDN-cached static + RSC |
| Collab server | ❌ (stateful) | Sticky session, max 5k rooms per node |
| Worker (BullMQ) | ✅ | Scaling по длине очереди |
| Postgres | ❌ | Read replicas + partitioning (по collection_id или date) |
| Redis | ❌ | Sentinel / Cluster |
| Meilisearch | ❌ | Multi-node (3+ для HA) |

### 5.2. Vertical

Postgres tune:
```
shared_buffers = 25% RAM
work_mem = 64MB
max_connections = 200
effective_cache_size = 75% RAM
maintenance_work_mem = 512MB
random_page_cost = 1.1 (для SSD)
```

### 5.3. Партиционирование

`entries` партиционируется по `collection_id` (hash) для равномерного распределения, и по `published_at` (range, monthly) для archived данных.

---

## 6. Disaster Recovery

### 6.1. Backup

- **Postgres:** WAL-G → S3, инкрементальный каждые 5 мин, полный — ежедневно, retention 30 дней.
- **S3 (media):** versioning enabled + cross-region replication (для production).
- **Meilisearch:** снапшоты в S3 каждые 6 часов.
- **Redis:** AOF + RDB, персистентность.

### 6.2. Recovery scenarios

| Scenario | RTO | RPO | Процедура |
|---|---|---|---|
| API node down | 0 (auto-restart) | 0 | HPA перезапустит pod |
| Postgres primary down | ≤ 30 s | 0 | Patroni failover |
| Redis down | ≤ 1 мин | 0 (cache, не source) | Sentinel promote replica |
| S3 region down | n/a | 0 | Cross-region replica |
| Полная потеря кластера | ≤ 30 мин | ≤ 5 мин | Restore from WAL-G |
| Случайное удаление | ≤ 5 мин | ≤ 5 мин | PITR Postgres |

---

## 7. Cost estimation (cloud)

### 7.1. Self-hosted baseline (100k entries, 1M API calls/month)

| Ресурс | Spec | $/мес |
|---|---|---|
| API (2 ноды) | 2 vCPU / 2 GB / 20 GB SSD | $30 |
| Admin (1 нода) | 1 vCPU / 1 GB | $15 |
| Postgres (1 primary + 1 replica) | 2 vCPU / 4 GB / 100 GB SSD | $60 |
| Redis (1) | 1 vCPU / 1 GB | $15 |
| Meilisearch (1) | 1 vCPU / 2 GB | $20 |
| S3 (50 GB + 100 GB egress) | — | $10 |
| Load balancer | — | $10 |
| **Total** | | **$160/мес** |

### 7.2. Managed (v1.5, $99/мес small tier)

- 50 GB storage
- 5M API calls
- 10 GB egress
- 99.9% SLA
- Email support

---

## 8. Failure modes & mitigations

| Failure | Impact | Mitigation |
|---|---|---|
| Postgres unavailable | API down | Read from replica (stale), queue writes, alert |
| Redis unavailable | Degraded (no cache, no rate limit, no sessions) | In-memory fallback for sessions, log alert |
| Meilisearch unavailable | Search 5xx | Fall back to PG `tsvector` (slower) |
| S3 unavailable | Media uploads/reads fail | Local disk fallback (limited), alert |
| Worker down | Webhooks/search delayed | Restart, queue retains jobs |
| Collab server down | Editor работает solo | Auto-reconnect, save to PG |
| CDN down | Public site slow | Direct to origin, higher latency |

---

## 9. Технический долг (явно отложенный)

- Federation / multi-region (v2.0)
- Eventual consistency для cross-region
- Custom blocks marketplace (v1.5)
- Mobile SDK (v1.5)
- Vector search (v2.0)
- Visual page builder (отклонён)

---

## 10. Диаграмма миграций схемы

```
v0.1 ─┬─▶ v0.2 ─┬─▶ v0.3 ─┬─▶ v0.5 ─┬─▶ v0.7 ─┬─▶ v1.0
       │         │         │         │         │
       │         │         │         │         └─▶ v1.5 ─▶ v2.0
       ▼         ▼         ▼         ▼
    alpha     beta      RC        GA
```

Каждая версия имеет миграцию БД (forward + reverse). Кастомизированные миграции пользователя — в `packages/db/custom-migrations/`, не затираются при обновлении.
