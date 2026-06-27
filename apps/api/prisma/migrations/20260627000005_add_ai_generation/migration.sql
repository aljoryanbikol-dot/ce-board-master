-- =============================================================================
-- Migration: 20260627000005_add_ai_generation
-- Sprint 2.9 — Enterprise AI Content Generation Engine
--
-- All additive. Creates 3 enums and 3 tables for the AI generation engine:
-- generation requests (the authoritative record), generated variants (the
-- produced question drafts), and an append-only audit log of every pipeline
-- stage. No existing data modified. Rollback drops the new tables and types.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE "generation_status" AS ENUM ('pending','generating','validating','validated','rejected','promoted','failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "generation_kind" AS ENUM ('question_from_lo','question_from_blueprint','numerical_variant','conceptual_variant','explanation','solution_steps','distractors');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "generation_validation_outcome" AS ENUM ('passed','passed_with_warnings','failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── ai_generation_requests ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ai_generation_requests" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind"                 "generation_kind" NOT NULL,
  "status"               "generation_status" NOT NULL DEFAULT 'pending',
  "learning_objective_id" VARCHAR(40),
  "blueprint_id"         VARCHAR(50),
  "subject_code"         VARCHAR(3),
  "topic_code"           VARCHAR(3),
  "difficulty_band"      VARCHAR(20),
  "parameters"           JSONB NOT NULL,
  "prompt"               TEXT,
  "output"               JSONB,
  "validation_outcome"   "generation_validation_outcome",
  "validation_report"    JSONB,
  "promoted_question_id" UUID,
  "provider_name"        VARCHAR(40) NOT NULL DEFAULT 'deterministic',
  "model"                VARCHAR(80),
  "seed"                 VARCHAR(64),
  "content_hash"         VARCHAR(64),
  "error_message"        TEXT,
  "requested_by"         UUID,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at"         TIMESTAMPTZ,
  CONSTRAINT "ai_gen_req_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "ai_gen_req_status_idx" ON "ai_generation_requests" ("status");
CREATE INDEX IF NOT EXISTS "ai_gen_req_kind_idx" ON "ai_generation_requests" ("kind");
CREATE INDEX IF NOT EXISTS "ai_gen_req_lo_idx" ON "ai_generation_requests" ("learning_objective_id");
CREATE INDEX IF NOT EXISTS "ai_gen_req_requested_by_idx" ON "ai_generation_requests" ("requested_by");
CREATE INDEX IF NOT EXISTS "ai_gen_req_content_hash_idx" ON "ai_generation_requests" ("content_hash");

-- ── ai_generated_variants ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ai_generated_variants" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "request_id"    UUID NOT NULL,
  "variant_index" SMALLINT NOT NULL,
  "variant_type"  VARCHAR(20) NOT NULL,
  "payload"       JSONB NOT NULL,
  "content_hash"  VARCHAR(64) NOT NULL,
  "is_duplicate"  BOOLEAN NOT NULL DEFAULT false,
  "validation_outcome" "generation_validation_outcome",
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ai_gen_var_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ai_generation_requests"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_gen_var_request_index_key" ON "ai_generated_variants" ("request_id","variant_index");
CREATE INDEX IF NOT EXISTS "ai_gen_var_content_hash_idx" ON "ai_generated_variants" ("content_hash");

-- ── ai_generation_audit_logs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ai_generation_audit_logs" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "request_id" UUID NOT NULL,
  "stage"      VARCHAR(40) NOT NULL,
  "status"     VARCHAR(20) NOT NULL,
  "detail"     JSONB,
  "message"    TEXT,
  "actor_id"   UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ai_gen_audit_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ai_generation_requests"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ai_gen_audit_request_idx" ON "ai_generation_audit_logs" ("request_id");
CREATE INDEX IF NOT EXISTS "ai_gen_audit_stage_idx" ON "ai_generation_audit_logs" ("stage");
