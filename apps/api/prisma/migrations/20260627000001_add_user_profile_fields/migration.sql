-- =============================================================================
-- Migration: 20260627000001_add_user_profile_fields
-- Sprint 2.4 — User & Profile Management
--
-- Changes (all additive — zero downtime, no existing data modified):
-- 1. users.username      — optional unique handle (nullable, no backfill needed)
-- 2. users.version       — optimistic locking counter (default 0)
-- 3. user_profiles.theme  — UI theme preference (default 'system')
-- 4. user_profiles.version — optimistic locking counter (default 0)
--
-- Design notes:
-- - username is nullable + unique: existing users keep NULL until they set one.
--   A partial unique index allows multiple NULLs while enforcing uniqueness
--   on actual values (Postgres treats NULLs as distinct by default, so a
--   standard UNIQUE works; we use it directly).
-- - version columns enable optimistic concurrency control. Each successful
--   update increments version; updates with a stale version are rejected.
-- =============================================================================

-- 1. users.username (nullable, unique)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users"("username");

-- 2. users.version (optimistic locking)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- 3. user_profiles.theme
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "theme" VARCHAR(20) NOT NULL DEFAULT 'system';

-- 4. user_profiles.version (optimistic locking)
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- ──────────────────────────────────────────────────────────────────────────────
-- Migration complete. Zero downtime. Rollback:
--   ALTER TABLE users DROP COLUMN username, DROP COLUMN version;
--   ALTER TABLE user_profiles DROP COLUMN theme, DROP COLUMN version;
-- ──────────────────────────────────────────────────────────────────────────────
