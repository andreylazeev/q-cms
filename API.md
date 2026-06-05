# API — Q-CMS

**Версия:** 1.0
**Дата:** 2026-06-05

API Q-CMS. Двойной интерфейс: REST (основной) + GraphQL (для сложных графов). Оба генерируются из одной content schema.

---

## 1. Базовый URL и версионирование

```
Production:  https://{tenant}.q-cms.dev/api/v1
Self-hosted: https://{host}/api/v1
```

- URL-versioned: `/api/v1/...` (v1 — пока продукт < 1.0).
- После v1.0: Content Negotiation `Accept: application/vnd.q-cms.v2+json` с fallback на v1 в течение 6 месяцев.
- Deprecated endpoints помечаются в ответе: `Deprecation: true`, `Sunset: 2026-12-31`.

---

## 2. Аутентификация

### 2.1. Bearer JWT (основной)

```http
GET /api/v1/collections/articles/entries
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

JWT содержит:
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "roles": ["editor"],
  "scopes": ["read:entries", "write:entries"],
  "iat": 1717584000,
  "exp": 1717585800
}
```

TTL: 15 минут. Refresh через `POST /api/v1/auth/refresh` (httpOnly cookie).

### 2.2. API Token (PAT)

```http
GET /api/v1/collections/articles/entries
Authorization: Bearer qcs_abc123def456...
```

Префикс `qcs_` — для обнаружения в логах. Сам токен хранится в БД только как SHA-256 hash.

### 2.3. Magic link

```http
POST /api/v1/auth/magic-link
{ "email": "user@example.com" }
```

Email содержит ссылку `https://{host}/auth/verify?token=...` (TTL 15 мин, одноразовый).

### 2.4. Session cookie (SPA)

Admin UI использует httpOnly Secure SameSite=Lax cookie. CSRF через double-submit token.

---

## 3. REST API

### 3.1. Список endpoints

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/v1/auth/me` | Текущий пользователь |
| `POST` | `/api/v1/auth/login` | Логин email/password |
| `POST` | `/api/v1/auth/logout` | Выход |
| `POST` | `/api/v1/auth/refresh` | Refresh JWT |
| `POST` | `/api/v1/auth/magic-link` | Запрос magic link |
| `POST` | `/api/v1/auth/2fa/enable` | Включить 2FA |
| `POST` | `/api/v1/auth/2fa/verify` | Подтвердить 2FA код |
| `GET` | `/api/v1/users` | Список пользователей (admin) |
| `POST` | `/api/v1/users` | Создать пользователя |
| `GET` | `/api/v1/users/{id}` | Получить пользователя |
| `PATCH` | `/api/v1/users/{id}` | Обновить |
| `DELETE` | `/api/v1/users/{id}` | Удалить |
| `POST` | `/api/v1/users/{id}/roles` | Назначить роль |
| `GET` | `/api/v1/roles` | Список ролей |
| `POST` | `/api/v1/api-tokens` | Создать API token |
| `GET` | `/api/v1/api-tokens` | Список токенов |
| `DELETE` | `/api/v1/api-tokens/{id}` | Revoke |
| `GET` | `/api/v1/collections` | Список коллекций (метаданные) |
| `GET` | `/api/v1/collections/{slug}` | Схема коллекции |
| `GET` | `/api/v1/collections/{slug}/entries` | Список entries |
| `POST` | `/api/v1/collections/{slug}/entries` | Создать entry |
| `GET` | `/api/v1/collections/{slug}/entries/{id}` | Получить entry |
| `PATCH` | `/api/v1/collections/{slug}/entries/{id}` | Обновить |
| `DELETE` | `/api/v1/collections/{slug}/entries/{id}` | Удалить |
| `POST` | `/api/v1/collections/{slug}/entries/{id}/publish` | Опубликовать |
| `POST` | `/api/v1/collections/{slug}/entries/{id}/unpublish` | Снять с публикации |
| `POST` | `/api/v1/collections/{slug}/entries/{id}/duplicate` | Дублировать |
| `GET` | `/api/v1/collections/{slug}/entries/{id}/revisions` | Список ревизий |
| `POST` | `/api/v1/collections/{slug}/entries/{id}/revisions/{ver}/restore` | Восстановить |
| `GET` | `/api/v1/singletons/{slug}` | Получить singleton |
| `PUT` | `/api/v1/singletons/{slug}` | Обновить singleton |
| `GET` | `/api/v1/media` | Список медиа |
| `POST` | `/api/v1/media` | Upload (multipart) |
| `GET` | `/api/v1/media/{id}` | Метаданные медиа |
| `PATCH` | `/api/v1/media/{id}` | Обновить (alt, tags) |
| `DELETE` | `/api/v1/media/{id}` | Удалить |
| `GET` | `/api/v1/media/{id}/variants` | Список variants |
| `GET` | `/api/v1/media/{id}/render` | Трансформированное изображение (см. § 8) |
| `GET` | `/api/v1/search` | Полнотекстовый поиск |
| `GET` | `/api/v1/webhooks` | Список webhooks |
| `POST` | `/api/v1/webhooks` | Создать webhook |
| `PATCH` | `/api/v1/webhooks/{id}` | Обновить |
| `DELETE` | `/api/v1/webhooks/{id}` | Удалить |
| `GET` | `/api/v1/webhooks/{id}/deliveries` | История доставки |
| `POST` | `/api/v1/webhooks/{id}/deliveries/{deliveryId}/retry` | Повторить |
| `GET` | `/api/v1/audit-log` | Audit log |
| `GET` | `/api/v1/health` | Liveness |
| `GET` | `/api/v1/ready` | Readiness |
| `GET` | `/api/v1/metrics` | Prometheus metrics |
| `GET` | `/api/v1/graphql` | GraphQL endpoint |
| `POST` | `/api/v1/graphql` | GraphQL endpoint |
| `WS` | `/api/v1/collab/{entryId}` | Realtime collab |

### 3.2. Фильтрация, сортировка, пагинация

#### Фильтрация (RQL — Q-CMS Query Language)

```
GET /entries?filter[status]=published
GET /entries?filter[author.email]=eq.anna@example.com
GET /entries?filter[publishedAt]=gt.2026-01-01
GET /entries?filter[title][contains]=hello
GET /entries?filter[status][in]=draft,review
GET /entries?filter[and][0][status]=published&filter[and][1][category.slug]=tech
GET /entries?filter[or][0][author.id]=uuid1&filter[or][1][author.id]=uuid2
```

Операторы: `eq, ne, gt, gte, lt, lte, in, nin, contains, startsWith, endsWith, isNull, isNotNull, between, overlaps (для массивов)`.

#### Сортировка

```
GET /entries?sort=-publishedAt,title
```

`-` — DESC. До 5 полей.

#### Пагинация (cursor-based, default)

```
GET /entries?page[limit]=20&page[cursor]=eyJpZCI6IjEyMyIsInB1Ymxpc2hlZEF0IjoiMjAyNi0wNi0wNSJ9

Response:
{
  "data": [...],
  "meta": {
    "pageInfo": {
      "hasNext": true,
      "hasPrev": false,
      "startCursor": "...",
      "endCursor": "..."
    },
    "totalCount": 1234
  }
}
```

Offset-based (legacy):
```
GET /entries?page[offset]=0&page[limit]=20
```

#### Populate (relations)

```
GET /entries?populate=author,tags,category
GET /entries?populate[author]=fields(name,avatar),populate[author.avatar]=fields(url)
GET /entries?populate=*&populate[author][maxDepth]=3
```

Shorthand:
- `populate=*` — все relations первого уровня
- `populate=*.*` — рекурсивно с maxDepth 2
- `populate[author][fields]=name,avatar` — проекция полей

#### Fields projection

```
GET /entries?fields=id,title,slug,author.name,author.avatar.url
```

#### Locale

```
GET /entries?locale=ru
GET /entries?locale=ru,en   # fallback: ru → en
```

#### Status

```
GET /entries?status=published      # default
GET /entries?status=draft,review   # multiple
GET /entries?status=*              # все (admin only)
```

#### Draft preview

```
GET /entries/{id}?preview=true&token=...
```

Token выдаётся через `POST /api/v1/auth/preview-token` с правами `read:entries` на конкретный entry. TTL 24 часа.

### 3.3. Формат ответа

**Single resource:**
```json
{
  "data": {
    "id": "uuid",
    "type": "Article",
    "attributes": {
      "title": "Hello, world",
      "slug": "hello-world",
      "excerpt": "...",
      "content": [...],
      "publishedAt": "2026-06-05T12:00:00Z"
    },
    "relationships": {
      "author": { "data": { "type": "Author", "id": "uuid" } },
      "tags": { "data": [{ "type": "Tag", "id": "uuid" }, ...] }
    },
    "meta": {
      "status": "published",
      "locale": "ru",
      "version": 7,
      "createdAt": "...",
      "updatedAt": "..."
    }
  },
  "included": [
    {
      "type": "Author",
      "id": "uuid",
      "attributes": { "name": "Anna", "email": "..." },
      "relationships": { "avatar": { "data": { "type": "Media", "id": "uuid" } } }
    }
  ]
}
```

**Collection:**
```json
{
  "data": [
    { "id": "uuid", "type": "Article", "attributes": {...}, ... }
  ],
  "included": [...],
  "meta": {
    "pageInfo": { ... },
    "totalCount": 1234,
    "facets": {
      "author.email": { "anna@example.com": 12, ... }
    }
  }
}
```

### 3.4. Ошибки

```json
{
  "errors": [
    {
      "id": "req_uuid",
      "status": "422",
      "code": "validation_failed",
      "title": "Validation failed",
      "detail": "Field 'slug' must be unique",
      "source": { "pointer": "/data/attributes/slug" },
      "meta": {
        "fields": {
          "slug": ["must be unique in collection 'Article'"]
        }
      }
    }
  ]
}
```

Стандартные коды:
- `400` — bad request
- `401` — unauthorized
- `403` — forbidden
- `404` — not found
- `409` — conflict (duplicate, optimistic locking)
- `422` — validation failed
- `429` — rate limit
- `500` — internal error
- `503` — service unavailable

### 3.5. Bulk operations

```http
POST /api/v1/bulk
Content-Type: application/vnd.q-cms.bulk+json

{
  "atomic": false,
  "operations": [
    { "op": "create", "ref": "a1", "resource": "Article", "data": { "title": "1" } },
    { "op": "create", "ref": "a2", "resource": "Article", "data": { "title": "2" } },
    { "op": "publish", "ref": "p1", "resource": "Article", "id": "..." }
  ]
}

Response:
{
  "results": [
    { "ref": "a1", "status": 201, "data": {...} },
    { "ref": "a2", "status": 422, "errors": [...] },
    { "ref": "p1", "status": 200, "data": {...} }
  ]
}
```

До 100 операций за запрос. Если `atomic: true` — всё в одной транзакции (иначе независимо).

### 3.6. OpenAPI 3.1

Спецификация генерируется из `schema.ts` + роутера. Доступна:
- `GET /api/v1/openapi.json` — машиночитаемая
- `GET /api/v1/docs` — Swagger UI (включается флагом `DOCS_ENABLED=true`)

---

## 4. GraphQL API

### 4.1. Endpoint

```
POST /api/v1/graphql
Content-Type: application/json

{
  "query": "query { ... }",
  "variables": { ... },
  "operationName": "..."
}
```

### 4.2. Schema (генерируемая)

```graphql
type Query {
  me: User!
  user(id: ID!): User
  users(first: Int, after: String, filter: UserFilter): UserConnection!
  collection(slug: String!): Collection
  collections: [Collection!]!
  entries(
    collection: String!,
    status: EntryStatus = PUBLISHED,
    locale: String,
    filter: EntryFilter,
    sort: [SortInput!],
    first: Int,
    after: String
  ): EntryConnection!
  entry(id: ID!, status: EntryStatus = PUBLISHED): Entry
  search(query: String!, collection: String, locale: String, first: Int): SearchResult!
  media(id: ID!): Media
  medias(filter: MediaFilter, first: Int): MediaConnection!
}

type Mutation {
  createEntry(collection: String!, input: JSON!): Entry!
  updateEntry(id: ID!, input: JSON!): Entry!
  deleteEntry(id: ID!): Boolean!
  publishEntry(id: ID!): Entry!
  unpublishEntry(id: ID!): Entry!
  uploadMedia(file: Upload!, metadata: JSON): Media!
  createUser(input: CreateUserInput!): User!
  ...
}

type Subscription {
  entryUpdated(id: ID!): Entry!
  entriesChanged(collection: String!): EntryChangeEvent!
  dashboardMetrics: MetricsUpdate!
}
```

### 4.3. Пример query

```graphql
query ArticleList($locale: String!) {
  entries(
    collection: "Article"
    status: PUBLISHED
    locale: $locale
    first: 20
    sort: [{ field: "publishedAt", direction: DESC }]
  ) {
    edges {
      node {
        id
        title
        slug
        excerpt
        publishedAt
        author {
          name
          avatar { url(transform: { width: 64, height: 64, format: WEBP }) }
        }
        tags { name slug }
        content {
          ... on Heading { level text }
          ... on Image {
            url(transform: { width: 1280, format: WEBP })
            alt
            caption
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

### 4.4. N+1 prevention

GraphQL resolver использует DataLoader для batch-подгрузки relations:
- `EntryByIdLoader` (1 SQL запрос на пачку, а не N)
- `AuthorByIdLoader`
- `MediaByIdLoader`

### 4.5. Persisted queries (v1.5)

Apollo-style persisted queries: client заранее регистрирует query hash → шлёт короткий hash вместо полного query. Экономит трафик и предотвращает DoS.

### 4.6. GraphQL Subscriptions

WebSocket (graphql-ws protocol):

```javascript
import { createClient } from 'graphql-ws';

const client = createClient({ url: 'wss://cms.example.com/api/v1/graphql' });

const subscription = client.iterate({
  query: `subscription { entryUpdated(id: "...") { id title } }`,
});

for await (const result of subscription) {
  console.log(result);
}
```

---

## 5. SSE (Server-Sent Events)

### 5.1. Entry updates

```http
GET /api/v1/entries/{id}/stream
Accept: text/event-stream

event: update
id: 7
data: {"version": 7, "title": "New title"}

event: publish
id: 8
data: {"version": 8, "publishedAt": "2026-06-05T12:00:00Z"}

: heartbeat every 30s
```

### 5.2. Dashboard

```http
GET /api/v1/dashboard/stream
Accept: text/event-stream

event: metrics
data: {"entriesLastMinute": 12, "activeUsers": 5, ...}
```

---

## 6. Webhooks (исходящие)

### 6.1. Подписки

События: `entry.create, entry.update, entry.publish, entry.unpublish, entry.delete, media.upload, media.processed, user.invite, ...`

### 6.2. Формат payload

```json
{
  "event": "entry.publish",
  "id": "evt_xyz",
  "createdAt": "2026-06-05T12:00:00Z",
  "apiVersion": "v1",
  "data": {
    "collection": "Article",
    "entry": {
      "id": "uuid",
      "title": "...",
      "slug": "...",
      "locale": "ru"
    },
    "actor": {
      "id": "user-uuid",
      "email": "anna@example.com"
    }
  }
}
```

### 6.3. Подпись

```http
X-Q-CMS-Event: entry.publish
X-Q-CMS-Delivery: evt_xyz
X-Q-CMS-Signature: sha256=hex_encoded_hmac
X-Q-CMS-Timestamp: 1717584000
```

Подпись: `HMAC-SHA256(secret, timestamp + "." + body)`.

### 6.4. Retry policy

- `2xx` → success
- `4xx` → не retry (клиентская ошибка)
- `5xx, timeout, network` → retry по exp backoff: 1m, 5m, 30m, 2h, 12h, 24h
- После `maxAttempts` (default 3) → status `exhausted`, уведомление в admin

### 6.5. Incoming webhooks (v1.5)

Зарегистрировать endpoint для приёма событий от внешних систем (например, GitHub) — для интеграций. Схема определяется пользователем.

---

## 7. Search API

```http
GET /api/v1/search?q=hello&collection=Article&locale=ru&limit=10&offset=0&filter[author]=anna
```

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "Article",
      "attributes": { "title": "Hello, world", "excerpt": "..." },
      "meta": { "score": 0.95, "highlights": { "title": "<em>Hello</em>, world" } }
    }
  ],
  "meta": {
    "query": "hello",
    "total": 42,
    "processingTimeMs": 12,
    "facets": {
      "author": { "anna@example.com": 5 }
    }
  }
}
```

---

## 8. Image API (transformations)

```http
GET /api/v1/media/{id}/render?w=1280&h=720&fit=cover&format=webp&q=85&focal=0.5,0.3
```

Параметры:
- `w` — ширина (px)
- `h` — высота (px)
- `fit` — `cover, contain, fill, inside, outside` (default `cover`)
- `format` — `webp, avif, jpeg, png, auto` (default `auto` по Accept)
- `q` — качество 1-100
- `focal` — focal point `x,y` в долях (0-1)
- `blur` — Gaussian blur 1-100

Response: `image/webp` (или указанный), `Cache-Control: public, max-age=31536000, immutable`, `ETag: ...`.

### 8.1. Предустановленные варианты (presets)

```
GET /api/v1/media/{id}/render?preset=hero        # 1920x1080 webp q=85
GET /api/v1/media/{id}/render?preset=thumb-small  # 64x64 webp q=80
```

Presets настраиваются в `schema.ts`.

---

## 9. Error tracking & rate limits

### 9.1. Rate limit headers

```http
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 597
X-RateLimit-Reset: 1717584060
X-RateLimit-Policy: 600;w=60
```

При превышении:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

### 9.2. Request ID

Каждый запрос получает `X-Request-ID` (UUID v7). В ответе — `X-Request-ID`. Помогает искать в логах.

---

## 10. SDK Examples

### 10.1. TypeScript

```typescript
import { createClient } from '@q-cms/sdk';

const cms = createClient({
  baseUrl: 'https://cms.example.com',
  token: process.env.QCMS_TOKEN!,
  locale: 'ru',
});

// List
const { data, pageInfo } = await cms.entries('Article')
  .where({ status: 'published' })
  .populate(['author', 'tags'])
  .fields(['id', 'title', 'slug', 'author.name', 'tags'])
  .sort('-publishedAt')
  .limit(20)
  .get();

// Get one
const article = await cms.entries('Article').get('uuid-or-slug');

// Create
const created = await cms.entries('Article').create({
  title: 'New article',
  slug: 'new-article',
  content: [...],
});

// Update
await cms.entries('Article').update('uuid', { title: 'Updated' });

// Publish
await cms.entries('Article').publish('uuid');

// Upload
const file = new File([...], 'photo.jpg', { type: 'image/jpeg' });
const media = await cms.media.upload(file, { alt: 'Description' });
```

### 10.2. React Query integration

```typescript
import { useQcmsEntry, useQcmsEntries } from '@q-cms/sdk/react';

function ArticlePage({ slug }: { slug: string }) {
  const { data: article, isLoading, error } = useQcmsEntry('Article', slug, {
    populate: ['author', 'tags'],
  });

  if (isLoading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <ArticleView article={article} />;
}
```

### 10.3. Next.js App Router

```typescript
// app/articles/[slug]/page.tsx
import { createClient } from '@q-cms/sdk';

const cms = createClient({ baseUrl: process.env.QCMS_URL!, token: process.env.QCMS_TOKEN! });

export default async function Page({ params }: { params: { slug: string } }) {
  const article = await cms.entries('Article').get(params.slug, {
    populate: ['author', 'tags'],
  });
  return <article>...</article>;
}

export async function generateStaticParams() {
  const { data } = await cms.entries('Article').where({ status: 'published' }).fields(['slug']).get();
  return data.map(({ slug }) => ({ slug }));
}
```

С revalidation через webhook:
```typescript
// app/api/revalidate/route.ts
export async function POST(req: Request) {
  const { collection, entry } = await req.json();
  if (collection === 'Article') {
    revalidatePath(`/articles/${entry.slug}`);
    revalidatePath('/articles');
  }
  return new Response('OK');
}
```

---

## 11. Health checks

### 11.1. Liveness

```http
GET /api/v1/health
200 OK
{ "status": "ok", "uptime": 12345 }
```

### 11.2. Readiness

```http
GET /api/v1/ready
200 OK
{
  "status": "ok",
  "checks": {
    "postgres": "ok (12ms)",
    "redis": "ok (1ms)",
    "meilisearch": "ok (8ms)",
    "s3": "ok (45ms)"
  }
}
```

503 если хотя бы один check fail.

---

## 12. Deprecation policy

Когда endpoint устаревает:
1. Помечается `Deprecation: true` и `Sunset: 2026-12-31` в headers.
2. Логируется каждое использование.
3. Через 3 месяца добавляется warning в response body.
4. Через 6 месяцев endpoint удаляется, но major version поддерживается параллельно ещё 6 месяцев.
