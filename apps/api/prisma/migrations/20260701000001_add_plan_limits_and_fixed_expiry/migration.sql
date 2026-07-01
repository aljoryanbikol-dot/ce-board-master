-- =============================================================================
-- Migration: 20260701000001_add_plan_limits_and_fixed_expiry
-- Sprint 3.3 — Subscription pricing/limits become DB-configurable per plan.
--
-- All additive. No existing data modified. Zero downtime.
-- =============================================================================

-- 'custom' interval: a plan whose every purchase expires on the same fixed
-- date regardless of purchase date (e.g. "Board Pass — valid until the next
-- scheduled PRC CE board exam"). Safe to add a value to an existing enum
-- inside a transaction as long as the value isn't used in the same one.
ALTER TYPE "plan_interval" ADD VALUE IF NOT EXISTS 'custom';

-- fixed_expiry_date: used only by interval=custom plans.
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "fixed_expiry_date" TIMESTAMPTZ;

-- limits: free-tier usage caps, e.g. {"maxQuestions":100,"maxMockExams":1}.
-- Null/empty for unlimited (paid) plans. Single configurable source of truth
-- for FeatureAccessService — replaces the previous env-var-backed constants.
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "limits" JSONB;
