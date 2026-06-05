# Q-CMS

> Headless CMS нового поколения. Block-first, API-first, edge-ready.

[![CI](https://github.com/q-cms/q-cms/actions/workflows/ci.yml/badge.svg)](https://github.com/q-cms/q-cms/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript: strict](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org)

Q-CMS — это headless CMS с интегрированной админ-панелью и block-based редактором, ориентированная на команды, которым нужна скорость работы, гибкость контентной модели и предсказуемая производительность на edge.

## ⚡ Quick start

```bash
# 1. Clone & install
git clone https://github.com/q-cms/q-cms.git
cd q-cms
pnpm install

# 2. Boot infrastructure (Postgres, Redis, Meilisearch, MinIO)
pnpm docker:up

# 3. Migrate & seed
pnpm db:migrate
pnpm db:seed

# 4. Start dev servers
pnpm dev
# → API:      http://localhost:3000
# → Admin UI: http://localhost:3001

# 5. Default admin: admin@q-cms.local / changeme
```

## 📦 What's inside

```
q-cms/
├── apps/
│   ├── api/        # Hono REST + GraphQL API
│   ├── admin/      # Next.js 15 admin UI
│   ├── worker/     # BullMQ background workers
│   ├── collab/     # Hocuspocus realtime server
│   └── cli/        # q-cms command-line tool
├── packages/
│   ├── core/       # Domain types, Result, errors
│   ├── db/         # Drizzle schema + repositories
│   ├── auth/       # JWT, password, RBAC
│   ├── sdk/        # Public TypeScript SDK
│   ├── api-client/ # Internal HTTP client
│   ├── editor/     # TipTap editor config
│   ├── ui/         # Shared React components
│   ├── media/      # S3 + Sharp pipeline
│   ├── search/     # Meilisearch wrapper
│   ├── schema/     # Content schema parser
│   ├── shared/     # Shared utilities
│   └── config/     # Shared env config
└── tests/
    ├── integration/  # Testcontainers-based E2E
    └── e2e/          # Playwright browser tests
```

## 🛠 Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Bun 1.1+** / Node 22 LTS | Fastest startup, native TS |
| HTTP | **Hono 4** | Edge-ready, ~14KB, top performance |
| Admin UI | **Next.js 15** + React 19 | RSC, Server Actions, streaming |
| ORM | **Drizzle** | Type-safe SQL, zero runtime overhead |
| DB | **PostgreSQL 17** | JSONB, FTS, LISTEN/NOTIFY |
| Cache | **Redis 7** | Sessions, rate limit, queue |
| Search | **Meilisearch** | Typo-tolerant, <50ms |
| Queue | **BullMQ** | Retry, delayed, repeatable jobs |
| Storage | **S3-compatible** | AWS S3, R2, MinIO, B2 |
| Editor | **TipTap 2** | ProseMirror, collab-ready |
| Realtime | **Y.js** + **Hocuspocus** | CRDT, peer-to-peer aware |
| Auth | **jose** + **bcrypt** | JWT, password hashing |
| Validation | **Zod 3** | Single source of truth |
| Tests | **Vitest** + **Playwright** + **testcontainers** | Fast unit + real integration |

## 📊 NFR targets

| Metric | Target |
|---|---|
| API p50 latency (read) | < 20 ms |
| API p99 latency (read) | < 80 ms |
| API throughput | ≥ 5 000 RPS on 2 vCPU |
| Public page TTFB (edge cache) | < 100 ms |
| Admin UI TTI | < 1.5 s |
| Editor keystroke → render | < 16 ms (60 fps) |
| Cold start (serverless) | < 500 ms |
| Test coverage | ≥ 80% |
| Uptime SLO | 99.9% |

## 📚 Documentation

- [PRD.md](./PRD.md) — Product Requirements
- [SPEC.md](./SPEC.md) — Technical Specification
- [ARCHITECTURE.md](./ARCHITECTURE.md) — C4 diagrams + flows
- [DATA_MODEL.md](./DATA_MODEL.md) — Full SQL schema
- [API.md](./API.md) — REST + GraphQL contract
- [ROADMAP.md](./ROADMAP.md) — Release phases
- [STACK.md](./STACK.md) — Tech choices justification
- [docs/adr/](./docs/adr/) — Architecture Decision Records

## 🧪 Testing

```bash
pnpm test              # All unit + integration
pnpm test:unit         # Unit only (fast)
pnpm test:integration  # Testcontainers (requires Docker)
pnpm test:e2e          # Playwright (requires running app)
pnpm test:coverage     # With v8 coverage
pnpm metrics           # Collect perf metrics from running instance
```

## 📜 License

MIT (core). Enterprise modules (planned for v1.5) will be commercial.

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) (TBD). Code of Conduct: TBD.

---

Status: **v0.1.0 (Alpha) — pre-release**. APIs may change before v1.0.
