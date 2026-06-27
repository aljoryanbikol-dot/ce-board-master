-- =============================================================================
-- Migration: 20260627000006_add_student_platform
-- Sprint 3.1 — Enterprise Student Learning Platform
--
-- Additive: 8 enums + 15 ownership-scoped tables. No existing data modified.
-- =============================================================================

DO $$ BEGIN CREATE TYPE "attempt_outcome" AS ENUM ('correct','incorrect','skipped'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "practice_session_mode" AS ENUM ('subject','topic','learning_objective','blueprint','difficulty','recommended','mixed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "practice_session_status" AS ENUM ('active','completed','abandoned'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "study_goal_period" AS ENUM ('daily','weekly','monthly'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "study_task_status" AS ENUM ('pending','in_progress','completed','skipped'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "mastery_tier" AS ENUM ('novice','developing','proficient','advanced','mastered'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "achievement_kind" AS ENUM ('streak','volume','accuracy','mastery','milestone','speed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "knowledge_gap_severity" AS ENUM ('minor','moderate','critical'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- practice_sessions (created before question_attempts for FK)
CREATE TABLE IF NOT EXISTS "practice_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "mode" "practice_session_mode" NOT NULL,
  "status" "practice_session_status" NOT NULL DEFAULT 'active',
  "subject_id" UUID, "topic_id" UUID, "subtopic_id" UUID,
  "learning_objective_id" VARCHAR(40), "blueprint_id" VARCHAR(50), "difficulty_level_id" UUID,
  "target_count" INT NOT NULL DEFAULT 10,
  "answered_count" INT NOT NULL DEFAULT 0,
  "correct_count" INT NOT NULL DEFAULT 0,
  "total_time_sec" INT NOT NULL DEFAULT 0,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMPTZ,
  CONSTRAINT "practice_sessions_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "practice_sessions_user_status_idx" ON "practice_sessions" ("user_id","status");
CREATE INDEX IF NOT EXISTS "practice_sessions_user_started_idx" ON "practice_sessions" ("user_id","started_at");

CREATE TABLE IF NOT EXISTS "question_attempts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "session_id" UUID,
  "subject_id" UUID NOT NULL,
  "topic_id" UUID, "subtopic_id" UUID, "difficulty_level_id" UUID,
  "selected_choice" VARCHAR(2),
  "outcome" "attempt_outcome" NOT NULL,
  "is_correct" BOOLEAN NOT NULL,
  "time_spent_sec" INT NOT NULL DEFAULT 0,
  "bloom_level" VARCHAR(20),
  "attempted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "question_attempts_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "question_attempts_question_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE,
  CONSTRAINT "question_attempts_session_fkey" FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "question_attempts_user_time_idx" ON "question_attempts" ("user_id","attempted_at");
CREATE INDEX IF NOT EXISTS "question_attempts_user_subject_idx" ON "question_attempts" ("user_id","subject_id");
CREATE INDEX IF NOT EXISTS "question_attempts_user_topic_idx" ON "question_attempts" ("user_id","topic_id");
CREATE INDEX IF NOT EXISTS "question_attempts_question_idx" ON "question_attempts" ("question_id");
CREATE INDEX IF NOT EXISTS "question_attempts_session_idx" ON "question_attempts" ("session_id");

CREATE TABLE IF NOT EXISTS "bookmarks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL, "question_id" UUID NOT NULL, "note" VARCHAR(500),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "bookmarks_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "bookmarks_question_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "bookmarks_user_question_key" ON "bookmarks" ("user_id","question_id");
CREATE INDEX IF NOT EXISTS "bookmarks_user_created_idx" ON "bookmarks" ("user_id","created_at");

CREATE TABLE IF NOT EXISTS "favorites" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL, "question_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "favorites_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "favorites_question_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "favorites_user_question_key" ON "favorites" ("user_id","question_id");
CREATE INDEX IF NOT EXISTS "favorites_user_created_idx" ON "favorites" ("user_id","created_at");

CREATE TABLE IF NOT EXISTS "recently_viewed" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL, "question_id" UUID NOT NULL,
  "viewed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "recently_viewed_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "recently_viewed_question_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "recently_viewed_user_question_key" ON "recently_viewed" ("user_id","question_id");
CREATE INDEX IF NOT EXISTS "recently_viewed_user_time_idx" ON "recently_viewed" ("user_id","viewed_at");

CREATE TABLE IF NOT EXISTS "topic_mastery" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL, "subject_id" UUID NOT NULL, "topic_id" UUID NOT NULL,
  "attempts" INT NOT NULL DEFAULT 0, "correct" INT NOT NULL DEFAULT 0,
  "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avg_time_sec" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mastery_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tier" "mastery_tier" NOT NULL DEFAULT 'novice',
  "last_practiced_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "topic_mastery_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "topic_mastery_user_topic_key" ON "topic_mastery" ("user_id","topic_id");
CREATE INDEX IF NOT EXISTS "topic_mastery_user_subject_idx" ON "topic_mastery" ("user_id","subject_id");
CREATE INDEX IF NOT EXISTS "topic_mastery_user_score_idx" ON "topic_mastery" ("user_id","mastery_score");

CREATE TABLE IF NOT EXISTS "study_goals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL, "period" "study_goal_period" NOT NULL,
  "target_questions" INT NOT NULL, "target_minutes" INT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "study_goals_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "study_goals_user_period_key" ON "study_goals" ("user_id","period");
CREATE INDEX IF NOT EXISTS "study_goals_user_active_idx" ON "study_goals" ("user_id","is_active");

CREATE TABLE IF NOT EXISTS "study_streak_days" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL, "date" DATE NOT NULL,
  "questions_answered" INT NOT NULL DEFAULT 0,
  "minutes_studied" INT NOT NULL DEFAULT 0,
  "goal_met" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "study_streak_days_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "study_streak_days_user_date_key" ON "study_streak_days" ("user_id","date");
CREATE INDEX IF NOT EXISTS "study_streak_days_user_date_idx" ON "study_streak_days" ("user_id","date");

CREATE TABLE IF NOT EXISTS "study_plans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL, "title" VARCHAR(200) NOT NULL, "description" TEXT,
  "start_date" DATE NOT NULL, "end_date" DATE NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "study_plans_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "study_plans_user_active_idx" ON "study_plans" ("user_id","is_active");

CREATE TABLE IF NOT EXISTS "study_plan_tasks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_id" UUID NOT NULL, "user_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL, "scheduled_date" DATE NOT NULL,
  "subject_id" UUID, "topic_id" UUID,
  "target_questions" INT NOT NULL DEFAULT 10,
  "status" "study_task_status" NOT NULL DEFAULT 'pending',
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "study_plan_tasks_plan_fkey" FOREIGN KEY ("plan_id") REFERENCES "study_plans"("id") ON DELETE CASCADE,
  CONSTRAINT "study_plan_tasks_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "study_plan_tasks_user_date_idx" ON "study_plan_tasks" ("user_id","scheduled_date");
CREATE INDEX IF NOT EXISTS "study_plan_tasks_plan_idx" ON "study_plan_tasks" ("plan_id");
CREATE INDEX IF NOT EXISTS "study_plan_tasks_user_status_idx" ON "study_plan_tasks" ("user_id","status");

CREATE TABLE IF NOT EXISTS "achievements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(50) NOT NULL UNIQUE,
  "name" VARCHAR(120) NOT NULL, "description" TEXT NOT NULL,
  "kind" "achievement_kind" NOT NULL,
  "threshold" INT NOT NULL DEFAULT 0,
  "xp_reward" INT NOT NULL DEFAULT 0,
  "icon" VARCHAR(80),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "achievements_kind_idx" ON "achievements" ("kind");

CREATE TABLE IF NOT EXISTS "student_achievements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL, "achievement_id" UUID NOT NULL,
  "earned_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "student_achievements_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "student_achievements_achievement_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "student_achievements_user_ach_key" ON "student_achievements" ("user_id","achievement_id");
CREATE INDEX IF NOT EXISTS "student_achievements_user_earned_idx" ON "student_achievements" ("user_id","earned_at");

CREATE TABLE IF NOT EXISTS "student_xp" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL UNIQUE,
  "total_xp" INT NOT NULL DEFAULT 0, "level" INT NOT NULL DEFAULT 1,
  "current_streak" INT NOT NULL DEFAULT 0, "longest_streak" INT NOT NULL DEFAULT 0,
  "last_activity_date" DATE,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "student_xp_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "student_xp_total_idx" ON "student_xp" ("total_xp");

CREATE TABLE IF NOT EXISTS "knowledge_gaps" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL, "subject_id" UUID NOT NULL, "topic_id" UUID NOT NULL,
  "severity" "knowledge_gap_severity" NOT NULL,
  "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "attempts" INT NOT NULL DEFAULT 0,
  "recommendation" TEXT, "resolved_at" TIMESTAMPTZ,
  "detected_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "knowledge_gaps_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_gaps_user_topic_key" ON "knowledge_gaps" ("user_id","topic_id");
CREATE INDEX IF NOT EXISTS "knowledge_gaps_user_severity_idx" ON "knowledge_gaps" ("user_id","severity");

CREATE TABLE IF NOT EXISTS "learning_paths" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL, "title" VARCHAR(200) NOT NULL,
  "steps" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "generated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "learning_paths_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "learning_paths_user_active_idx" ON "learning_paths" ("user_id","is_active");
