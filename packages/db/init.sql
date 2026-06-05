-- ============================================
-- Q-CMS PostgreSQL Initialization
-- Runs once on first database creation
-- ============================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- crypt(), gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS "citext";      -- case-insensitive text
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- trigram indexes (for fuzzy search fallback)
CREATE EXTENSION IF NOT EXISTS "btree_gin";   -- GIN support for btree types

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qcms;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO qcms;

-- Set timezone
SET TIME ZONE 'UTC';

-- Note: All tables are created by Drizzle migrations, not by this init script.
-- This file is for extensions and per-database configuration only.
