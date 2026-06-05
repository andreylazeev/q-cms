# DATA_MODEL — Q-CMS

**Версия:** 1.0
**Дата:** 2026-06-05

Модель данных Q-CMS. Схема генерируется из `schema.ts` пользователя + имеет фиксированное ядро для auth, RBAC, media, audit.

---

## 1. Ядро (фиксированные таблицы)

### 1.1. `users`

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT UNIQUE NOT NULL,
  username      TEXT UNIQUE,
  password_hash TEXT,  -- bcrypt; null если только OAuth
  first_name    TEXT,
  last_name     TEXT,
  avatar_id     UUID REFERENCES media(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_super_admin BOOLEAN NOT NULL DEFAULT false,
  totp_secret   TEXT,  -- encrypted, 2FA
  totp_enabled  BOOLEAN NOT NULL DEFAULT false,
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_active ON users (is_active) WHERE is_active = true;
```

### 1.2. `sessions`

```sql
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,  -- SHA-256 от session token
  ip          INET,
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_expires ON sessions (expires_at) WHERE revoked_at IS NULL;
```

### 1.3. `api_tokens`

```sql
CREATE TABLE api_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,  -- SHA-256, сам токен показывается 1 раз
  prefix      TEXT NOT NULL,  -- "qcs_abc123..." для UI
  scopes      TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {'read:entries', 'write:media'}
  expires_at  TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_api_tokens_user ON api_tokens (user_id) WHERE revoked_at IS NULL;
```

### 1.4. RBAC

```sql
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,  -- 'admin', 'editor', 'author', 'reviewer', 'viewer' или custom
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,  -- нельзя удалить pre-defined
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource TEXT NOT NULL,  -- 'collection:Article', 'media', 'settings', 'users', '*'
  action   TEXT NOT NULL,  -- 'read', 'create', 'update', 'delete', 'publish', 'approve', '*'
  conditions JSONB NOT NULL DEFAULT '{}',  -- e.g. {"field": "created_by", "op": "eq", "value": "$user.id"}
  UNIQUE (resource, action)
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope   JSONB NOT NULL DEFAULT '{}',  -- per-collection scope: {"collection": "Article"}
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);
```

Pre-defined роли (seed):

| Роль | Разрешения |
|---|---|
| super_admin | `*: *` |
| admin | все `*: *` кроме `users:delete super_admin` |
| editor | `collection:*:read/create/update/delete/publish` (для назначенных коллекций) |
| author | `collection:*:read/create/update` (только свои) |
| reviewer | `collection:*:read/approve` |
| viewer | `*:read` |

### 1.5. `audit_log`

```sql
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT,  -- denormalized для случая удаления пользователя
  action      TEXT NOT NULL,  -- 'entry.create', 'entry.update', 'entry.publish', 'entry.delete', 'user.invite', etc.
  resource_type TEXT NOT NULL,  -- 'entry', 'user', 'media', 'role'
  resource_id TEXT,  -- UUID или сериализованный ID
  diff        JSONB,  -- {field: {from, to}}
  context     JSONB NOT NULL DEFAULT '{}',  -- IP, UA, request_id, ...
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_actor ON audit_log (actor_id, occurred_at DESC);
CREATE INDEX idx_audit_resource ON audit_log (resource_type, resource_id, occurred_at DESC);
CREATE INDEX idx_audit_action ON audit_log (action, occurred_at DESC);

-- Партиционирование по occurred_at (range, monthly)
```

Retention: 1 год по умолчанию, настраивается (`AUDIT_RETENTION_DAYS`).

---

## 2. Контент (генерируемая часть)

### 2.1. `collections`

```sql
CREATE TABLE collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT UNIQUE NOT NULL,  -- 'Article', 'Author'
  slug            TEXT UNIQUE NOT NULL,  -- 'articles', 'authors'
  is_singleton    BOOLEAN NOT NULL DEFAULT false,
  draft_and_publish BOOLEAN NOT NULL DEFAULT true,
  versioning      BOOLEAN NOT NULL DEFAULT true,
  schema          JSONB NOT NULL,  -- JSON Schema (subset) — описание полей
  settings        JSONB NOT NULL DEFAULT '{}',
  display_name    TEXT NOT NULL,  -- i18n: {'en': 'Article', 'ru': 'Статья'}
  display_name_i18n JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.2. `entries` (универсальная таблица)

```sql
CREATE TABLE entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  slug            TEXT,  -- nullable для динамических
  status          entry_status NOT NULL DEFAULT 'draft',
  locale          TEXT NOT NULL,
  is_default_locale BOOLEAN NOT NULL DEFAULT false,
  data            JSONB NOT NULL DEFAULT '{}',
  -- denormalized для индексации/поиска:
  title           TEXT GENERATED ALWAYS AS (data->>'title') STORED,
  search_vector   TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(data->>'title', '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(data->>'excerpt', '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(data->>'description', '')), 'C')
  ) STORED,
  published_at    TIMESTAMPTZ,
  scheduled_publish_at TIMESTAMPTZ,
  scheduled_unpublish_at TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Constraints:
  UNIQUE (collection_id, locale, slug),
  -- Для singleton: одна строка на locale
  UNIQUE (collection_id, locale, id) DEFERRABLE INITIALLY DEFERRED  -- noop, для документирования
);

CREATE TYPE entry_status AS ENUM (
  'draft', 'in_review', 'approved', 'published', 'archived'
);

-- Indexes
CREATE INDEX idx_entries_collection_status ON entries (collection_id, status, published_at DESC);
CREATE INDEX idx_entries_published ON entries (collection_id, locale, published_at DESC)
  WHERE status = 'published';
CREATE INDEX idx_entries_search ON entries USING GIN (search_vector);
CREATE INDEX idx_entries_data_gin ON entries USING GIN (data jsonb_path_ops);
CREATE INDEX idx_entries_locale ON entries (locale);
CREATE INDEX idx_entries_created_by ON entries (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_entries_scheduled ON entries (scheduled_publish_at)
  WHERE scheduled_publish_at IS NOT NULL AND status = 'draft';

-- Партиционирование по collection_id (hash, 16 партиций) для >1M entries
```

**Партиционирование для scale:**

```sql
-- Партиционирование по published_at (range, monthly) для архивных данных
CREATE TABLE entries_partitioned (LIKE entries INCLUDING ALL)
PARTITION BY RANGE (published_at);

CREATE TABLE entries_2026_q2 PARTITION OF entries_partitioned
  FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
-- ... и т.д.
```

### 2.3. `entry_revisions`

```sql
CREATE TABLE entry_revisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  version       INT NOT NULL,
  status        entry_status NOT NULL,
  data          JSONB NOT NULL,  -- snapshot всей записи
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  comment       TEXT,
  UNIQUE (entry_id, version)
);

CREATE INDEX idx_revisions_entry ON entry_revisions (entry_id, version DESC);

-- Retention: хранить N последних версий + 1 в месяц (config)
```

### 2.4. `entry_relations` (граф)

```sql
CREATE TABLE entry_relations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  target_id     UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  field         TEXT NOT NULL,  -- 'author', 'tags.0', 'category.parent'
  relation_type TEXT NOT NULL DEFAULT 'direct',  -- 'direct', 'inherited'
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, target_id, field)
);

CREATE INDEX idx_relations_source ON entry_relations (source_id);
CREATE INDEX idx_relations_target ON entry_relations (target_id);
CREATE INDEX idx_relations_field ON entry_relations (field);
```

Использование: при запросе `populate=author` API идёт в `entry_relations` (вместо денормализации в JSONB), что позволяет эффективно фильтровать "все статьи автора X" (через reverse lookup) и обновлять relations без перезаписи JSONB.

### 2.5. `entry_comments` (v1.0)

```sql
CREATE TABLE entry_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  block_id      TEXT,  -- ID блока в TipTap (если inline)
  thread_id     UUID REFERENCES entry_comments(id) ON DELETE CASCADE,  -- для replies
  body          TEXT NOT NULL,
  resolved_at   TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_entry ON entry_comments (entry_id) WHERE resolved_at IS NULL;
```

---

## 3. Медиа

### 3.1. `media`

```sql
CREATE TABLE media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename        TEXT NOT NULL,  -- оригинальное имя файла
  mime_type       TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL,
  checksum_sha256 TEXT NOT NULL,  -- для дедупликации
  storage_key     TEXT NOT NULL,  -- S3 key: {tenant}/originals/{year}/{month}/{uuid}.{ext}
  type            media_type NOT NULL,  -- 'image', 'video', 'audio', 'document', 'other'
  width           INT,  -- для image/video
  height          INT,
  duration        NUMERIC(10, 3),  -- для video/audio
  alt_text        TEXT,  -- обязателен для image
  caption         TEXT,
  focal_point     POINT,  -- для image (для object-fit: cover)
  folder_id       UUID REFERENCES media_folders(id) ON DELETE SET NULL,
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',  -- EXIF, colors, etc.
  is_processed    BOOLEAN NOT NULL DEFAULT false,
  virus_scanned   BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE media_type AS ENUM ('image', 'video', 'audio', 'document', 'other');

CREATE INDEX idx_media_type ON media (type, created_at DESC);
CREATE INDEX idx_media_checksum ON media (checksum_sha256);
CREATE INDEX idx_media_folder ON media (folder_id);
CREATE INDEX idx_media_uploader ON media (uploaded_by);
```

### 3.2. `media_variants`

```sql
CREATE TABLE media_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id      UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  variant_name  TEXT NOT NULL,  -- 'thumbnail', 'small', 'medium', ...
  width         INT,
  height        INT,
  format        TEXT NOT NULL,  -- 'webp', 'avif', 'jpeg', 'png'
  size_bytes    BIGINT NOT NULL,
  storage_key   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_id, variant_name, format)
);

CREATE INDEX idx_variants_media ON media_variants (media_id);
```

### 3.3. `media_folders`

```sql
CREATE TABLE media_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES media_folders(id) ON DELETE CASCADE,
  path        LTREE NOT NULL,  -- материализованный путь: 'blog.heroes.2026'
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_folders_path ON media_folders USING GIST (path);
```

### 3.4. `media_tags`

```sql
CREATE TABLE media_tags (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT UNIQUE NOT NULL,
  slug  TEXT UNIQUE NOT NULL
);

CREATE TABLE media_tag_assignments (
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  tag_id   UUID NOT NULL REFERENCES media_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, tag_id)
);
```

---

## 4. Webhooks

```sql
CREATE TABLE webhooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  events        TEXT[] NOT NULL,  -- ['entry.publish', 'entry.update', ...]
  secret        TEXT NOT NULL,  -- HMAC signing
  headers       JSONB NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  retry_policy  JSONB NOT NULL DEFAULT '{"maxAttempts": 3, "backoff": "exponential"}',
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhook_deliveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id    UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event         TEXT NOT NULL,
  payload       JSONB NOT NULL,
  attempt       INT NOT NULL DEFAULT 1,
  status        delivery_status NOT NULL,  -- 'pending', 'success', 'failed', 'exhausted'
  response_code INT,
  response_body TEXT,
  response_headers JSONB,
  error_message TEXT,
  duration_ms   INT,
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at  TIMESTAMPTZ
);

CREATE TYPE delivery_status AS ENUM ('pending', 'success', 'failed', 'exhausted');

CREATE INDEX idx_deliveries_webhook ON webhook_deliveries (webhook_id, scheduled_at DESC);
CREATE INDEX idx_deliveries_pending ON webhook_deliveries (scheduled_at) WHERE status = 'pending';
```

---

## 5. Email-уведомления

```sql
CREATE TABLE email_templates (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT UNIQUE NOT NULL,  -- 'review-request', 'publish-notification'
  subject   TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]',  -- ['entry.title', 'author.name']
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE email_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email      TEXT NOT NULL,
  from_email    TEXT NOT NULL,
  subject       TEXT NOT NULL,
  body_html     TEXT NOT NULL,
  body_text     TEXT NOT NULL,
  template_name TEXT,
  variables     JSONB,
  status        email_status NOT NULL DEFAULT 'pending',
  attempts      INT NOT NULL DEFAULT 0,
  last_error    TEXT,
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at       TIMESTAMPTZ
);

CREATE TYPE email_status AS ENUM ('pending', 'sent', 'failed', 'bounced');
```

---

## 6. i18n

`locale` хранится строкой (ISO 639-1) в полях entries, email_templates, audit_log. Список доступных locales — в конфиге проекта + per-collection override.

Для переводов полей:
- Per-field (default): каждое локализуемое поле — отдельный ключ в `data: { title: { en: "Hello", ru: "Привет" } }`.
- Per-document (advanced): каждая locale — отдельная строка в `entries` (с `data` без обёртки locale).

API всегда нормализует к плоскому виду:
```json
{ "title": "Привет", "slug": "privet" }
```
С `Accept-Language` или `?locale=` — выбирается нужный перевод.

---

## 7. Миграции

Drizzle migration workflow:

```bash
# Генерация из schema.ts
pnpm db:generate

# Применить
pnpm db:migrate

# Откатить (1 шаг)
pnpm db:rollback

# Создать пустую кастомную миграцию
pnpm db:create-migration "add custom index"
```

Структура файлов:
```
packages/db/migrations/
├── 0001_initial.sql
├── 0002_audit_log.sql
├── 0003_add_entry_comments.sql
├── 0004_partition_entries.sql
└── meta/
    ├── _journal.json
    └── 0001_snapshot.json
```

---

## 8. ER-диаграмма (упрощённая)

```
┌──────────────┐         ┌─────────────────┐
│   users      │────┐    │   collections   │
└──────────────┘    │    └────────┬────────┘
       │            │             │
       │            │             │ 1:N
       │            │             ▼
       │            │    ┌─────────────────┐
       │            │    │     entries     │
       │            │    └────────┬────────┘
       │            │             │
       │            │             │ 1:N
       │            │             ▼
       │            │    ┌─────────────────┐         ┌──────────────────┐
       │            └───▶│  entry_revisions│         │  entry_relations │
       │                 └─────────────────┘         │  source → target │
       │                                              └──────────────────┘
       │ 1:N
       ▼
┌──────────────┐    ┌──────────────────┐
│   sessions   │    │   api_tokens     │
└──────────────┘    └──────────────────┘
       │
       │ M:N
       ▼
┌──────────────┐    ┌──────────────────┐
│   roles      │◀──▶│   permissions    │
└──────────────┘    └──────────────────┘
       │ M:N
       ▼
   user_roles

┌──────────────┐    ┌──────────────────┐
│   media      │◀──▶│  media_variants  │
└──────┬───────┘    └──────────────────┘
       │
       │ N:1
       ▼
┌──────────────┐
│media_folders │
└──────────────┘

┌──────────────┐    ┌─────────────────────┐
│  webhooks    │───▶│ webhook_deliveries  │
└──────────────┘    └─────────────────────┘
```

---

## 9. Storage size estimation

| Таблица | Строк (10k entries) | Размер |
|---|---|---|
| users | 50 | 100 KB |
| sessions | 200 | 200 KB |
| api_tokens | 100 | 50 KB |
| entries (10k × 5 locales × 2 statuses) | 100 000 | 500 MB |
| entry_revisions (10k × 10 versions) | 100 000 | 1 GB |
| entry_relations | 200 000 | 50 MB |
| media (5 000 файлов) | 5 000 | 5 MB (метаданные) |
| media_variants (5 000 × 8) | 40 000 | 10 MB |
| audit_log (1 год) | 5 000 000 | 2 GB |
| webhooks | 20 | 10 KB |
| webhook_deliveries (1 год) | 1 000 000 | 5 GB |
| **Total DB** | | **~14 GB** |

Postgres tune для этой нагрузки: 4 vCPU / 8 GB RAM, 100 GB SSD.

---

## 10. Backup & restore

### 10.1. Стратегия

- **Logical backup:** `pg_dump` ежедневно (для маленьких БД < 10 GB).
- **Physical backup:** WAL-G + WAL streaming (для production).
- **Point-in-time recovery:** retention 7 дней.
- **Cross-region:** для production — реплика в другой регион.
- **Media backup:** S3 versioning + lifecycle policy (Glacier через 90 дней).

### 10.2. Restore drill

Ежеквартально в staging:
1. Удалить Postgres
2. Восстановить из WAL-G
3. Прогнать smoke tests
4. Замерить RTO
