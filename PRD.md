# PRD — Q-CMS

**Версия:** 1.0
**Дата:** 2026-06-05
**Статус:** Approved for build
**Владелец:** Product

---

## 1. Executive Summary

Q-CMS — это headless CMS с интегрированной админ-панелью и block-based редактором, ориентированная на команды, которым нужна скорость работы, гибкость контентной модели и предсказуемая производительность на edge. Продукт сочетает developer experience как у Sanity, производительность рендеринга как у Vercel Contentful, и on-prem возможность как у Strapi.

Ключевая идея: **content как блоки с типизированной схемой + REST/GraphQL API с инвалидацией в Redis + preview/SSR на edge**.

---

## 2. Problem Statement

Существующие CMS делятся на три класса с фундаментальными проблемами:

1. **WordPress / legacy CMS** — монолит, медленный, уязвимый, тяжело кастомизировать.
2. **Strapi / Directus** — гибкие, но тяжёлые (Node + 1+ GB RAM), медленный admin UI, не edge-ready.
3. **Sanity / Contentful** — быстрые, но vendor lock-in, дорогие на scale, ограниченный контроль данных.

**Неудовлетворённая потребность:** headless CMS, которая
- запускается одной командой и работает на 1 vCPU / 512 MB RAM;
- отдаёт контент с p99 < 80 мс из любой точки мира;
- имеет полноценный block-editor без компромиссов по UX;
- поддерживает self-hosted, on-prem, и managed режимы;
- не блокирует разработчика своей экосистемой плагинов.

---

## 3. Goals & Non-Goals

### Goals (must-have для v1.0)

| # | Цель | Метрика |
|---|---|---|
| G1 | Подъём за 5 минут | `docker compose up` → рабочая CMS |
| G2 | Производительный API | p99 GET /entries < 80 мс на 10k записей |
| G3 | Block-based редактор | 95% операций без перезагрузки страницы |
| G4 | Edge-ready SSR/ISR | TTFB публичной страницы < 100 мс |
| G5 | Type-safe контракт | автогенерация TS-типов из схемы контента |
| G6 | Realtime collaboration | одновременная правка 5+ авторов без конфликтов |
| G7 | RBAC + audit log | полная история изменений с diff |
| G8 | Self-hosted, no telemetry | 0 внешних запросов в базовой установке |

### Non-Goals (явно вне скоупа v1.0)

- ❌ Визуальный конструктор страниц в стиле Webflow
- ❌ Встроенный e-commerce / commerce-модуль
- ❌ Multi-tenant SaaS-режим (запланирован на v1.5)
- ❌ A/B testing из коробки (интеграция через webhook)
- ❌ Встроенный email-маркетинг / automation
- ❌ Полнотекстовый AI-поиск по смыслу (embeddings — в v2.0)

---

## 4. Target Users / Personas

### 4.1. Backend Developer (Daniil)
- Возраст: 25–35
- Опыт: 5+ лет, TypeScript/Go/Python
- Хочет: декларативную схему контента, автогенерацию типов, простой deploy
- Боль: Contentful дорогой, Strapi медленный, Sanity закрытый
- Критичные фичи: CLI, миграции, версионирование схемы, SSR SDK

### 4.2. Frontend Developer (Anya)
- Возраст: 22–32
- Опыт: React/Next.js, иногда Vue/Svelte
- Хочет: быстрый API, GraphQL или REST, готовые SDK, preview
- Боль: ждать бэкенд-команду, сложные запросы, нет preview
- Критичные фичи: GraphQL, real-time preview, webhooks, image transformations

### 4.3. Content Manager (Olga)
- Возраст: 30–50
- Опыт: WordPress, иногда Strapi
- Хочет: понятный UI, drag-and-drop, предпросмотр, медиа-менеджер
- Боль: медленная админка, потеря данных, сложный workflow
- Критичные фичи: autosave, undo, дублирование, расписание публикации

### 4.4. Tech Lead (Mark)
- Возраст: 32–45
- Опыт: 10+ лет, отвечает за инфраструктуру
- Хочет: self-hosted, понятная архитектура, логи в SIEM, RBAC
- Боль: vendor lock-in, аудит-требования, compliance
- Критичные фичи: SSO/SAML, audit log, экспорт всего, бэкапы

---

## 5. User Stories

### 5.1. Управление контентом

```
US-01: Как content manager, я хочу создать статью с блоками (текст, фото, видео, код)
       чтобы не думать о вёрстке и публиковать быстро.

US-02: Как content manager, я хочу видеть автосохранение каждые 3 секунды
       чтобы не потерять текст при сбое браузера.

US-03: Как content manager, я хочу дублировать страницу
       чтобы быстро делать похожие материалы.

US-04: Как content manager, я хочу расписание публикации
       чтобы статья появилась на сайте в нужный час.

US-05: Как content manager, я хочу undo/redo на 50 шагов
       чтобы безопасно экспериментировать.
```

### 5.2. Контентная модель

```
US-06: Как backend developer, я хочу задать схему контента в TypeScript или JSON
       чтобы получить автогенерацию типов и миграции.

US-07: Как backend developer, я хочу relations между коллекциями
       чтобы собирать сложные графы (автор → статьи → теги → статьи).

US-08: Как backend developer, я хочу локализуемые поля
       чтобы один документ имел переводы на N языков.

US-09: Как backend developer, я хочу custom validators
       чтобы проверять доменную логику (например, slug = уникальный).
```

### 5.3. API и интеграции

```
US-10: Как frontend developer, я хочу GraphQL API
       чтобы запрашивать ровно те поля, что нужны.

US-11: Как frontend developer, я хочу preview-токен со сроком жизни
       чтобы видеть неопубликованный контент.

US-12: Как frontend developer, я хочу webhooks на publish/unpublish
       чтобы триггерить редеплой Next.js / Nuxt.

US-13: Как frontend developer, я хочу image transformations on-the-fly
       чтобы не хранить 10 копий одной картинки.
```

### 5.4. Безопасность и администрирование

```
US-14: Как tech lead, я хочу RBAC с гранулярными правами
       чтобы контент-менеджеры не ломали схему.

US-15: Как tech lead, я хочу audit log всех изменений
       чтобы соответствовать требованиям SOC2.

US-16: Как tech lead, я хочу SSO через SAML/OIDC
       чтобы интегрироваться с корпоративным IdP.

US-17: Как tech lead, я хочу бэкап в один клик (S3-compatible)
       чтобы соблюдать RPO ≤ 1 час.
```

### 5.5. Совместная работа

```
US-18: Как content manager, я хочу видеть, кто сейчас редактирует документ
       чтобы не перезатереть чужую работу.

US-19: Как content manager, я хочу оставлять inline-комментарии
       чтобы согласовывать текст с редактором.

US-20: Как content manager, я хочу workflow approve/publish
       чтобы junior-авторы не публиковали без ревью.
```

---

## 6. Functional Requirements

### 6.1. Контентная модель (FR-CM)

| ID | Требование | Приоритет |
|---|---|---|
| FR-CM-01 | Коллекции (collections) с произвольными полями | P0 |
| FR-CM-02 | Single-types (singleton, например "Settings") | P0 |
| FR-CM-03 | 25+ типов полей: text, richtext, number, boolean, date, datetime, json, enum, media, relation, repeatable, component, geo, color, password, email, url, uid, slug, blocks | P0 |
| FR-CM-04 | Локализация полей (per-field locale toggle) | P0 |
| FR-CM-05 | Relations: one-to-one, one-to-many, many-to-many, many-to-ways | P0 |
| FR-CM-06 | Components (переиспользуемые группы полей) | P0 |
| FR-CM-07 | Dynamic zones (polymorphic blocks) | P0 |
| FR-CM-08 | Custom UID/slug с regex-валидаторами | P0 |
| FR-CM-09 | Draft & Publish (двухстадийная публикация) | P0 |
| FR-CM-10 | Versioning (полная история версий с diff) | P1 |
| FR-CM-11 | Scheduled publish (cron в BullMQ) | P1 |
| FR-CM-12 | Content import/export (JSON, CSV) | P1 |

### 6.2. Редактор (FR-ED)

| ID | Требование | Приоритет |
|---|---|---|
| FR-ED-01 | Block-based editor на базе TipTap (ProseMirror) | P0 |
| FR-ED-02 | Блоки: paragraph, heading, image, gallery, video, code, quote, list, table, embed, callout, divider, accordion, tabs, form, button, spacer, custom | P0 |
| FR-ED-03 | Slash-команды для вставки блоков (`/image`, `/quote`) | P0 |
| FR-ED-04 | Drag-and-drop reorder блоков | P0 |
| FR-ED-05 | Inline-toolbar (выделение → bold/italic/link) | P0 |
| FR-ED-06 | Bubble-menu с форматированием | P0 |
| FR-ED-07 | Markdown-подобный ввод (`**bold**` → bold) | P0 |
| FR-ED-08 | Code block с подсветкой (Shiki) и выбором языка | P0 |
| FR-ED-09 | Embed: YouTube, Vimeo, Twitter, CodePen, Spotify | P0 |
| FR-ED-10 | Image с focal point и captions (alt обязателен) | P0 |
| FR-ED-11 | Custom blocks (TypeScript API для разработчиков) | P1 |
| FR-ED-12 | Multi-column layout (1/2/3/4 колонки) | P1 |
| FR-ED-13 | AI-assist (опционально, отключаемый модуль v1.5) | P2 |

### 6.3. API (FR-API)

| ID | Требование | Приоритет |
|---|---|---|
| FR-API-01 | REST: `GET /api/v1/entries`, `POST /api/v1/entries`, `PATCH`, `DELETE` | P0 |
| FR-API-02 | GraphQL: единая endpoint `/api/v1/graphql` (queries, mutations, subscriptions) | P0 |
| FR-API-03 | Фильтрация: `?filter[status]=published&filter[author]=eq.123` | P0 |
| FR-API-04 | Сортировка: `?sort=-publishedAt,title` | P0 |
| FR-API-05 | Пагинация: cursor-based + offset/limit | P0 |
| FR-API-06 | Populate relations: `?populate=author,author.avatar,tags` | P0 |
| FR-API-07 | Fields projection: `?fields=id,title,slug,author.name` | P0 |
| FR-API-08 | Locale: `?locale=ru,en` (с fallback) | P0 |
| FR-API-09 | Draft preview: `?status=draft&token=...` | P0 |
| FR-API-10 | Webhooks: configurable events, retry с exponential backoff | P0 |
| FR-API-11 | Rate limiting (Redis token bucket): 60 req/min default, настраивается | P0 |
| FR-API-12 | Bulk operations: `POST /api/v1/bulk` (до 100 операций) | P1 |
| FR-API-13 | SDK: `@q-cms/sdk` (TypeScript, type-safe) | P0 |
| FR-API-14 | CLI: `q-cms` (init, schema push, content import) | P0 |

### 6.4. Аутентификация и авторизация (FR-AUTH)

| ID | Требование | Приоритет |
|---|---|---|
| FR-AUTH-01 | Email + пароль с bcrypt (cost 12) | P0 |
| FR-AUTH-02 | Magic link (email) | P0 |
| FR-AUTH-03 | API tokens (PAT, scoped) | P0 |
| FR-AUTH-04 | OAuth 2.0: Google, GitHub, Microsoft | P1 |
| FR-AUTH-05 | OIDC / SAML 2.0 SSO | P1 |
| FR-AUTH-06 | RBAC: роли (admin, editor, author, viewer) + custom | P0 |
| FR-AUTH-07 | Field-level permissions (например, author видит только свои записи) | P1 |
| FR-AUTH-08 | 2FA (TOTP) | P1 |
| FR-AUTH-09 | Session management: revoke, device list | P0 |
| FR-AUTH-10 | Rate limit на login: 5 попыток / 15 мин / IP | P0 |

### 6.5. Медиа (FR-MEDIA)

| ID | Требование | Приоритет |
|---|---|---|
| FR-MEDIA-01 | Upload: drag-and-drop, multi-file, paste from clipboard | P0 |
| FR-MEDIA-02 | Storage: S3-compatible (AWS S3, MinIO, Cloudflare R2, Backblaze B2) | P0 |
| FR-MEDIA-03 | Image processing: resize, crop, format convert (WebP/AVIF), blur placeholder | P0 |
| FR-MEDIA-04 | Focal point: визуальный пикер | P0 |
| FR-MEDIA-05 | Alt text обязателен | P0 |
| FR-MEDIA-06 | Folder hierarchy + tag-based организация | P0 |
| FR-MEDIA-07 | Hot-link protection (signed URLs TTL) | P0 |
| FR-MEDIA-08 | Видео: streaming через HLS, thumbnail generation | P1 |
| FR-MEDIA-09 | PDF preview (первая страница) | P1 |
| FR-MEDIA-10 | Virus scan (ClamAV integration) | P1 |

### 6.6. Workflow (FR-WF)

| ID | Требование | Приоритет |
|---|---|---|
| FR-WF-01 | Статусы: draft → in_review → approved → published → archived | P0 |
| FR-WF-02 | Workflow transitions с permissions (кто может approve) | P0 |
| FR-WF-03 | Reviewer assignment (notify по email) | P1 |
| FR-WF-04 | Scheduled publish (через BullMQ delayed job) | P1 |
| FR-WF-05 | Bulk operations (publish 50 статей за раз) | P1 |

### 6.7. Аналитика и observability (FR-OBS)

| ID | Требование | Приоритет |
|---|---|---|
| FR-OBS-01 | Audit log: кто, что, когда, до/после (diff) | P0 |
| FR-OBS-02 | OpenTelemetry traces | P0 |
| FR-OBS-03 | Prometheus metrics (`/metrics`) | P0 |
| FR-OBS-04 | Structured JSON logs | P0 |
| FR-OBS-05 | Error tracking (Sentry SDK, отключаемый) | P0 |
| FR-OBS-06 | Встроенный дашборд: количество записей, активные пользователи, размер медиа | P1 |

---

## 7. Non-Functional Requirements

### 7.1. Производительность (NFR-PERF)

| ID | Метрика | Целевое значение |
|---|---|---|
| NFR-PERF-01 | API p50 latency (read) | < 20 мс |
| NFR-PERF-02 | API p99 latency (read) | < 80 мс |
| NFR-PERF-03 | API p99 latency (write) | < 250 мс |
| NFR-PERF-04 | API throughput | ≥ 5 000 RPS на 2 vCPU |
| NFR-PERF-05 | Public page TTFB (с edge cache) | < 100 мс |
| NFR-PERF-06 | Admin UI TTI (Time to Interactive) | < 1.5 с |
| NFR-PERF-07 | Editor keystroke → rendered | < 16 мс (60 fps) |
| NFR-PERF-08 | Search latency | < 50 мс (p95) |
| NFR-PERF-09 | Image transform (1920w WebP) | < 200 мс |

### 7.2. Масштабирование (NFR-SCALE)

| ID | Метрика | Целевое значение |
|---|---|---|
| NFR-SCALE-01 | Кол-во entries в одной коллекции | до 10 млн |
| NFR-SCALE-02 | Кол-во коллекций | до 500 |
| NFR-SCALE-03 | Кол-во локалей | до 50 |
| NFR-SCALE-04 | Хранилище медиа | до 100 TB |
| NFR-SCALE-05 | Concurrent admin users | 200 на инстанс |
| NFR-SCALE-06 | Horizontal API scaling | linear до 16 нод |

### 7.3. Надёжность (NFR-REL)

| ID | Метрика | Целевое значение |
|---|---|---|
| NFR-REL-01 | Availability SLO | 99.9% (43 мин простоя / месяц) |
| NFR-REL-02 | RPO (Recovery Point Objective) | ≤ 5 мин (WAL streaming) |
| NFR-REL-03 | RTO (Recovery Time Objective) | ≤ 30 мин |
| NFR-REL-04 | MTTR (Mean Time To Recover) | ≤ 15 мин |
| NFR-REL-05 | Zero-downtime deploy | required |

### 7.4. Безопасность (NFR-SEC)

| ID | Требование |
|---|---|
| NFR-SEC-01 | OWASP Top 10 — закрыть все категории |
| NFR-SEC-02 | CSP, HSTS, X-Frame-Options по умолчанию |
| NFR-SEC-03 | Все секреты через env / vault (нет в репо) |
| NFR-SEC-04 | Dependencies: еженедельный SCA-сканинг |
| NFR-SEC-05 | Penetration test перед GA |
| NFR-SEC-06 | Соответствие GDPR: data export, right to be forgotten |
| NFR-SEC-07 | Encryption at rest (БД, S3) |
| NFR-SEC-08 | TLS 1.3 only |

### 7.5. Удобство сопровождения (NFR-MAINT)

| ID | Требование |
|---|---|
| NFR-MAINT-01 | Code coverage ≥ 80% |
| NFR-MAINT-02 | E2E покрытие критических сценариев |
| NFR-MAINT-03 | TypeScript strict mode, 0 `any` в публичных API |
| NFR-MAINT-04 | Документация API: OpenAPI 3.1 + GraphQL SDL |
| NFR-MAINT-05 | ADR (Architecture Decision Records) для ключевых решений |

### 7.6. Интернационализация (NFR-I18N)

| ID | Требование |
|---|---|
| NFR-I18N-01 | UI на 6 языках (en, ru, es, de, fr, zh) |
| NFR-I18N-02 | RTL-поддержка (ar, he) |
| NFR-I18N-03 | Контент: любое число локалей на проект |
| NFR-I18N-04 | Локализация полей (per-field) и компонентов |
| NFR-I18N-05 | i18n routing: `/en/...`, `/ru/...` |
| NFR-I18N-06 | Timezone-aware timestamps |

### 7.7. Доступность (NFR-A11Y)

| ID | Требование |
|---|---|
| NFR-A11Y-01 | WCAG 2.2 AA compliance для admin UI |
| NFR-A11Y-02 | Клавиатурная навигация для всех операций |
| NFR-A11Y-03 | Screen reader support (NVDA, VoiceOver) |
| NFR-A11Y-04 | Цветовой контраст ≥ 4.5:1 |

---

## 8. Success Metrics

### 8.1. Бизнес-метрики (через 6 месяцев после GA)

- **Adoption:** 1 000 self-hosted установок, 50 managed-клиентов
- **Engagement:** ≥ 60% WAU / MAU среди managed-клиентов
- **Retention:** ≥ 75% retention на 3-й месяц
- **NPS:** ≥ 50
- **Time to first entry:** ≤ 10 мин после установки

### 8.2. Технические метрики

- **P95 API latency:** < 50 мс (read), < 200 мс (write)
- **Uptime:** ≥ 99.9% за 90 дней
- **Critical bugs open:** ≤ 2
- **Mean time to first response (support):** ≤ 4 ч (business hours)

### 8.3. Метрики качества (community)

- GitHub stars: ≥ 5 000
- Contributors: ≥ 50 external PRs merged
- Documentation coverage: 100% публичных API

---

## 9. Constraints

| Тип | Ограничение |
|---|---|
| Бюджет инфраструктуры | Self-hosted должен работать на 1 vCPU / 512 MB |
| Лицензия | Core — MIT, Enterprise-модули — коммерческие |
| Бэкенд runtime | Node.js 22+ ИЛИ Bun 1.1+ |
| БД | PostgreSQL 16+ (только) |
| Браузеры (admin) | Chrome 110+, Firefox 110+, Safari 16+, Edge 110+ |
| Node.js LTS | 22.x (active LTS на момент GA) |
| Никаких SaaS-зависимостей | Базовый self-hosted не должен слать ничего в third-party (Sentry и т.п. — opt-in) |

---

## 10. Release Phases

См. [ROADMAP.md](./ROADMAP.md) для деталей.

| Фаза | Scope | Дата |
|---|---|---|
| **v0.1 — Alpha** | Базовый CRUD, REST API, auth, Postgres | T+0 |
| **v0.3 — Beta** | Block editor, GraphQL, Media, RBAC | T+2 мес |
| **v0.7 — RC** | Workflow, Audit, Versioning, Preview, Webhooks | T+4 мес |
| **v1.0 — GA** | SSO, OIDC, Realtime collab, все P0/P1 | T+6 мес |
| **v1.5** | Multi-tenant SaaS, AI-assist, Advanced search | T+9 мес |
| **v2.0** | Vector search, Commerce integration, Federation | T+12 мес |

---

## 11. Open Questions

| # | Вопрос | Владелец | Статус |
|---|---|---|---|
| OQ-01 | Поддерживать ли MongoDB как альтернативу Postgres? | Eng Lead | Rejected (v1.0) — технический долг |
| OQ-02 | Встроенный marketplace плагинов? | Product | Rejected (v1.0) — фокус на core |
| OQ-03 | Поддержка Astro adapter наравне с Next.js? | Eng | Accepted (v0.7) |
| OQ-04 | GraphQL subscriptions для realtime? | Eng | Accepted (v1.0) |
| OQ-05 | Где хранить большие блобы (>5 MB JSON)? | Eng | Postgres TOAST (до 1 GB) — v1.0; S3 multipart — v1.5 |
| OQ-06 | i18n-стратегия: per-field vs per-document? | Product | Per-field (default), per-document (advanced) |
| OQ-07 | Версионирование схемы (semver в JSON-схеме)? | Eng | Accepted (v1.0) |

---

## 12. Glossary

| Термин | Определение |
|---|---|
| **Entry** | Конкретный документ в коллекции (например, статья с id 42) |
| **Collection** | Тип контента (например, "Article", "Author") |
| **Component** | Переиспользуемая группа полей (например, "SEO-meta") |
| **Dynamic zone** | Массив разнотипных блоков (полиморфный) |
| **Locale** | Язык контента (ru, en, de...) |
| **Draft & Publish** | Двухстадийная модель: draft (виден в admin) → published (виден в API) |
| **UID** | Уникальный читаемый идентификатор (slug) |
| **Headless** | CMS без своего фронтенда — только API + admin |
| **Block** | Единица контента в editor (paragraph, image, gallery...) |
| **Webhook** | HTTP-колбэк при событии (entry.publish, entry.update) |

---

## 13. Approvals

| Роль | Имя | Дата | Статус |
|---|---|---|---|
| Product | _tbd_ | 2026-06-05 | Pending |
| Eng Lead | _tbd_ | 2026-06-05 | Pending |
| Design | _tbd_ | 2026-06-05 | Pending |
| Security | _tbd_ | 2026-06-05 | Pending |
