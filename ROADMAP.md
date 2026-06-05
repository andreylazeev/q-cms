# ROADMAP — Q-CMS

**Версия:** 1.0
**Дата:** 2026-06-05
**Стратегия:** MVP-driven, customer-feedback driven

---

## 1. Обзор релизов

| Версия | Кодовое имя | Тип | Цель | Дата GA |
|---|---|---|---|---|
| v0.1 | Seed | Alpha | Базовый CRUD, REST, auth, Postgres | T+0 (8 нед) |
| v0.3 | Sprout | Beta | Block editor, GraphQL, Media, RBAC | T+2 мес |
| v0.5 | Bloom | RC | Workflow, Audit, Versioning, Preview, Webhooks | T+4 мес |
| v0.7 | Thrive | RC-candidate | Realtime collab, SSO, OIDC, Search | T+5 мес |
| v1.0 | Harvest | **GA** | Production-ready, SLA, Managed preview | T+6 мес |
| v1.5 | Forest | Minor | Multi-tenant SaaS, AI-assist, Video | T+9 мес |
| v2.0 | Cosmos | Major | Vector search, Federation, Marketplace | T+12 мес |

---

## 2. v0.1 — Seed (Alpha, T+0)

**Цель:** Проверить core hypotheses. Получить первых 10 alpha-тестеров.

### 2.1. Scope (must-have)

- [ ] Базовый `schema.ts` с collections, полями (text, richtext, number, boolean, date, media, relation)
- [ ] REST API: CRUD для entries + list с фильтрами/сортировкой/пагинацией
- [ ] Auth: email/password, JWT
- [ ] Postgres + Drizzle, миграции
- [ ] Простой admin UI на Next.js: список записей, форма редактирования (plain textarea)
- [ ] Docker Compose для dev-окружения
- [ ] `q-cms init` CLI

### 2.2. Out of scope (для v0.1)

- Block editor
- GraphQL
- Media upload
- Webhooks
- Workflow
- Audit log
- Multi-locale

### 2.3. Метрики успеха

- [ ] Подъём из `docker compose up` ≤ 5 минут
- [ ] p99 API < 200 мс (расслабленный, до оптимизаций)
- [ ] 10 alpha-тестеров с issues/PRs

---

## 3. v0.3 — Sprout (Beta, T+2 мес)

**Цель:** Полноценный content editing. Текст, картинки, базовая структура.

### 3.1. Scope

- [ ] **Block editor (TipTap):** paragraph, heading, image, code, quote, list, embed
- [ ] **Inline toolbar** и **slash commands**
- [ ] **Media:** upload в S3-compatible, базовые variants (thumbnail, large)
- [ ] **Image transformations:** Sharp, on-the-fly
- [ ] **GraphQL API:** queries, mutations
- [ ] **RBAC:** 4 pre-defined роли (admin, editor, author, viewer)
- [ ] **Multi-locale:** per-field, fallback
- [ ] **Admin UI:** просмотр/редактирование/публикация
- [ ] **Docs:** Quickstart, basic usage

### 3.2. Метрики

- [ ] p99 API < 100 мс
- [ ] Editor TTI < 2 с
- [ ] 50 active beta-тестеров

---

## 4. v0.5 — Bloom (RC, T+4 мес)

**Цель:** Production-ready features. Workflow, история, интеграции.

### 4.1. Scope

- [ ] **Workflow:** draft → review → approved → published
- [ ] **Reviewer assignment** + email-уведомления
- [ ] **Audit log:** полная история с diff
- [ ] **Versioning:** полные снапшоты, restore
- [ ] **Preview tokens** для draft
- [ ] **Webhooks** исходящие (entry.create/update/publish/delete) с retry
- [ ] **Email:** magic links, notifications (SMTP)
- [ ] **2FA** (TOTP)
- [ ] **API tokens** (PAT)
- [ ] **Bulk operations**
- [ ] **Import/Export** (JSON, CSV)
- [ ] **Search** (Meilisearch, базовый)

### 4.2. Метрики

- [ ] Uptime 99.5% (на staging)
- [ ] 0 critical bugs в release notes

---

## 5. v0.7 — Thrive (RC-candidate, T+5 мес)

**Цель:** Realtime, security, observability.

### 5.1. Scope

- [ ] **Realtime collab** (Y.js + Hocuspocus)
- [ ] **SSO/OIDC** (OIDC standard)
- [ ] **SAML 2.0** (enterprise)
- [ ] **GraphQL subscriptions** (SSE транспорт)
- [ ] **OpenTelemetry** traces + Prometheus metrics + Grafana dashboard
- [ ] **Sentry** integration (opt-in)
- [ ] **Vector search** (pgvector, basic)
- [ ] **Faceted search**
- [ ] **Custom blocks** (developer API)
- [ ] **CLI:** `q-cms codegen`, `q-cms schema push`

### 5.2. Security audit

- [ ] Внутренний security review
- [ ] OWASP ZAP baseline
- [ ] Penetration test (внешний, light)
- [ ] Зависимости: SCA scan (Snyk/Trivy)

### 5.3. Метрики

- [ ] Uptime 99.9% (на staging с нагрузкой)
- [ ] Все P0/P1 фичи закрыты

---

## 6. v1.0 — Harvest (GA, T+6 мес)

**Цель:** Production GA. Self-hosted корпоративного уровня. Managed preview.

### 6.1. Scope

- [ ] **Hardening:** fuzzing, stress tests, chaos engineering
- [ ] **Documentation:** полная (architecture, ops, dev, security)
- [ ] **SLA:** 99.9% uptime
- [ ] **Helm chart** production-ready
- [ ] **Migration guide** с Strapi/Directus
- [ ] **Examples:** Next.js, Nuxt, Astro, SvelteKit
- [ ] **SDK** (npm): `@q-cms/sdk` с TS-типами
- [ ] **Landing page** + **marketing site**
- [ ] **Community:** GitHub Discussions, Discord
- [ ] **Managed preview** (limited beta, 10 клиентов)
- [ ] **Pricing** (self-hosted free, managed tiers)
- [ ] **Status page** (status.q-cms.dev)
- [ ] **GDPR/SOC2 readiness:** docs, controls

### 6.2. Метрики

- [ ] 100 production установок
- [ ] 10 managed-клиентов
- [ ] NPS ≥ 50
- [ ] Critical bugs open = 0

### 6.3. Promotion criteria из RC → GA

- ✅ Все P0/P1 requirements закрыты (PRD §6, §7)
- ✅ Code coverage ≥ 80%
- ✅ Performance budget соблюдён (NFR-PERF)
- ✅ Security audit pass
- ✅ Disaster recovery drill пройден
- ✅ Документация: Quickstart, Tutorial, Reference, Operations
- ✅ 2 production кейса (case studies)

---

## 7. v1.5 — Forest (T+9 мес)

### 7.1. Scope

- [ ] **Multi-tenant SaaS** режим
- [ ] **AI-assist** в editor (opt-in): перевод, summarize, fix grammar
- [ ] **Video processing** (ffmpeg, HLS)
- [ ] **Incoming webhooks** для интеграций
- [ ] **Workflow builder** (visual)
- [ ] **Marketplace** плагинов (1.0 — скелет, 1.5 — каталог)
- [ ] **Mobile SDK** (React Native starter)
- [ ] **SSO improvements:** SCIM provisioning
- [ ] **Backups UI** (настройка, restore из админки)
- [ ] **Audit log UI** (поиск, фильтры, экспорт)

### 7.2. Метрики

- [ ] 500 managed-клиентов
- [ ] ARR ≥ $500k

---

## 8. v2.0 — Cosmos (T+12 мес)

### 8.1. Scope

- [ ] **Vector search** (pgvector или Qdrant)
- [ ] **Semantic search:** "найди статьи про X"
- [ ] **Federation** между инстансами
- [ ] **Headless commerce** интеграция (Stripe, Medusa, Saleor)
- [ ] **Edge functions** (пользовательский код)
- [ ] **Visual page builder** (опционально, opt-in модуль)
- [ ] **Static Site Generator** встроенный
- [ ] **i18n improvements:** translation memory, glossary

### 8.2. Метрики

- [ ] 2000 managed-клиентов
- [ ] ARR ≥ $2M

---

## 9. Continuous (между релизами)

### 9.1. Engineering

- Dependency updates (еженедельно, Dependabot)
- Security patches (немедленно)
- Performance regressions (alert на p99 > 100 мс)
- Tech debt reduction (1 sprint из 6 целиком на долг)

### 9.2. Community

- Ответы на issues (≤ 2 рабочих дня)
- PR review (≤ 5 рабочих дней)
- Office hours (раз в 2 недели в Discord)
- Roadmap updates (ежемесячно)

### 9.3. Customer success

- Migration assistance (Strapi, Directus, Contentful)
- Custom integrations (за отдельную плату)
- Training / workshops

---

## 10. Риски и зависимости

| Риск | Вероятность | Impact | Митигация |
|---|---|---|---|
| TipTap breaking changes | medium | high | Pinning, свой fork, тесты на ProseMirror schema |
| Postgres lock contention | medium | medium | Connection pooler (PgBouncer), partitioning |
| Meilisearch scaling issues | low | medium | Готовность мигрировать на Typesense/ES |
| Open-source токсичность | medium | medium | Code of Conduct, contribution guidelines, модерирование |
| Vendor adoption (managed) | high | high | Маркетинг, контент, partnerships |
| Безопасность | medium | critical | Bug bounty, регулярные аудиты |
| Single-maintainer bus factor | high | critical | Knowledge sharing, документация, code review |

---

## 11. Скоупы, которые мы НЕ будем делать (никогда)

Чтобы команда не размывалась:

- ❌ Конструктор сайтов типа Webflow / Framer
- ❌ Полноценная e-commerce платформа (интегрируемся, не делаем)
- ❌ A/B testing из коробки
- ❌ Email-маркетинг
- ❌ CRM
- ❌ Form builder с логикой
- ❌ No-code для всего
- ❌ MongoDB / MySQL (только Postgres)
- ❌ PHP (только TS/Bun)
- ❌ Self-hosted UI на Vue/Svelte (только React/Next.js для admin)

---

## 12. Зависимости от сторонних проектов

| Проект | Критичность | Митигация |
|---|---|---|
| TipTap | high | Форкнуть при необходимости |
| Hono | high | Минимальный, легко форкнуть |
| Drizzle | high | Простой код, миграции на SQL — форк реально |
| Postgres | critical | Поддерживать 16+ (1 major версия) |
| Bun | high | Node 22 LTS fallback |
| Meilisearch | medium | Готовы мигрировать на Typesense |
| BullMQ | medium | Замена на встроенный scheduler + Redis Streams |
| Hocuspocus | medium | Замена на свой WebSocket-сервер с Y.js |
| Better Auth | medium | Кастомный auth-слой не критичен |
