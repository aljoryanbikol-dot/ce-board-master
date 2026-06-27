-- =============================================================================
-- Migration: 20260627000004_add_knowledge_base
-- Sprint 2.8 — Enterprise Content Knowledge Management
--
-- All additive. Creates 4 enums and 8 tables for the Content Knowledge Base:
-- ingested enterprise documents (Books 1-15) + their versions + parsed
-- sections, the Learning Objective spine + versions, Question Blueprints,
-- Misconceptions, and the cross-reference dependency graph. No existing data
-- modified. Zero downtime. Rollback drops the new tables and types.
-- =============================================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "knowledge_status"            AS ENUM ('draft','in_review','approved','published','deprecated','archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "knowledge_document_type"     AS ENUM (
    'authoring_bible','knowledge_map','question_writing_standards','formula_library',
    'engineering_codes','question_templates','distractor_design','explanation_standards',
    'psychometric_standards','ai_content_generation','learning_objectives',
    'question_blueprints','misconceptions','diagram_standards','editorial_style');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "learning_objective_status"   AS ENUM ('draft','in_review','approved','published','deprecated','archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "cross_reference_type"        AS ENUM (
    'lo_to_formula','lo_to_blueprint','lo_to_misconception','blueprint_to_lo',
    'blueprint_to_formula','misconception_to_lo','formula_to_lo','document_to_entity','lo_prerequisite');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── knowledge_documents ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "knowledge_documents" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "book_number"     SMALLINT NOT NULL,
  "document_type"   "knowledge_document_type" NOT NULL,
  "title"           VARCHAR(300) NOT NULL,
  "slug"            VARCHAR(160) NOT NULL,
  "description"     TEXT,
  "status"          "knowledge_status" NOT NULL DEFAULT 'draft',
  "current_version" SMALLINT NOT NULL DEFAULT 1,
  "latest_semver"   VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  "source_filename" TEXT,
  "owner_team"      VARCHAR(120),
  "created_by"      UUID,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"      TIMESTAMPTZ,
  CONSTRAINT "knowledge_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_documents_slug_key" ON "knowledge_documents" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_documents_book_number_key" ON "knowledge_documents" ("book_number");
CREATE INDEX IF NOT EXISTS "knowledge_documents_document_type_idx" ON "knowledge_documents" ("document_type");
CREATE INDEX IF NOT EXISTS "knowledge_documents_status_idx" ON "knowledge_documents" ("status");

-- ── knowledge_document_versions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "knowledge_document_versions" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id"      UUID NOT NULL,
  "version_number"   SMALLINT NOT NULL,
  "semver"           VARCHAR(20) NOT NULL,
  "status"           "knowledge_status" NOT NULL DEFAULT 'draft',
  "content_text"     TEXT NOT NULL,
  "content_checksum" VARCHAR(64) NOT NULL,
  "section_count"    SMALLINT NOT NULL DEFAULT 0,
  "word_count"       INTEGER NOT NULL DEFAULT 0,
  "change_summary"   TEXT,
  "ingested_by"      UUID,
  "is_current"       BOOLEAN NOT NULL DEFAULT false,
  "published_at"     TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "kdv_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
  CONSTRAINT "kdv_ingested_by_fkey" FOREIGN KEY ("ingested_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "kdv_document_version_key" ON "knowledge_document_versions" ("document_id","version_number");
CREATE INDEX IF NOT EXISTS "kdv_document_current_idx" ON "knowledge_document_versions" ("document_id","is_current");
CREATE INDEX IF NOT EXISTS "kdv_checksum_idx" ON "knowledge_document_versions" ("content_checksum");

-- ── knowledge_sections ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "knowledge_sections" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL,
  "anchor"      VARCHAR(120) NOT NULL,
  "heading"     VARCHAR(400) NOT NULL,
  "level"       SMALLINT NOT NULL DEFAULT 1,
  "order_index" INTEGER NOT NULL,
  "body_text"   TEXT NOT NULL,
  "word_count"  INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "knowledge_sections_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_sections_document_anchor_key" ON "knowledge_sections" ("document_id","anchor");
CREATE INDEX IF NOT EXISTS "knowledge_sections_document_order_idx" ON "knowledge_sections" ("document_id","order_index");

-- ── learning_objectives ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "learning_objectives" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "public_id"        VARCHAR(40) NOT NULL,
  "subject_code"     VARCHAR(3) NOT NULL,
  "topic_code"       VARCHAR(3) NOT NULL,
  "subtopic_code"    VARCHAR(3) NOT NULL,
  "sequence_number"  SMALLINT NOT NULL,
  "subject_id"       UUID,
  "statement"        TEXT NOT NULL,
  "bloom_level"      VARCHAR(20) NOT NULL DEFAULT 'apply',
  "measurable"       BOOLEAN NOT NULL DEFAULT true,
  "status"           "learning_objective_status" NOT NULL DEFAULT 'draft',
  "current_version"  SMALLINT NOT NULL DEFAULT 1,
  "semver"           VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  "keywords"         TEXT[] NOT NULL DEFAULT '{}',
  "source_document_id" UUID,
  "created_by"       UUID,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"       TIMESTAMPTZ,
  CONSTRAINT "learning_objectives_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL,
  CONSTRAINT "learning_objectives_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "learning_objectives_public_id_key" ON "learning_objectives" ("public_id");
CREATE INDEX IF NOT EXISTS "learning_objectives_codes_idx" ON "learning_objectives" ("subject_code","topic_code","subtopic_code");
CREATE INDEX IF NOT EXISTS "learning_objectives_status_idx" ON "learning_objectives" ("status");
CREATE INDEX IF NOT EXISTS "learning_objectives_subject_id_idx" ON "learning_objectives" ("subject_id");

-- ── learning_objective_versions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "learning_objective_versions" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "objective_id"   UUID NOT NULL,
  "version_number" SMALLINT NOT NULL,
  "semver"         VARCHAR(20) NOT NULL,
  "snapshot"       JSONB NOT NULL,
  "change_summary" TEXT,
  "changed_by"     UUID,
  "is_current"     BOOLEAN NOT NULL DEFAULT false,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "lov_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "learning_objectives"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "lov_objective_version_key" ON "learning_objective_versions" ("objective_id","version_number");
CREATE INDEX IF NOT EXISTS "lov_objective_current_idx" ON "learning_objective_versions" ("objective_id","is_current");

-- ── question_blueprints ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "question_blueprints" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "public_id"           VARCHAR(50) NOT NULL,
  "subject_code"        VARCHAR(3) NOT NULL,
  "topic_code"          VARCHAR(3) NOT NULL,
  "subtopic_code"       VARCHAR(3) NOT NULL,
  "blueprint_type"      VARCHAR(3) NOT NULL,
  "sequence_number"     SMALLINT NOT NULL,
  "name"                VARCHAR(300) NOT NULL,
  "description"         TEXT,
  "primary_objective_id" UUID,
  "structure"           JSONB NOT NULL,
  "difficulty_band"     VARCHAR(20),
  "status"              "knowledge_status" NOT NULL DEFAULT 'draft',
  "current_version"     SMALLINT NOT NULL DEFAULT 1,
  "semver"              VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  "source_document_id"  UUID,
  "created_by"          UUID,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"          TIMESTAMPTZ,
  CONSTRAINT "question_blueprints_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "question_blueprints_public_id_key" ON "question_blueprints" ("public_id");
CREATE INDEX IF NOT EXISTS "question_blueprints_codes_idx" ON "question_blueprints" ("subject_code","topic_code","subtopic_code");
CREATE INDEX IF NOT EXISTS "question_blueprints_type_idx" ON "question_blueprints" ("blueprint_type");
CREATE INDEX IF NOT EXISTS "question_blueprints_status_idx" ON "question_blueprints" ("status");

-- ── misconceptions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "misconceptions" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "public_id"           VARCHAR(50) NOT NULL,
  "subject_code"        VARCHAR(3) NOT NULL,
  "topic_code"          VARCHAR(3) NOT NULL,
  "subtopic_code"       VARCHAR(3) NOT NULL,
  "category"            VARCHAR(3) NOT NULL,
  "sequence_number"     SMALLINT NOT NULL,
  "title"               VARCHAR(300) NOT NULL,
  "description"         TEXT NOT NULL,
  "why_it_happens"      TEXT,
  "correction"          TEXT,
  "primary_objective_id" UUID,
  "status"              "knowledge_status" NOT NULL DEFAULT 'draft',
  "current_version"     SMALLINT NOT NULL DEFAULT 1,
  "semver"              VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  "source_document_id"  UUID,
  "created_by"          UUID,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"          TIMESTAMPTZ,
  CONSTRAINT "misconceptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "misconceptions_public_id_key" ON "misconceptions" ("public_id");
CREATE INDEX IF NOT EXISTS "misconceptions_codes_idx" ON "misconceptions" ("subject_code","topic_code","subtopic_code");
CREATE INDEX IF NOT EXISTS "misconceptions_category_idx" ON "misconceptions" ("category");
CREATE INDEX IF NOT EXISTS "misconceptions_status_idx" ON "misconceptions" ("status");

-- ── knowledge_cross_references ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "knowledge_cross_references" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reference_type" "cross_reference_type" NOT NULL,
  "from_type"      VARCHAR(30) NOT NULL,
  "from_id"        UUID NOT NULL,
  "from_public_id" VARCHAR(50),
  "to_type"        VARCHAR(30) NOT NULL,
  "to_id"          UUID NOT NULL,
  "to_public_id"   VARCHAR(50),
  "weight"         SMALLINT NOT NULL DEFAULT 1,
  "note"           TEXT,
  "created_by"     UUID,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "kxref_edge_key" ON "knowledge_cross_references" ("from_type","from_id","to_type","to_id","reference_type");
CREATE INDEX IF NOT EXISTS "kxref_from_idx" ON "knowledge_cross_references" ("from_type","from_id");
CREATE INDEX IF NOT EXISTS "kxref_to_idx" ON "knowledge_cross_references" ("to_type","to_id");
CREATE INDEX IF NOT EXISTS "kxref_type_idx" ON "knowledge_cross_references" ("reference_type");
