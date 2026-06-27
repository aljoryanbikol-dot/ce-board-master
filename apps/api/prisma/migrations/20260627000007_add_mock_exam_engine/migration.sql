-- =============================================================================
-- Migration: 20260627000007_add_mock_exam_engine
-- Sprint 3.2 — Enterprise Mock Examination Engine
--
-- Additive: 4 enums + 7 ownership-scoped tables. No existing data modified.
-- =============================================================================

DO $$ BEGIN CREATE TYPE "exam_kind" AS ENUM ('full_board','subject','custom','adaptive','ai_generated'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "exam_status" AS ENUM ('created','in_progress','paused','submitted','expired','abandoned'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "exam_result_status" AS ENUM ('pass','fail','pending'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "exam_question_state" AS ENUM ('unanswered','answered','flagged','skipped'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "exam_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(50) NOT NULL UNIQUE,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "kind" "exam_kind" NOT NULL,
  "total_questions" INT NOT NULL,
  "duration_minutes" INT NOT NULL,
  "passing_score" DOUBLE PRECISION NOT NULL DEFAULT 70,
  "randomize_questions" BOOLEAN NOT NULL DEFAULT true,
  "randomize_choices" BOOLEAN NOT NULL DEFAULT true,
  "composition" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "exam_templates_creator_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "exam_templates_kind_active_idx" ON "exam_templates" ("kind","is_active");

CREATE TABLE IF NOT EXISTS "mock_exams" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "template_id" UUID,
  "kind" "exam_kind" NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "status" "exam_status" NOT NULL DEFAULT 'created',
  "total_questions" INT NOT NULL,
  "duration_minutes" INT NOT NULL,
  "passing_score" DOUBLE PRECISION NOT NULL,
  "randomize_choices" BOOLEAN NOT NULL DEFAULT true,
  "started_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ,
  "submitted_at" TIMESTAMPTZ,
  "paused_at" TIMESTAMPTZ,
  "elapsed_seconds" INT NOT NULL DEFAULT 0,
  "answered_count" INT NOT NULL DEFAULT 0,
  "last_activity_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "mock_exams_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "mock_exams_template_fkey" FOREIGN KEY ("template_id") REFERENCES "exam_templates"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "mock_exams_user_status_idx" ON "mock_exams" ("user_id","status");
CREATE INDEX IF NOT EXISTS "mock_exams_user_created_idx" ON "mock_exams" ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "mock_exams_status_expires_idx" ON "mock_exams" ("status","expires_at");

CREATE TABLE IF NOT EXISTS "exam_questions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "exam_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "position" INT NOT NULL,
  "subject_id" UUID NOT NULL,
  "topic_id" UUID,
  "difficulty_level_id" UUID,
  "learning_objective" VARCHAR(80),
  "choice_order" JSONB NOT NULL,
  "correct_choice" CHAR(1) NOT NULL,
  "state" "exam_question_state" NOT NULL DEFAULT 'unanswered',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "exam_questions_exam_fkey" FOREIGN KEY ("exam_id") REFERENCES "mock_exams"("id") ON DELETE CASCADE,
  CONSTRAINT "exam_questions_question_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "exam_questions_exam_question_key" ON "exam_questions" ("exam_id","question_id");
CREATE UNIQUE INDEX IF NOT EXISTS "exam_questions_exam_position_key" ON "exam_questions" ("exam_id","position");
CREATE INDEX IF NOT EXISTS "exam_questions_exam_position_idx" ON "exam_questions" ("exam_id","position");
CREATE INDEX IF NOT EXISTS "exam_questions_user_idx" ON "exam_questions" ("user_id");

CREATE TABLE IF NOT EXISTS "exam_answers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "exam_question_id" UUID NOT NULL UNIQUE,
  "exam_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "selected_choice" CHAR(1),
  "is_correct" BOOLEAN,
  "is_bookmarked" BOOLEAN NOT NULL DEFAULT false,
  "time_spent_sec" INT NOT NULL DEFAULT 0,
  "answered_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "exam_answers_eq_fkey" FOREIGN KEY ("exam_question_id") REFERENCES "exam_questions"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "exam_answers_exam_user_idx" ON "exam_answers" ("exam_id","user_id");
CREATE INDEX IF NOT EXISTS "exam_answers_exam_bookmark_idx" ON "exam_answers" ("exam_id","is_bookmarked");

CREATE TABLE IF NOT EXISTS "exam_results" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "exam_id" UUID NOT NULL UNIQUE,
  "user_id" UUID NOT NULL,
  "total_questions" INT NOT NULL,
  "answered_count" INT NOT NULL,
  "correct_count" INT NOT NULL,
  "incorrect_count" INT NOT NULL,
  "skipped_count" INT NOT NULL,
  "score_percent" DOUBLE PRECISION NOT NULL,
  "passing_score" DOUBLE PRECISION NOT NULL,
  "status" "exam_result_status" NOT NULL DEFAULT 'pending',
  "time_spent_sec" INT NOT NULL DEFAULT 0,
  "result_code" VARCHAR(40) NOT NULL UNIQUE,
  "percentile" DOUBLE PRECISION,
  "computed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "exam_results_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "exam_results_exam_fkey" FOREIGN KEY ("exam_id") REFERENCES "mock_exams"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "exam_results_user_computed_idx" ON "exam_results" ("user_id","computed_at");
CREATE INDEX IF NOT EXISTS "exam_results_status_score_idx" ON "exam_results" ("status","score_percent");

CREATE TABLE IF NOT EXISTS "exam_subject_scores" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "result_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "total" INT NOT NULL,
  "correct" INT NOT NULL,
  "score_percent" DOUBLE PRECISION NOT NULL,
  "weight_percent" DOUBLE PRECISION,
  CONSTRAINT "exam_subject_scores_result_fkey" FOREIGN KEY ("result_id") REFERENCES "exam_results"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "exam_subject_scores_result_subject_key" ON "exam_subject_scores" ("result_id","subject_id");
CREATE INDEX IF NOT EXISTS "exam_subject_scores_result_idx" ON "exam_subject_scores" ("result_id");

CREATE TABLE IF NOT EXISTS "exam_topic_scores" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "result_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "topic_id" UUID NOT NULL,
  "total" INT NOT NULL,
  "correct" INT NOT NULL,
  "score_percent" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "exam_topic_scores_result_fkey" FOREIGN KEY ("result_id") REFERENCES "exam_results"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "exam_topic_scores_result_topic_key" ON "exam_topic_scores" ("result_id","topic_id");
CREATE INDEX IF NOT EXISTS "exam_topic_scores_result_idx" ON "exam_topic_scores" ("result_id");
