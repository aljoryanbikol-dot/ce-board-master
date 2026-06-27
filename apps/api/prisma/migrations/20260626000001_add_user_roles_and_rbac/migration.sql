-- =============================================================================
-- Migration: 20260626000001_add_user_roles_and_rbac
-- Sprint 2.3 — Enterprise Role-Based Access Control
--
-- Changes (all additive — zero downtime, no existing data modified):
-- 1. Create user_roles table (multi-role M:N between users and roles)
-- 2. Backfill user_roles from existing users.role_id (all existing users)
-- 3. Add index on permissions(module) — already in schema, ensure present
--
-- Design decisions:
-- - users.role_id FK is RETAINED for JWT fast-path. Both columns coexist.
-- - user_roles is the authoritative source for permission evaluation.
-- - Backfill ensures every existing user has at least their current role
--   in user_roles, maintaining backward compatibility.
-- =============================================================================

-- 1. Create user_roles join table
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_roles" (
    "user_id"    UUID        NOT NULL,
    "role_id"    UUID        NOT NULL,
    "granted_by" UUID,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "expires_at" TIMESTAMPTZ,
    "is_active"  BOOLEAN     NOT NULL DEFAULT TRUE,

    CONSTRAINT "user_roles_pkey"       PRIMARY KEY ("user_id", "role_id"),
    CONSTRAINT "user_roles_user_id_fk" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_roles_role_id_fk" FOREIGN KEY ("role_id")
        REFERENCES "roles"("id") ON DELETE CASCADE,
    CONSTRAINT "user_roles_granted_by_fk" FOREIGN KEY ("granted_by")
        REFERENCES "users"("id") ON DELETE SET NULL
);

-- 2. Indexes on user_roles
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "user_roles_user_id_idx"
    ON "user_roles"("user_id");

CREATE INDEX IF NOT EXISTS "user_roles_role_id_idx"
    ON "user_roles"("role_id");

CREATE INDEX IF NOT EXISTS "user_roles_user_id_is_active_idx"
    ON "user_roles"("user_id", "is_active");

-- 3. Backfill: copy every existing user's primary roleId → user_roles
-- This ensures the RBAC system immediately works for all existing users
-- without any manual data migration step.
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO "user_roles" ("user_id", "role_id", "granted_at")
SELECT "id", "role_id", "created_at"
FROM   "users"
WHERE  "role_id" IS NOT NULL
  AND  "deleted_at" IS NULL
ON CONFLICT ("user_id", "role_id") DO NOTHING;

-- 4. Ensure permissions table has correct indexes
-- (index on module was in original schema — ensure it exists)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "permissions_module_idx"
    ON "permissions"("module");

-- 5. Add index on role_permissions(permission_id) for reverse lookups
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "role_permissions_permission_id_idx"
    ON "role_permissions"("permission_id");

-- ──────────────────────────────────────────────────────────────────────────────
-- Migration complete. Safe to run on production with zero downtime.
-- Rollback: DROP TABLE user_roles; (no data loss — users.role_id preserved)
-- ──────────────────────────────────────────────────────────────────────────────
