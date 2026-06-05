# STACK — Обоснование технологического выбора Q-CMS

**Версия:** 1.0
**Дата:** 2026-06-05

Документ фиксирует, *почему* выбран каждый компонент стека. Альтернативы и trade-off рассмотрены ниже. Решения задокументированы как ADR в `docs/adr/`.

---

## Принципы выбора

1. **Performance first.** p99 API < 80 мс — hard requirement. Все решения оцениваются через этот фильтр.
2. **Type safety.** Один источник правды (TypeScript), strict mode, нет `any` в публичных API.
3. **Edge-ready.** Возможность деплоя на edge runtime (Cloudflare Workers, Vercel Edge, Deno Deploy).
4. **Self-hostable.** Базовый сценарий работает на 1 vCPU / 512 MB. Никаких SaaS-зависимостей по умолчанию.
5. **Open core, open source.** MIT на core. Vendor lock-in — антипаттерн.
6. **Pragmatism over purity.** Решения принимаются по принципу "что работает хорошо для CMS в 2026", а не "что самое модное".

---

## 1. Runtime: Bun (primary) / Node.js 22 LTS (fallback)

### Решение: **Bun 1.1+** как primary runtime, **Node.js 22 LTS** как fallback.

### Почему

| Фактор | Bun | Node.js 22 |
|---|---|---|
| Startup time | ~50 ms | ~500 ms |
| HTTP throughput | ~3-4× быстрее | baseline |
| Native TypeScript | ✅ | ❌ (нужен ts-node/tsx) |
| Built-in SQLite/Redis/S3 клиенты | ✅ | ❌ |
| Совместимость с npm-пакетами | 99% | 100% |
| Production stability | growing (1.x) | battle-tested |
| Long-term support | community | guaranteed LTS |

### Trade-off

Bun 1.x — относительно молодой, но уже используется в production у крупных компаний. Поддерживаем **обе** runtime: на Node 22 падаем автоматически, если Bun не установлен.

### Источники

- Bun benchmarks: https://bun.sh/docs/cli/bench
- Hono benchmarks показывают 3-4× преимущество Bun

### Альтернативы рассмотрены

- **Deno** — отличный, но меньше npm-совместимости, нет LTS-гарантий, экосистема меньше.
- **Node.js 22 only** — проще, но теряем performance.

---

## 2. HTTP framework: Hono

### Решение: **Hono 4.x**

### Почему

- **Размер:** ~14 KB, минимум overhead.
- **Скорость:** топ-3 в benchmarks (https://web-frameworks-benchmark.netlify.app/).
- **Edge-ready:** работает на Cloudflare Workers, Vercel Edge, Deno, Bun, Node.
- **DX:** отличная типизация, middleware chain, declarative routes.
- **No dependencies:** zero runtime deps.
- **Type-safe RPC:** `hc.client<typeof routes>()` для type-safe вызовов (используем внутри monorepo).

### Альтернативы

| Framework | Verdict |
|---|---|
| **Express** | Legacy, нет async-first, нет TS |
| **Fastify** | Хорош, но не edge-ready, больше размер |
| **Koa** | Слишком минималистичный |
| **tRPC** | Отличный для internal API, но избыточен для public CMS API |
| **NestJS** | Тяжёлый, opinionated, не edge |
| **Hono** | ✅ выбран |

### Trade-off

Hono — не самый популярный, но активно растёт. Документация отличная. Риск: маленькое community. Митигация: наш код минимально зависит от Hono internals (через адаптеры).

---

## 3. Frontend: Next.js 15 (App Router) + React 19

### Решение: **Next.js 15** + **React 19**

### Почему

- **Server Components:** RSC снижает bundle size admin UI на 40-60%.
- **Server Actions:** упрощают мутации без API routes для внутренних операций.
- **Streaming SSR:** TTFB < 200 мс для admin страниц.
- **App Router:** nested layouts, parallel routes, intercepting routes.
- **React 19:** useOptimistic, useTransition, suspense improvements.
- **Vercel-native:** zero-config deploy.

### Альтернативы

| Framework | Verdict |
|---|---|
| **Remix** | Хорош, но меньше community |
| **Astro (для admin)** | Не подходит — admin интерактивный |
| **Vite + React Router** | Слишком low-level для быстрой разработки admin |
| **Next.js 15** | ✅ выбран |

### Trade-off

Next.js — opinionated, привязывает к Vercel (но self-host возможен). Документация — лучшая в индустрии.

---

## 4. Стилизация: Tailwind CSS 4 + shadcn/ui

### Решение: **Tailwind 4** + **shadcn/ui** (Radix-based компоненты)

### Почему

- **Tailwind 4:** Oxide engine (Rust), в 10× быстрее генерация CSS, on-demand utilities.
- **shadcn/ui:** копируемые компоненты (не npm-пакет), owner-owned, легко кастомизировать, доступны по умолчанию.
- **Radix Primitives:** accessibility WCAG AA out of the box.
- **CSS Variables:** тримынг design tokens в runtime (light/dark).

### Альтернативы

| Стек | Verdict |
|---|---|
| **CSS Modules** | Boilerplate-ный |
| **styled-components** | Runtime overhead, несовместим с RSC |
| **Mantine** | Хорошая, но vendor lock-in на тему |
| **Material UI** | Тяжёлая, opinionated |
| **Tailwind 4 + shadcn** | ✅ выбрано |

---

## 5. ORM: Drizzle ORM

### Решение: **Drizzle ORM 0.36+**

### Почему

- **Pure SQL, no magic:** миграции — это `*.sql` файлы, читаемые человеком.
- **Type-safe:** схема в TS → типы автогенерируются.
- **Zero runtime overhead:** ~25 KB, нет lazy loading.
- **Serverless-friendly:** работает на edge.
- **Mature:** 1.0 в 2024, активное community.

### Альтернативы

| ORM | Verdict |
|---|---|
| **Prisma** | Отличный DX, но binary engine, медленный cold start, не edge |
| **Kysely** | Type-safe query builder, но не ORM (нет relations) |
| **TypeORM** | Legacy, decorators, плохой TS |
| **MikroORM** | Хорош, но overhead |
| **Drizzle** | ✅ выбран |

### Trade-off

Drizzle — относительно молодой, экосистема меньше чем у Prisma. Документация растёт.

---

## 6. Database: PostgreSQL 17

### Решение: **PostgreSQL 17**

### Почему

- **JSONB** для динамических схем контента (одна таблица на все entries).
- **FTS** (full-text search) с GIN-индексами — fallback для Meilisearch.
- **LISTEN/NOTIFY** — нативный pub/sub для realtime.
- **Generated columns** — denormalized поля для индексации.
- **Point-in-time recovery** — бэкапы.
- **Partitioning** — для масштабирования.
- **Extensions:** pg_trgm, pgvector (v2.0), PostGIS (geo).

### Альтернативы

| DB | Verdict |
|---|---|
| **MySQL** | Слабее JSON, нет LISTEN/NOTIFY, partitioning сложнее |
| **SQLite** | Только single-node, не для production |
| **MongoDB** | Сложнее consistency, vendor lock-in (Atlas) |
| **CockroachDB** | Распределённая, но overhead |
| **PostgreSQL 17** | ✅ выбран |

### Минимальная версия

Postgres 16+ (для `gen_random_uuid()` из коробки и `jsonb_path_ops`).

---

## 7. Cache & Pub/Sub: Redis 7

### Решение: **Redis 7.x**

### Почему

- **Универсальность:** cache + rate limit + sessions + pub/sub + queue.
- **Скорость:** in-memory, sub-ms latency.
- **Lua scripting:** атомарные операции (rate limit).
- **Streams + BullMQ:** durable queues.
- **Sentinel / Cluster:** HA.

### Альтернативы

| Опция | Verdict |
|---|---|
| **Memcached** | Проще, но нет pub/sub, нет persistence |
| **Dragonfly** | Быстрее, но молодой, vendor |
| **KeyDB** | Форк Redis, активная разработка прекратилась |
| **Redis 7** | ✅ выбран |

---

## 8. Search: Meilisearch

### Решение: **Meilisearch 1.10+**

### Почему

- **Скорость:** < 50 мс latency на миллионах записей.
- **Простота:** один бинарь, минимум конфигурации.
- **Typo tolerance:** из коробки.
- **Faceting:** нативная поддержка.
- **Ranking:** настраиваемые правила.
- **REST API:** простая интеграция.

### Альтернативы

| Поиск | Verdict |
|---|---|
| **Elasticsearch** | Мощный, но тяжёлый (1+ GB RAM baseline), сложный |
| **Algolia** | SaaS, дорогой, vendor lock-in |
| **Typesense** | Хорошая альтернатива, но меньше community |
| **Postgres FTS** | Базовый, fallback (без typo tolerance) |
| **Meilisearch** | ✅ выбран |

### Trade-off

Meilisearch — in-memory (для скорости), но поддерживает снапшоты. Для multi-TB — Elasticsearch (но v1.0 не наша цель).

---

## 9. Queue: BullMQ

### Решение: **BullMQ 5.x**

### Почему

- **Production-grade:** retry, backoff, delayed jobs, repeatable jobs, concurrency.
- **Redis-based:** уже есть в стеке.
- **Dashboard:** Bull Board (опционально).
- **TypeScript-native.**

### Альтернативы

| Queue | Verdict |
|---|---|
| **Celery** | Python-only |
| **Sidekiq** | Ruby |
| **Inngest** | SaaS, нет self-hosted |
| **Temporal** | Мощный, но overkill для CMS |
| **BullMQ** | ✅ выбран |

---

## 10. Storage: S3-compatible

### Решение: **S3-compatible API** (AWS S3, Cloudflare R2, MinIO, Backblaze B2)

### Почему

- **Стандарт:** S3 API — фактический стандарт object storage.
- **Свобода выбора:** пользователь выбирает провайдера.
- **Cost-effective:** R2 без egress fees, B2 в 4× дешевле S3.

### Альтернативы

| Storage | Verdict |
|---|---|
| **Filesystem** | Только для dev, не для production |
| **GCS** | Vendor lock-in |
| **Azure Blob** | Vendor lock-in |
| **S3-compatible** | ✅ выбран |

---

## 11. Editor: TipTap (ProseMirror)

### Решение: **TipTap 2.x**

### Почему

- **Headless:** рендеринг отдельно от state model.
- **Proven:** ProseMirror — 10+ лет в production, используется Atlassian, NYT, GitHub.
- **Расширяемость:** custom nodes, marks, extensions — без форка.
- **Collaboration-ready:** Y.js интеграция из коробки.
- **TypeScript-first.**

### Альтернативы

| Editor | Verdict |
|---|---|
| **Lexical (Meta)** | Молодой, отличный, но экосистема меньше |
| **Slate** | Гибкий, но "unsupported" с 2020 |
| **Quill** | Legacy, не collaborative |
| **Editor.js** | Block-first, но не WYSIWYG |
| **TipTap** | ✅ выбран |

### Trade-off

TipTap — opinionated, ProseMirror-кривая обучения. Альтернатива Lexical — отличный backup, миграция возможна.

---

## 12. Realtime Collab: Y.js + Hocuspocus

### Решение: **Y.js 13** + **Hocuspocus 2**

### Почему

- **CRDT:** conflict-free, offline-ready, peer-to-peer aware.
- **Battle-tested:** используется Notion, Figma, Evernote.
- **Hocuspocus:** production сервер с persistence, auth, webhooks.
- **TypeScript support.**

### Альтернативы

| Технология | Verdict |
|---|---|
| **Automerge** | Медленнее Y.js на больших документах |
| **ShareDB (OT)** | Сложнее, требует центрального сервера |
| **Liveblocks** | SaaS, дорого |
| **Y.js + Hocuspocus** | ✅ выбрано |

---

## 13. Auth: Better Auth

### Решение: **Better Auth 1.x**

### Почему

- **Batteries-included:** sessions, OAuth, OIDC, SAML, 2FA, magic links, API tokens.
- **TypeScript-first.**
- **Pluggable:** Drizzle adapter, свои стратегии.
- **Self-hostable.**

### Альтернативы

| Auth | Verdict |
|---|---|
| **Auth.js (NextAuth)** | Хорош, но заточен под Next.js |
| **Clerk** | SaaS, дорого |
| **Supabase Auth** | Vendor lock-in |
| **Lucia** | Low-level, требует много glue-кода |
| **Keycloak** | Java, тяжёлый |
| **Better Auth** | ✅ выбран |

### Trade-off

Better Auth — относительно молодой (1.0 в 2024), но быстро растёт. Митигация: thin wrapper, легко заменить.

---

## 14. Validation: Zod

### Решение: **Zod 3.x**

### Почему

- **Единый источник правды:** schema → types + validators.
- **TypeScript inference:** `z.infer<typeof Schema>`.
- **Mature, большая экосистема.**
- **Производительность:** 2-3× медленнее Valibot, но приемлемо.

### Альтернативы

| Lib | Verdict |
|---|---|
| **Valibot** | Быстрее, но меньше фич |
| **ArkType** | Быстрее, но молодой |
| **Yup** | Legacy |
| **Joi** | Node-only, не TS |
| **Zod** | ✅ выбран |

---

## 15. Мониторинг: OpenTelemetry + Prometheus + Pino

### Решение: **OpenTelemetry SDK** + **prom-client** + **Pino**

### Почему

- **OpenTelemetry:** vendor-neutral (Tempo, Jaeger, Honeycomb, Datadog).
- **prom-client:** стандарт для Prometheus.
- **Pino:** самая быстрая JSON-библиотека, low overhead.

### Альтернативы

| Стек | Verdict |
|---|---|
| **Sentry-only** | Vendor, дорого |
| **Datadog APM** | Vendor, дорого |
| **Custom logging** | Отсутствие стандартизации |
| **OTel + Prom + Pino** | ✅ выбрано |

---

## 16. CI/CD: GitHub Actions

### Решение: **GitHub Actions** + **Docker BuildKit** + **ArgoCD** (опционально)

### Почему

- **Native для GitHub:** PR checks, releases, packages.
- **Бесплатно** для open source.
- **Self-hosted runners** при необходимости.

### Альтернативы

| CI | Verdict |
|---|---|
| **GitLab CI** | Хорош, но не везде |
| **CircleCI** | Vendor, дорого |
| **Jenkins** | Legacy |
| **GitHub Actions** | ✅ выбрано |

---

## 17. Containerization & Orchestration

### Решение: **Docker** (multi-stage) + **Docker Compose** (dev) + **Helm chart** (prod k8s)

### Почему

- **Multi-stage builds** минимизируют image size.
- **Helm** — стандарт для Kubernetes.
- **Docker Compose** — zero-friction dev experience.

---

## 18. Язык: TypeScript strict

### Решение: **TypeScript 5.6+, strict mode**

Конфиг:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

### Почему

- **Один язык** для всего стека (кроме SQL DDL).
- **Strict mode** ловит баги на этапе компиляции.
- **Branded types** для domain primitives (`UserId`, `EntryId`).

---

## 19. Что мы НЕ используем и почему

| Технология | Почему нет |
|---|---|
| **GraphQL Yoga** | Hono + graphql.js достаточно |
| **tRPC** | Public API должен быть стандартным (REST + GraphQL) |
| **Apollo Server** | Тяжёлый, vendor lock-in на Federation |
| **Hasura** | Vendor lock-in, opinionated |
| **PostgREST** | Не даёт полноценный admin UI |
| **Directus** | Мы — альтернатива Directus |
| **Strapi** | Мы — альтернатива Strapi |
| **Payload CMS** | Хорош, но мы делаем нашу архитектуру |
| **MongoDB** | Postgres строго лучше для CMS |
| **Redis Cluster** | Sentinel достаточно для v1.0 |
| **Kubernetes (по умолчанию)** | Docker Compose для small/medium |
| **GraphQL Code Generator** | Свой pipeline (schema.ts → SDL) |
| **Storybook** | Только если вырастет до нужды |
| **Cypress** | Playwright лучше |
| **Jest** | Vitest быстрее |

---

## 20. Заключение

Выбранный стек — это **производительность + DX + open-source** в одном флаконе. Каждое решение trade-off осознанный, не из-за хайпа. Все компоненты могут быть заменены через адаптеры без переписывания доменной логики.

Главные риски:
1. Bun production-readiness (митигация: Node 22 fallback).
2. TipTap breaking changes (митигация: форк).
3. Meilisearch scaling (митигация: миграция на Typesense/ES при необходимости).

Главные преимущества:
1. **p99 API < 80 мс** достижимо (Bun + Hono + Drizzle + Redis).
2. **Self-hosted за 5 минут** достижимо (Docker Compose).
3. **Type-safe от schema до SDK** достижимо (TypeScript + Drizzle + Zod + GraphQL).
4. **Edge-ready** достижимо (Hono + Drizzle на Postgres через Hyperdrive/Neon).
