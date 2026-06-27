-- =============================================================================
-- Migration: 20260627000003_add_admin_cms
-- Sprint 2.7 — Enterprise Admin CMS Foundation
--
-- All additive. Creates 3 enums and 4 tables (question_locks,
-- review_assignments, review_comments, editorial_notes) plus partial unique
-- indexes enforcing "one active lock per question" and "one active assignment
-- per question+stage". No existing data modified. Zero downtime.
-- Rollback drops the new tables and types.
-- =============================================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "review_stage"             AS ENUM ('technical','educational','editorial','qa');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "assignment_status"        AS ENUM ('pending','accepted','completed','declined','reassigned');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "editorial_note_category"  AS ENUM ('general','style','sourcing','prc_alignment','correction','warning');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── question_locks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "question_locks" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "question_id" UUID NOT NULL,
  "locked_by"   UUID NOT NULL,
  "reason"      TEXT,
  "acquired_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expires_at"  TIMESTAMPTZ NOT NULL,
  "released_at" TIMESTAMPTZ,
  CONSTRAINT "question_locks_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE,
  CONSTRAINT "question_locks_locked_by_fkey"   FOREIGN KEY ("locked_by")   REFERENCES "users"("id")     ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "question_locks_question_id_idx" ON "question_locks" ("question_id");
CREATE INDEX IF NOT EXISTS "question_locks_locked_by_idx"   ON "question_locks" ("locked_by");
CREATE INDEX IF NOT EXISTS "question_locks_expires_at_idx"  ON "question_locks" ("expires_at");
-- At most one ACTIVE lock (not yet released) per question.
CREATE UNIQUE INDEX IF NOT EXISTS "question_locks_one_active_per_question"
  ON "question_locks" ("question_id") WHERE "released_at" IS NULL;

-- ── review_assignments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "review_assignments" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "question_id" UUID NOT NULL,
  "assignee_id" UUID NOT NULL,
  "assigned_by" UUID NOT NULL,
  "stage"       "review_stage" NOT NULL,
  "status"      "assignment_status" NOT NULL DEFAULT 'pending',
  "due_at"      TIMESTAMPTZ,
  "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMPTZ,
  CONSTRAINT "review_assignments_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE,
  CONSTRAINT "review_assignments_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id")     ON DELETE CASCADE,
  CONSTRAINT "review_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id")     ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "review_assignments_question_id_stage_idx" ON "review_assignments" ("question_id","stage");
CREATE INDEX IF NOT EXISTS "review_assignments_assignee_id_status_idx" ON "review_assignments" ("assignee_id","status");
CREATE INDEX IF NOT EXISTS "review_assignments_status_due_at_idx" ON "review_assignments" ("status","due_at");
-- At most one ACTIVE (incomplete) assignment per question+stage.
CREATE UNIQUE INDEX IF NOT EXISTS "review_assignments_one_active_per_stage"
  ON "review_assignments" ("question_id","stage") WHERE "completed_at" IS NULL;

-- ── review_comments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "review_comments" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "question_id" UUID NOT NULL,
  "author_id"   UUID NOT NULL,
  "parent_id"   UUID,
  "stage"       "review_stage",
  "body"        TEXT NOT NULL,
  "is_resolved" BOOLEAN NOT NULL DEFAULT false,
  "resolved_by" UUID,
  "resolved_at" TIMESTAMPTZ,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"  TIMESTAMPTZ,
  CONSTRAINT "review_comments_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE,
  CONSTRAINT "review_comments_author_id_fkey"   FOREIGN KEY ("author_id")   REFERENCES "users"("id")     ON DELETE CASCADE,
  CONSTRAINT "review_comments_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id")     ON DELETE SET NULL,
  CONSTRAINT "review_comments_parent_id_fkey"   FOREIGN KEY ("parent_id")   REFERENCES "review_comments"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "review_comments_question_id_created_at_idx" ON "review_comments" ("question_id","created_at");
CREATE INDEX IF NOT EXISTS "review_comments_author_id_idx" ON "review_comments" ("author_id");
CREATE INDEX IF NOT EXISTS "review_comments_parent_id_idx" ON "review_comments" ("parent_id");

-- ── editorial_notes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "editorial_notes" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "question_id" UUID NOT NULL,
  "author_id"   UUID NOT NULL,
  "category"    "editorial_note_category" NOT NULL DEFAULT 'general',
  "body"        TEXT NOT NULL,
  "is_pinned"   BOOLEAN NOT NULL DEFAULT false,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"  TIMESTAMPTZ,
  CONSTRAINT "editorial_notes_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE,
  CONSTRAINT "editorial_notes_author_id_fkey"   FOREIGN KEY ("author_id")   REFERENCES "users"("id")     ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "editorial_notes_question_id_is_pinned_idx" ON "editorial_notes" ("question_id","is_pinned");
CREATE INDEX IF NOT EXISTS "editorial_notes_author_id_idx" ON "editorial_notes" ("author_id");
