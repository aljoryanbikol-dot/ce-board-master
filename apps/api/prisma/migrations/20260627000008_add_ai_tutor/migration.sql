-- =============================================================================
-- Migration: 20260627000008_add_ai_tutor
-- Sprint 3.3 — Enterprise AI Tutor & Intelligent Learning Assistant
--
-- Additive: 5 enums + 4 ownership-scoped tables. No existing data modified.
-- =============================================================================

DO $$ BEGIN CREATE TYPE "tutor_conversation_status" AS ENUM ('active','archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "tutor_message_role" AS ENUM ('user','assistant','system'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "tutor_intent" AS ENUM ('ask_question','explain_concept','explain_question','step_solution','hint','formula_help','coaching','followup'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "tutor_citation_kind" AS ENUM ('learning_objective','formula','misconception','blueprint','knowledge_document','question'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "coaching_trigger" AS ENUM ('weak_topic','knowledge_gap','exam_mistake','misconception','streak_risk'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "tutor_conversations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "status" "tutor_conversation_status" NOT NULL DEFAULT 'active',
  "subject_id" UUID,
  "topic_id" UUID,
  "memory_summary" TEXT,
  "message_count" INT NOT NULL DEFAULT 0,
  "last_message_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "tutor_conversations_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "tutor_conversations_user_status_idx" ON "tutor_conversations" ("user_id","status");
CREATE INDEX IF NOT EXISTS "tutor_conversations_user_last_idx" ON "tutor_conversations" ("user_id","last_message_at");

CREATE TABLE IF NOT EXISTS "tutor_messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "tutor_message_role" NOT NULL,
  "intent" "tutor_intent",
  "content" TEXT NOT NULL,
  "question_id" UUID,
  "grounded_in_kb" BOOLEAN NOT NULL DEFAULT false,
  "validated_ok" BOOLEAN,
  "provider_name" VARCHAR(60),
  "tokens_in" INT,
  "tokens_out" INT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "tutor_messages_conversation_fkey" FOREIGN KEY ("conversation_id") REFERENCES "tutor_conversations"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "tutor_messages_conversation_created_idx" ON "tutor_messages" ("conversation_id","created_at");
CREATE INDEX IF NOT EXISTS "tutor_messages_user_idx" ON "tutor_messages" ("user_id");

CREATE TABLE IF NOT EXISTS "tutor_citations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" UUID NOT NULL,
  "kind" "tutor_citation_kind" NOT NULL,
  "ref_id" TEXT NOT NULL,
  "label" VARCHAR(300) NOT NULL,
  "snippet" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "tutor_citations_message_fkey" FOREIGN KEY ("message_id") REFERENCES "tutor_messages"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "tutor_citations_message_idx" ON "tutor_citations" ("message_id");
CREATE INDEX IF NOT EXISTS "tutor_citations_kind_ref_idx" ON "tutor_citations" ("kind","ref_id");

CREATE TABLE IF NOT EXISTS "tutor_coaching_notes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "trigger" "coaching_trigger" NOT NULL,
  "subject_id" UUID,
  "topic_id" UUID,
  "title" VARCHAR(200) NOT NULL,
  "message" TEXT NOT NULL,
  "source_type" VARCHAR(40),
  "source_id" UUID,
  "priority" INT NOT NULL DEFAULT 0,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "tutor_coaching_notes_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "tutor_coaching_notes_user_read_idx" ON "tutor_coaching_notes" ("user_id","is_read");
CREATE INDEX IF NOT EXISTS "tutor_coaching_notes_user_trigger_idx" ON "tutor_coaching_notes" ("user_id","trigger");
