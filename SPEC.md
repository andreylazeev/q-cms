# SPEC — Q-CMS Technical Specification

**Версия:** 1.0
**Дата:** 2026-06-05
**Статус:** Approved for build
**Владелец:** Engineering

Этот документ описывает, *как* Q-CMS реализует требования из [PRD.md](./PRD.md). Архитектурные диаграммы — в [ARCHITECTURE.md](./ARCHITECTURE.md). Модель данных — в [DATA_MODEL.md](./DATA_MODEL.md). API — в [API.md](./API.md). Обоснование выбора технологий — в [STACK.md](./STACK.md).

---

## 1. Technology Stack

### 1.1. Core

| Слой | Технология | Версия | Обоснование |
|---|---|---|---|
| Runtime | **Bun** (primary) / Node.js 22 LTS (fallback) | Bun 1.1+ / Node 22.x | Bun: в 3-4 раза быстрее startup, нативный TS, встроенные SQLite/Redis-клиенты |
| Language | **TypeScript** | 5.6+ | strict mode, branded types, exhaustive matching |
| HTTP framework (API) | **Hono** | 4.x | минималистичный, edge-ready, ~14 KB, быстрее Express в 4 раза |
| Admin UI framework | **Next.js 15** (App Router) + **React 19** | Next 15.x / React 19 | Server Components, Server Actions, edge runtime |
| Styling (admin) | **Tailwind CSS 4** + **shadcn/ui** | Tailwind 4.x | быстрая итерация, копируемые компоненты |
| ORM | **Drizzle ORM** | 0.36+ | type-safe SQL, миграции на чистом SQL, zero runtime overhead |
| Database | **PostgreSQL** | 17 | полнотекст, JSONB, FTS, LISTEN/NOTIFY для realtime |
| Cache | **Redis** | 7.x | sessions, rate limit, pub/sub, query cache |
| Search | **Meilisearch** | 1.10+ | быстрее ES, typo-tolerant, проще в эксплуатации |
| Queue | **BullMQ** | 5.x | retries, delayed jobs, repeatable, observability |
| Object storage | **S3-compatible** | — | AWS S3, Cloudflare R2, MinIO, Backblaze B2 |
| Editor engine | **TipTap** (ProseMirror) | 2.x | headless, расширяемый, отличный UX |
| Realtime collab | **Y.js** + **Hocuspocus** | Y 13 / Hocuspocus 2 | CRDT, peer-to-peer awareness |
| Image processing | **Sharp** | 0.33+ | быстрая обработка, AVIF/WebP/JPEG/PNG |
| Auth | **Better Auth** | 1.x | sessions, OAuth, OIDC, SAML, 2FA — всё в одном |
| Validation | **Zod** | 3.x | типы + рантайм-валидация, единый источник правды |
| Logging | **Pino** | 9.x | самая быстрая JSON-библиотека для Node |
| Tracing | **OpenTelemetry SDK** | 1.x | vendor-neutral, OTLP экспорт |
| Metrics | **prom-client** | 15.x | Prometheus exposition format |
| Email | **Nodemailer** + SMTP / SES | — | magic links, уведомления |
| Background jobs | **BullMQ** | 5.x | см. выше |

### 1.2. Tooling

| Категория | Инструмент |
|---|---|
| Package manager | pnpm 9.x (workspaces) |
| Monorepo | Turborepo 2.x |
| Lint | ESLint 9 (flat config) + typescript-eslint |
| Format | Biome 1.9 (быстрее Prettier в 10-100x) |
| Test | Vitest 2.x (unit) + Playwright 1.5 (E2E) |
| Build | Bun build (API), Next.js build (admin) |
| CI | GitHub Actions |
| Containers | Docker multi-stage + BuildKit |
| Orchestration | Docker Compose (dev) / Kubernetes (prod) |
| IaC | Terraform модули (optional, contrib) |
| Docs | Astro 5 + Starlight |

### 1.3. Структура репозитория (monorepo)

```
q-cms/
├── apps/
│   ├── api/                # Hono API (Bun)
│   ├── admin/              # Next.js 15 admin UI
│   ├── collab/             # Hocuspocus realtime server
│   └── worker/             # BullMQ workers
├── packages/
│   ├── core/               # Бизнес-логика, доменные модели
│   ├── db/                 # Drizzle schema + миграции
│   ├── auth/               # Better Auth конфиг + адаптеры
│   ├── schema/             # Парсер контентной схемы + Zod-генерация
│   ├── api-client/         # Type-safe API client
│   ├── sdk/                # Public SDK @q-cms/sdk
│   ├── cli/                # q-cms CLI
│   ├── ui/                 # Переиспользуемые React-компоненты
│   ├── editor/             # TipTap конфиг + кастомные блоки
│   ├── media/              # Sharp pipeline, S3 client
│   ├── search/             # Meilisearch обёртки
│   ├── i18n/               # Локализация
│   └── shared/             # Общие типы и утилиты
├── deploy/
│   ├── docker/             # Dockerfile'ы
│   ├── compose/            # docker-compose.yml
│   └── k8s/                # Helm chart
├── docs/                   # Документация (Astro Starlight)
└── examples/               # Next.js / Nuxt / Astro примеры
```

---

## 2. Архитектура

### 2.1. High-level диаграмма

```
                                  ┌─────────────────────┐
                                  │   Admin UI (SPA)    │
                                  │   Next.js + RSC     │
                                  │   (SSR + CSR)       │
                                  └──────────┬──────────┘
                                             │ HTTPS (REST/GraphQL)
                                             │ + WebSocket (collab)
                                             ▼
┌────────────┐  ┌────────────┐  ┌──────────────────────┐
│  Clients   │  │   SDK /    │  │    Hono API          │
│  (web,     │  │   CLI      │──┤    (Bun runtime)     │
│   mobile)  │  │            │  │    OpenAPI + GraphQL │
└─────┬──────┘  └─────┬──────┘  └──────────┬───────────┘
      │               │                   │
      │               │     ┌─────────────┼─────────────┐
      │               │     │             │             │
      ▼               ▼     ▼             ▼             ▼
   ┌───────────────────────────────┐  ┌────────┐  ┌──────────┐
   │       PostgreSQL 17           │  │ Redis  │  │  Meili   │
   │  (data, FTS, JSONB, LISTEN)   │  │  cache │  │  search  │
   └───────────────────────────────┘  └────┬───┘  └──────────┘
                                           │ pub/sub
                                           ▼
                                    ┌──────────────┐
                                    │  BullMQ      │
                                    │  workers     │
                                    │  (webhooks,  │
                                    │   email,     │
                                    │   image)     │
                                    └──────────────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  S3 (media)  │
                                    └──────────────┘
```

Полная диаграмма — в [ARCHITECTURE.md](./ARCHITECTURE.md).

### 2.2. Принципы

1. **Single source of truth — schema.ts.** Контентная схема описывается в одном TypeScript-файле; DDL, Zod-валидаторы, GraphQL SDL, OpenAPI и TS-типы для SDK генерируются из неё.
2. **Stateless API.** Любая нода API может обслужить любой запрос. Состояние — в Postgres/Redis.
3. **Cache-aside на чтение, write-through на инвалидацию.** При `entry.publish` инвалидируется Redis-ключ и публикуется NOTIFY в Postgres.
4. **Edge-ready.** API и публичные endpoints могут деплоиться на Cloudflare Workers / Vercel Edge / Deno Deploy (Hono это умеет).
5. **Eventual consistency для поиска.** Entry → Postgres (source of truth) → BullMQ job → Meilisearch (async, ≤ 2 с задержки).
6. **Realtime без WebSockets где возможно.** SSE для live updates (entries, dashboard), WebSocket только для editor collaboration.

### 2.3. Слои приложения

```
┌─────────────────────────────────────────────────┐
│  Transport Layer (Hono router, middleware)      │
│  - CORS, rate limit, auth, request ID           │
├─────────────────────────────────────────────────┤
│  API Layer (handlers, GraphQL resolvers)        │
│  - Валидация (Zod), сериализация, OpenTelemetry │
├─────────────────────────────────────────────────┤
│  Application Layer (use-cases)                  │
│  - EntryService, MediaService, AuthService      │
├─────────────────────────────────────────────────┤
│  Domain Layer (entities, value objects)         │
│  - Entry, Collection, User, Role, Media         │
├─────────────────────────────────────────────────┤
│  Infrastructure Layer (adapters)                │
│  - DrizzleRepository, RedisCache, S3Storage,   │
│    MeiliSearch, BullMQ, Email                   │
└─────────────────────────────────────────────────┘
```

Зависимости направлены внутрь (Dependency Inversion). Domain не знает про Postgres или Redis.

---

## 3. Контентная схема

### 3.1. Файл `schema.ts`

```typescript
// schema.ts — единственный источник правды
import { defineConfig, collection, component, blocks } from '@q-cms/schema';

export default defineConfig({
  name: 'blog',
  defaultLocale: 'en',
  locales: ['en', 'ru', 'de'],
  collections: {
    Article: collection({
      title: 'Article',
      slug: 'articles',
      draftAndPublish: true,
      versioning: true,
      fields: {
        title: { type: 'text', required: true, maxLength: 200 },
        slug:  { type: 'uid', target: 'title', required: true },
        excerpt: { type: 'text', maxLength: 500 },
        cover: { type: 'media', allowedTypes: ['image'], required: true },
        author: { type: 'relation', target: 'Author', required: true },
        tags: { type: 'relation', target: 'Tag', multiple: true },
        category: { type: 'relation', target: 'Category' },
        content: { type: 'blocks', blocks: ['paragraph', 'heading', 'image', 'code', 'quote', 'embed', 'gallery'] },
        seo: { type: 'component', component: 'SEO' },
        publishedAt: { type: 'datetime' },
        locale: { type: 'locale' },
      },
      indexes: ['slug', 'publishedAt', ['authorId', 'publishedAt']],
    }),

    Author: collection({
      title: 'Author',
      slug: 'authors',
      fields: {
        name: { type: 'text', required: true },
        email: { type: 'email', required: true, unique: true },
        avatar: { type: 'media', allowedTypes: ['image'] },
        bio: { type: 'richtext' },
        social: { type: 'json' },
      },
    }),

    Category: collection({
      title: 'Category',
      slug: 'categories',
      fields: {
        name: { type: 'text', required: true },
        slug: { type: 'uid', target: 'name' },
      },
    }),

    Tag: collection({
      title: 'Tag',
      slug: 'tags',
      fields: {
        name: { type: 'text', required: true },
        slug: { type: 'uid', target: 'name' },
      },
    }),

    Settings: collection({
      title: 'Site Settings',
      slug: 'settings',
      singleton: true,
      fields: {
        siteName: { type: 'text', required: true },
        description: { type: 'text' },
        logo: { type: 'media' },
        social: { type: 'json' },
      },
    }),
  },

  components: {
    SEO: component({
      fields: {
        title: { type: 'text', maxLength: 70 },
        description: { type: 'text', maxLength: 160 },
        image: { type: 'media' },
        noindex: { type: 'boolean' },
      },
    }),
  },

  blocks: {
    ...blocks.core,
    callout: {
      schema: { type: { enum: ['info', 'warning', 'success', 'danger'] }, text: { type: 'text' } },
      component: './blocks/callout.tsx',
    },
  },

  webhooks: [
    { name: 'on-publish', events: ['entry.publish'], url: '$env.NEXT_REVALIDATE_URL' },
  ],
});
```

### 3.2. Codegen pipeline

```
schema.ts
   │
   ├─→ Drizzle schema.ts  (packages/db/src/schema.generated.ts)
   ├─→ Zod validators    (packages/schema/src/validators/*.ts)
   ├─→ GraphQL SDL       (apps/api/src/graphql/schema.generated.ts)
   ├─→ OpenAPI 3.1       (apps/api/src/openapi.generated.json)
   ├─→ TS types для SDK  (packages/sdk/src/types.generated.ts)
   └─→ Миграция DDL      (packages/db/migrations/2026_xx_xx_*.sql)
```

Команда: `pnpm codegen` (запускается через Turborepo, инкрементально по hash файла).

### 3.3. Динамические блоки (Dynamic Zone)

```typescript
content: {
  type: 'blocks',
  blocks: [
    { ref: 'paragraph' },
    { ref: 'heading' },
    { ref: 'image', with: { caption: true } },
    { ref: 'code', with: { language: true, lineNumbers: true } },
    { ref: 'embed', with: { providers: ['youtube', 'vimeo', 'spotify', 'twitter'] } },
    { ref: 'component', ref: 'callToAction' },
  ],
}
```

Хранится как `jsonb` массив `{ type, data, children? }`.

---

## 4. Data Model (сжатый обзор)

Полная схема — в [DATA_MODEL.md](./DATA_MODEL.md).

### 4.1. Основные таблицы

| Таблица | Назначение |
|---|---|
| `users` | Админ-пользователи |
| `sessions` | Активные сессии (auth) |
| `api_tokens` | PAT-токены |
| `roles` | Роли (admin, editor, viewer, custom) |
| `permissions` | Гранулярные права (resource × action) |
| `role_permissions` | M2M roles ↔ permissions |
| `user_roles` | M2M users ↔ roles |
| `collections` | Метаданные коллекций |
| `entries` | Универсальная таблица для всех entries (one big table) |
| `entry_revisions` | История версий (jsonb snapshot) |
| `entry_relations` | M2M для relations (graph) |
| `media` | Метаданные файлов |
| `media_variants` | Размеры/форматы картинок |
| `webhooks` | Зарегистрированные webhook'и |
| `webhook_deliveries` | Лог доставки (для retry) |
| `audit_log` | Audit trail |
| `i18n_translations` | Кэш переводов (опционально) |

### 4.2. Универсальная таблица `entries` (one-big-table)

```sql
CREATE TABLE entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  slug            TEXT,
  status          TEXT NOT NULL CHECK (status IN ('draft', 'in_review', 'approved', 'published', 'archived')),
  locale          TEXT NOT NULL,
  data            JSONB NOT NULL,
  -- Denormalized fields для индексации:
  title           TEXT GENERATED ALWAYS AS (data->>'title') STORED,
  search_vector   TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', data->>'title' || ' ' || coalesce(data->>'description', ''))) STORED,
  published_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Localized relations are stored separately; this table holds one row per (entry, locale)
  UNIQUE (collection_id, locale, slug)
);

CREATE INDEX idx_entries_collection_status ON entries (collection_id, status);
CREATE INDEX idx_entries_published_at ON entries (published_at DESC) WHERE status = 'published';
CREATE INDEX idx_entries_search ON entries USING GIN (search_vector);
CREATE INDEX idx_entries_data_gin ON entries USING GIN (data jsonb_path_ops);
CREATE INDEX idx_entries_locale ON entries (locale);
```

Подробнее — [DATA_MODEL.md](./DATA_MODEL.md).

---

## 5. API

### 5.1. Транспорты

- **REST** — основной. OpenAPI 3.1, generated.
- **GraphQL** — для сложных графов с relations и произвольным populate.
- **JSON-RPC** — нет (overengineering).
- **SSE** — для подписок на обновления конкретной записи/коллекции.

Полный референс — [API.md](./API.md).

### 5.2. Версионирование

- URL-based: `/api/v1/...`. v1 — пока продукт < 1.0. После 1.0 — Content Negotiation (`Accept: application/vnd.q-cms.v2+json`).
- Deprecation policy: 6 месяцев параллельной поддержки.

### 5.3. Пример REST запроса

```http
GET /api/v1/collections/articles/entries?filter[status]=published&filter[author.email]=anna@example.com&populate=author,tags&fields=id,title,slug,author.name&sort=-publishedAt&page[limit]=20&page[cursor]=eyJpZCI6IjEyMyJ9
```

### 5.4. Пример GraphQL

```graphql
query ArticleWithAuthor {
  entries(collection: "Article", status: PUBLISHED, locale: "ru") {
    edges {
      node {
        id
        title
        slug
        publishedAt
        author { name avatar { url(size: MEDIUM) } }
        tags { name slug }
        content { ... on Heading { level text } ... on Image { url alt } }
      }
    }
  }
}
```

### 5.5. SDK (type-safe)

```typescript
import { createClient } from '@q-cms/sdk';

const cms = createClient({
  baseUrl: 'https://cms.example.com',
  token: process.env.QCMS_TOKEN,
  locale: 'ru',
});

const { data, meta } = await cms.entries('Article')
  .where({ status: 'published', author: { email: { eq: 'anna@example.com' } } })
  .populate(['author', 'tags', 'author.avatar'])
  .fields(['id', 'title', 'slug', 'author.name'])
  .sort('-publishedAt')
  .limit(20)
  .get();
```

---

## 6. Аутентификация и авторизация

### 6.1. Auth flow (Better Auth)

- **Email/password:** bcrypt cost 12, lockout после 5 неудач за 15 мин / IP.
- **Magic link:** токен в Redis с TTL 15 мин, одноразовый.
- **OAuth 2.0:** Google, GitHub, Microsoft (configurable).
- **OIDC/SAML:** enterprise (v1.0).
- **2FA:** TOTP, опционально per-user.
- **API tokens:** PAT, scope-based (`read:entries`, `write:media`), revocable.
- **JWT vs session:** API использует Bearer JWT (HS256, 15 мин) + refresh-token (httpOnly cookie, 30 дней). Для SPA — session cookie.

### 6.2. RBAC

Разрешения — это кортежи `(resource, action)`, например:
- `collection:Article:read`
- `collection:Article:write`
- `collection:Article:publish`
- `collection:Article:delete`
- `media:write`
- `settings:write`
- `users:invite`

Роли — pre-defined:
- **Super Admin** — всё
- **Admin** — управление контентом, пользователями, настройками
- **Editor** — CRUD по назначенным коллекциям + publish
- **Author** — CRUD своих записей + draft
- **Reviewer** — read all + approve/reject
- **Viewer** — read all

Field-level permissions (v1.0): правила типа "author видит только записи, где `entries.created_by = current_user.id`".

### 6.3. Audit Log

Каждое изменение записывается:
```json
{
  "id": "uuid",
  "actor_id": "user-uuid",
  "actor_email": "anna@example.com",
  "action": "entry.update",
  "resource": "Article:42",
  "diff": { "title": { "from": "Hello", "to": "Hello, world" } },
  "ip": "203.0.113.42",
  "user_agent": "Mozilla/5.0...",
  "request_id": "req_xyz",
  "timestamp": "2026-06-05T12:00:00Z"
}
```

---

## 7. Editor (Block-based)

### 7.1. Архитектура

```
┌──────────────────────────────────────────────┐
│  React Component <Editor>                    │
│   ├─ Toolbar (slash, formatting)             │
│   ├─ Bubble menu                             │
│   ├─ Floating menu                           │
│   └─ TipTap Editor (ProseMirror)             │
│       ├─ Document (json ↔ ProseMirror)       │
│       ├─ Schema (Blocks + Inlines)           │
│       ├─ Extensions (Custom blocks)          │
│       └─ Collaboration (Y.js plugin)         │
└──────────────────────────────────────────────┘
```

### 7.2. Хранение контента

Документ хранится в JSONB в формате, совместимом с ProseMirror:

```json
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Hello" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "World " }, { "type": "text", "marks": [{ "type": "bold" }], "text": "bold" }] },
    { "type": "image", "attrs": { "assetId": "media-uuid", "alt": "Description", "caption": "Figure 1" } },
    { "type": "codeBlock", "attrs": { "language": "ts" }, "content": [{ "type": "text", "text": "const x = 1;" }] }
  ]
}
```

### 7.3. Кастомные блоки

```typescript
// packages/editor/src/blocks/callout.tsx
import { Node, mergeAttributes } from '@tiptap/core';

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return {
      variant: { default: 'info' },
    };
  },
  parseHTML() { return [{ tag: 'div[data-callout]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutComponent);
  },
});
```

### 7.4. Realtime collaboration

- Протокол: **Y.js** (CRDT) поверх **Hocuspocus** WebSocket-сервера (отдельный app).
- Awareness: показывать аватары других редакторов и их курсоры.
- Persistence: периодический snapshot в Postgres (каждые 30 с или при on-blur).
- Permissions: проверка на сервере Hocuspocus через JWT с embedded `entry_id` и `user_id`.

### 7.5. Производительность

- Virtual rendering для длинных документов (>200 блоков).
- Debounce autosave: 3 секунды idle.
- Optimistic UI: применяем изменения сразу, rollback при ошибке.
- Code highlight (Shiki) — async, не блокирует ввод.

---

## 8. Media

### 8.1. Upload pipeline

```
[Browser] → (multipart/form-data) → [API: validate]
                                        ↓
                                  [S3: PUT object]
                                        ↓
                                  [BullMQ: process-image job]
                                        ↓
                                  [Sharp: variants]
                                        ↓
                                  [S3: PUT variants]
                                        ↓
                                  [Postgres: media row + variants]
                                        ↓
                                  [Meilisearch: index]
```

### 8.2. Image variants (presets)

| Preset | Width | Format | Quality | Use case |
|---|---|---|---|---|
| `thumbnail` | 150 | WebP | 80 | list views |
| `small` | 480 | WebP | 80 | mobile |
| `medium` | 768 | WebP/JPEG (fallback) | 85 | tablet |
| `large` | 1280 | WebP | 85 | desktop |
| `xl` | 1920 | WebP | 85 | hero |
| `2xl` | 2560 | WebP | 80 | 4K |
| `avif-large` | 1920 | AVIF | 70 | modern browsers |
| `blur` | 32 | WebP | 30 | placeholder |

Стратегия: on-demand генерация + LRU кэш (Redis, max 10k вариантов) + CDN invalidation при замене.

### 8.3. URL scheme

```
GET /media/{assetId}?w=1280&h=720&fit=cover&format=webp&q=85
```

API проксирует в Sharp при cache miss, отдаёт с `Cache-Control: public, max-age=31536000, immutable` и `ETag`.

### 8.4. Video (v1.5)

- Upload MP4/WebM в S3.
- BullMQ job: ffmpeg → HLS (multiple bitrates) + thumbnail (1, 5, 10 с).
- Playback через hls.js или нативный `<video>` (Safari).

---

## 9. Search

### 9.1. Meilisearch integration

- Index per collection: `articles_en`, `articles_ru`, ...
- Sync: BullMQ job после `entry.publish|unpublish|delete`.
- Indexing delay: ≤ 2 секунды (p95).
- Searchable attributes: `title^3, excerpt^2, content.text^1, tags.name^2`.
- Filterable: `status, publishedAt, authorId, locale, tags`.
- Typo tolerance: включена по умолчанию (1 правка для слов ≥5 символов).
- Faceting: настраивается per-collection.

### 9.2. Real-time search (admin)

Дебаунс 200 мс, минимум 2 символа, top-10 результатов с подсветкой.

### 9.3. Faceted search API

```http
GET /api/v1/collections/articles/entries?facets=author,tags&facet[author]=anna@example.com
```

Ответ:
```json
{
  "data": [...],
  "facets": {
    "author": { "anna@example.com": 12, "ivan@example.com": 8 },
    "tags": { "javascript": 15, "rust": 5 }
  }
}
```

---

## 10. Caching Strategy

### 10.1. Cache layers

| Слой | TTL | Use case | Инвалидация |
|---|---|---|---|
| L1: In-memory (LRU, 1000 keys) | 60 с | hot entries | LRU eviction |
| L2: Redis | 5 мин | list views, single entry | on publish/unpublish |
| L3: CDN (Vercel/Cloudflare) | 1 час | public rendered pages | on publish (revalidate webhook) |

### 10.2. Cache keys

```
q-cms:entry:{collectionId}:{entryId}:{locale}:{status}
q-cms:list:{collectionId}:{locale}:{filterHash}:{sortHash}
q-cms:media:{assetId}:{variantHash}
```

### 10.3. Invalidation

- `entry.publish` → DEL `entry:{id}:*` + DEL `list:{collectionId}:*` + NOTIFY в Postgres (для multi-node).
- `entry.update` (draft) → только L1.
- Media replace → DEL `media:{id}:*` + CDN purge.
- Tag-based: SCAN + DEL по pattern.

---

## 11. Realtime

### 11.1. SSE для публичных клиентов

```http
GET /api/v1/collections/articles/entries/42/stream
Accept: text/event-stream

event: update
data: {"version": 7, "title": "New title"}

event: publish
data: {"version": 8, "publishedAt": "2026-06-05T12:00:00Z"}
```

Сервер держит connection, шлёт update при LISTEN/NOTIFY из Postgres.

### 11.2. WebSocket для editor

- Отдельный app `collab/`.
- Hocuspocus + Y.js.
- Auth: JWT в URL query (`?token=...`).
- Per-entry комната, от 1 до 50 участников.

### 11.3. Dashboard metrics

Server-Sent Events для live-обновления дашборда (записей/мин, активных пользователей).

---

## 12. Internationalization

### 12.1. Архитектура

- **Контент:** per-field locale toggle (по умолчанию) + per-document locale (advanced).
- **UI:** 6 языков (en, ru, es, de, fr, zh), RTL-ready (ar, he в v1.5).
- **URL:** `/{locale}/...` в admin, в API — `?locale=`.

### 12.2. Хранение

- В одной таблице `entries` (строки на каждую locale).
- Fallback chain: `de-CH → de → en → 404`.
- В админке: tabs для переключения locale, индикатор заполненности.

### 12.3. Translation workflow (v1.5)

- Интеграция с DeepL/Google Translate API (opt-in).
- Bulk translate: action в админке.

---

## 13. Безопасность

### 13.1. Transport & Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; img-src 'self' https://*.s3.amazonaws.com; script-src 'self' 'nonce-...'
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### 13.2. Input validation

- Все входы — Zod schema (сгенерированная из content schema).
- Path traversal защита: media filenames — UUID, не user input.
- SQL injection — Drizzle (parameterized queries).
- XSS: TipTap sanitize HTML, content выдаётся как JSON, рендеринг на стороне клиента с экранированием.
- CSRF: SameSite=Lax cookies + double-submit token для state-changing запросов.
- SSRF: webhook URLs валидируются (no internal IPs), allowlist/denylist.

### 13.3. Rate limiting

- Global: 600 req/min / IP.
- Auth: 5 attempts / 15 min / IP.
- API token: configurable, default 1000 req/min.
- Webhooks: исходящие — 10/sec, retry с exponential backoff.

### 13.4. Compliance

- GDPR: data export (`GET /api/v1/users/{id}/export`), right to be forgotten (анонимизация).
- SOC2-ready: audit log, encryption, access control.
- HIPAA не в скоупе v1.0.

---

## 14. Производительность

### 14.1. Performance budget

| Метрика | Budget |
|---|---|
| JS (admin, gzipped) | ≤ 250 KB initial, ≤ 100 KB per route |
| CSS | ≤ 50 KB |
| Image payload (per page) | ≤ 1 MB |
| Database query (p95) | ≤ 20 мс |
| Cold start (serverless) | ≤ 500 мс |

### 14.2. Оптимизации

- **DB:** `EXPLAIN ANALYZE` для всех запросов > 5 мс в тестах. Partial indexes. Read replicas для тяжёлых list-views.
- **API:** компиляция запросов в prepared statements, dataloader для GraphQL N+1.
- **Admin UI:** React Server Components, минимизация client JS, dynamic imports.
- **Image:** AVIF+WebP, `loading="lazy"`, `decoding="async"`, responsive `srcset`.

### 14.3. Кэширование запросов

`getCachedEntry(id)` decorator:
```typescript
async getCachedEntry(id: string) {
  const key = `entry:${id}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  const entry = await db.query.entries.findFirst({ where: eq(entries.id, id) });
  await redis.setex(key, 300, JSON.stringify(entry));
  return entry;
}
```

---

## 15. Deployment

### 15.1. Self-hosted (1 vCPU / 512 MB baseline)

```bash
curl -fsSL https://q-cms.dev/install.sh | bash
# или
docker run -d --name q-cms \
  -e DATABASE_URL=postgres://... \
  -e REDIS_URL=redis://... \
  -e S3_ENDPOINT=... \
  -p 3000:3000 qcms/api:1.0
```

`docker-compose.yml` (prod-ready starter):

```yaml
version: '3.9'
services:
  api:
    image: qcms/api:1.0
    depends_on: [postgres, redis, meili]
    environment:
      DATABASE_URL: postgres://qcms:pass@postgres:5432/qcms
      REDIS_URL: redis://redis:6379
      MEILI_URL: http://meili:7700
      S3_ENDPOINT: http://minio:9000
      S3_BUCKET: media
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
      JWT_SECRET: ${JWT_SECRET}
    ports: ['3000:3000']

  admin:
    image: qcms/admin:1.0
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3000
    ports: ['3001:3000']

  collab:
    image: qcms/collab:1.0
    ports: ['3002:3000']

  worker:
    image: qcms/worker:1.0
    depends_on: [postgres, redis, meili]

  postgres:
    image: postgres:17-alpine
    volumes: ['pgdata:/var/lib/postgresql/data']
    environment:
      POSTGRES_DB: qcms
      POSTGRES_USER: qcms
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

  redis:
    image: redis:7-alpine
    command: ['redis-server', '--appendonly', 'yes']
    volumes: ['redisdata:/data']

  meili:
    image: getmeili/meilisearch:v1.10
    volumes: ['meilidata:/meili_data']
    environment:
      MEILI_MASTER_KEY: ${MEILI_MASTER_KEY}
      MEILI_ENV: production

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    volumes: ['miniodata:/data']
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY}

volumes:
  pgdata:
  redisdata:
  meilidata:
  miniodata:
```

### 15.2. Kubernetes (Helm)

`deploy/k8s/chart/q-cms/` с values.yaml для production-grade настройки (PDB, HPA, NetworkPolicy, ServiceMonitor, secrets через external-secrets-operator).

### 15.3. Managed (v1.5)

Multi-tenant SaaS: shared API, per-tenant Postgres schema (или row-level security), per-tenant S3 prefix, per-tenant Meili index.

### 15.4. CI/CD

- GitHub Actions: lint, test, build, scan, push image.
- Image registry: GitHub Container Registry (ghcr.io).
- Migrations: отдельный job, blue-green с reverse migration.
- Feature flags: через environment variable (PostHog или Unleash, опционально).

---

## 16. Observability

### 16.1. Metrics (Prometheus)

```
# API
q_cms_http_requests_total{method, route, status}
q_cms_http_request_duration_seconds{method, route}
q_cms_db_query_duration_seconds{query_type}
q_cms_redis_operation_duration_seconds{operation}
q_cms_cache_hits_total{cache_layer}
q_cms_cache_misses_total{cache_layer}

# Business
q_cms_entries_total{collection, status}
q_cms_publishes_total{collection}
q_cms_active_users
q_cms_media_storage_bytes

# Worker
q_cms_jobs_processed_total{queue, status}
q_cms_job_duration_seconds{queue}
```

### 16.2. Tracing

- OpenTelemetry SDK в API и worker.
- Sampling: 100% errors, 10% successful requests.
- Export: OTLP → Tempo / Jaeger / Honeycomb.
- Spans: HTTP request → DB queries → Redis calls → S3 calls.

### 16.3. Logs

- Структурированный JSON через Pino.
- Поля: `timestamp, level, service, request_id, user_id, trace_id, message, ...context`.
- Shipper: Vector или Promtail → Loki.

### 16.4. Error tracking

- Sentry SDK (opt-in, через env `SENTRY_DSN`).
- Source maps для API и admin.

---

## 17. Testing Strategy

### 17.1. Pyramid

```
        ╱╲
       ╱  ╲         E2E (Playwright) — 50 сценариев
      ╱ E2E╲
     ╱──────╲
    ╱ Integ. ╲      Integration (Vitest + testcontainers) — 300 тестов
   ╱──────────╲
  ╱   Unit     ╲   Unit (Vitest) — 2000+ тестов
 ╱──────────────╲
```

### 17.2. Coverage targets

- Lines: ≥ 80%
- Branches: ≥ 75%
- Critical paths (auth, publish, RBAC): 100%

### 17.3. Performance tests (k6)

- 10 RPS sustained, 100 RPS burst.
- Проверка p99 < 80 мс.
- Запускается в CI на каждый PR (если label `perf`).

### 17.4. Contract tests

- Pact между API и SDK: каждый breaking change в API ломает CI, если SDK не обновлён.

### 17.5. Security tests

- OWASP ZAP baseline scan на каждый release.
- Trivy на Docker images.
- Semgrep на код (правила: secrets, SQL injection, XSS).

---

## 18. CLI

```bash
# Создать проект
q-cms init my-blog
cd my-blog

# Запустить dev (Postgres, Redis, API, admin)
q-cms dev

# Сгенерировать types, миграции, GraphQL
q-cms codegen

# Создать миграцию
q-cms db:migrate create "add seo to article"

# Применить миграции
q-cms db:migrate

# Создать пользователя-админа
q-cms users:create admin@example.com --role admin

# Импорт контента
q-cms import articles.json

# Экспорт всего
q-cms export > backup-2026-06-05.json
```

CLI написан на Bun, использует `@q-cms/sdk` для type-safe операций.

---

## 19. SDK (public package)

### 19.1. Установка

```bash
npm install @q-cms/sdk
# или
pnpm add @q-cms/sdk
```

### 19.2. Использование

```typescript
import { createClient } from '@q-cms/sdk';

const cms = createClient({
  baseUrl: process.env.QCMS_URL!,
  token: process.env.QCMS_TOKEN!,
});

const articles = await cms.entries('Article')
  .where({ status: 'published' })
  .populate(['author', 'tags'])
  .get();

// React Query интеграция
import { useQcmsEntries } from '@q-cms/sdk/react';

function ArticleList() {
  const { data, isLoading } = useQcmsEntries('Article', {
    where: { status: 'published' },
    populate: ['author'],
  });
  if (isLoading) return <Spinner />;
  return <>{data.map(/* ... */)}</>;
}
```

### 19.3. Astro integration

```typescript
// astro.config.mjs
import qcms from '@q-cms/sdk/astro';
export default defineConfig({
  integrations: [qcms({ baseUrl: process.env.QCMS_URL })],
});
```

---

## 20. Configuration

### 20.1. Environment variables

| Var | Default | Required | Описание |
|---|---|---|---|
| `DATABASE_URL` | — | yes | Postgres connection string |
| `REDIS_URL` | — | yes | Redis connection string |
| `MEILI_URL` | — | yes | Meilisearch URL |
| `MEILI_MASTER_KEY` | — | yes | Meilisearch master key |
| `S3_ENDPOINT` | — | yes | S3 endpoint |
| `S3_BUCKET` | — | yes | S3 bucket name |
| `S3_ACCESS_KEY` | — | yes | S3 access key |
| `S3_SECRET_KEY` | — | yes | S3 secret key |
| `JWT_SECRET` | — | yes | JWT signing key (≥ 32 chars) |
| `ADMIN_URL` | `http://localhost:3001` | no | Admin UI URL (для CORS) |
| `API_URL` | `http://localhost:3000` | no | API URL |
| `PORT` | `3000` | no | API port |
| `NODE_ENV` | `development` | no | Environment |
| `LOG_LEVEL` | `info` | no | Pino log level |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | no | OTLP endpoint |
| `SENTRY_DSN` | — | no | Sentry DSN |
| `RATE_LIMIT_PER_MIN` | `600` | no | Global rate limit |
| `WEBHOOK_TIMEOUT_MS` | `10000` | no | Webhook timeout |
| `SMTP_HOST` | — | no | SMTP host |
| `SMTP_PORT` | `587` | no | SMTP port |
| `SMTP_USER` | — | no | SMTP user |
| `SMTP_PASS` | — | no | SMTP password |
| `EMAIL_FROM` | `noreply@q-cms.local` | no | From address |

---

## 21. Future / v2.0+

- **Vector search** (pgvector или Qdrant) для semantic search.
- **AI assist** в editor (GTE, opt-in).
- **Federation** между инстансами (для multi-brand).
- **Workflow builder** (visual).
- **Headless commerce** интеграция.
- **Mobile SDK** (React Native, Swift, Kotlin).
- **Static site generator** (встроенный SSG).
- **Edge functions** (пользовательский код выполняется на edge).

---

## 22. Open Architectural Decisions (ADR)

См. `docs/adr/`:
- ADR-001: выбрать Postgres вместо MongoDB
- ADR-002: Hono vs Fastify
- ADR-003: One-big-table для entries
- ADR-004: Meilisearch vs Elasticsearch
- ADR-005: TipTap vs Lexical vs Slate
- ADR-006: BullMQ vs Temporal vs Inngest
- ADR-007: Drizzle vs Prisma
- ADR-008: Bun-first, Node-compatible

---

## 23. Соглашения по разработке

### 23.1. Code style

- TypeScript strict, без `any` в публичных API.
- Функциональный стиль, минимизация классов (кроме domain entities).
- Именование: `camelCase` для переменных/функций, `PascalCase` для типов, `UPPER_SNAKE` для констант.
- Импорты: абсолютные (`@q-cms/core/...`), без relative `../../../`.
- Error handling: типизированные `Result<T, E>` для ожидаемых ошибок, throw для исключительных.

### 23.2. Commit & PR

- Conventional Commits.
- PR = 1 фича / 1 фикс.
- Обязательные checks: lint, typecheck, test, build.
- Squash-merge в main.

### 23.3. Branching

- Trunk-based: `main` (production) + feature branches (≤ 2 дня жизни).
- Release tags: `v1.0.0`.

---

## 24. Подтверждения

| Роль | Имя | Дата | Статус |
|---|---|---|---|
| Eng Lead | _tbd_ | 2026-06-05 | Pending |
| Architect | _tbd_ | 2026-06-05 | Pending |
| Security | _tbd_ | 2026-06-05 | Pending |
| SRE | _tbd_ | 2026-06-05 | Pending |
