-- =============================================================================
-- Migration: 20260627000002_add_subscription_billing
-- Sprint 2.5 — Enterprise Subscription & Billing
--
-- All additive. Creates 7 enums and 6 tables. No existing data modified.
-- Zero downtime. Rollback drops the new tables and types.
-- =============================================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "plan_interval"         AS ENUM ('free','monthly','quarterly','annual','lifetime');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "subscription_status"   AS ENUM ('trialing','active','past_due','grace','canceled','expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "payment_status"        AS ENUM ('pending','processing','succeeded','failed','refunded','canceled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "payment_provider_type" AS ENUM ('paymongo','xendit','stripe','mock');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "payment_method_type"   AS ENUM ('gcash','maya','online_banking','qrph','credit_card','debit_card');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "invoice_status"        AS ENUM ('draft','issued','paid','void');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "webhook_status"        AS ENUM ('received','processed','duplicate','failed','invalid_signature');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── subscription_plans ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"          VARCHAR(120) NOT NULL,
  "slug"          VARCHAR(60)  NOT NULL UNIQUE,
  "tier"          "subscription_tier" NOT NULL,
  "interval"      "plan_interval"     NOT NULL,
  "price_minor"   INTEGER NOT NULL,
  "currency"      CHAR(3) NOT NULL DEFAULT 'PHP',
  "duration_days" INTEGER,
  "trial_days"    INTEGER NOT NULL DEFAULT 0,
  "features"      JSONB   NOT NULL DEFAULT '[]',
  "is_active"     BOOLEAN NOT NULL DEFAULT TRUE,
  "sort_order"    SMALLINT NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at"    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "subscription_plans_tier_idx"      ON "subscription_plans"("tier");
CREATE INDEX IF NOT EXISTS "subscription_plans_interval_idx"  ON "subscription_plans"("interval");
CREATE INDEX IF NOT EXISTS "subscription_plans_is_active_idx" ON "subscription_plans"("is_active");

-- ── subscriptions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"              UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "plan_id"              UUID NOT NULL REFERENCES "subscription_plans"("id") ON DELETE RESTRICT,
  "status"               "subscription_status" NOT NULL DEFAULT 'trialing',
  "current_period_start" TIMESTAMPTZ,
  "current_period_end"   TIMESTAMPTZ,
  "trial_ends_at"        TIMESTAMPTZ,
  "grace_ends_at"        TIMESTAMPTZ,
  "canceled_at"          TIMESTAMPTZ,
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT FALSE,
  "auto_renew"           BOOLEAN NOT NULL DEFAULT TRUE,
  "provider_type"        "payment_provider_type",
  "provider_ref"         TEXT,
  "version"              INTEGER NOT NULL DEFAULT 0,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx"            ON "subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_plan_id_idx"            ON "subscriptions"("plan_id");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx"             ON "subscriptions"("status");
CREATE INDEX IF NOT EXISTS "subscriptions_current_period_end_idx" ON "subscriptions"("current_period_end");
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_status_idx"     ON "subscriptions"("user_id","status");

-- ── payments ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "payments" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"         UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "subscription_id" UUID REFERENCES "subscriptions"("id") ON DELETE SET NULL,
  "amount_minor"    INTEGER NOT NULL,
  "currency"        CHAR(3) NOT NULL DEFAULT 'PHP',
  "status"          "payment_status" NOT NULL DEFAULT 'pending',
  "provider_type"   "payment_provider_type" NOT NULL,
  "method_type"     "payment_method_type",
  "provider_ref"    TEXT,
  "idempotency_key" VARCHAR(120) UNIQUE,
  "checkout_url"    TEXT,
  "failure_reason"  TEXT,
  "paid_at"         TIMESTAMPTZ,
  "refunded_at"     TIMESTAMPTZ,
  "metadata"        JSONB NOT NULL DEFAULT '{}',
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "payments_user_id_idx"         ON "payments"("user_id");
CREATE INDEX IF NOT EXISTS "payments_subscription_id_idx" ON "payments"("subscription_id");
CREATE INDEX IF NOT EXISTS "payments_status_idx"          ON "payments"("status");
CREATE INDEX IF NOT EXISTS "payments_provider_ref_idx"    ON "payments"("provider_ref");
CREATE INDEX IF NOT EXISTS "payments_created_at_idx"      ON "payments"("created_at");

-- ── invoices ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "invoices" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"         UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "subscription_id" UUID REFERENCES "subscriptions"("id") ON DELETE SET NULL,
  "payment_id"      UUID UNIQUE REFERENCES "payments"("id") ON DELETE SET NULL,
  "number"          VARCHAR(40) NOT NULL UNIQUE,
  "status"          "invoice_status" NOT NULL DEFAULT 'draft',
  "subtotal_minor"  INTEGER NOT NULL,
  "tax_minor"       INTEGER NOT NULL DEFAULT 0,
  "total_minor"     INTEGER NOT NULL,
  "currency"        CHAR(3) NOT NULL DEFAULT 'PHP',
  "line_items"      JSONB NOT NULL DEFAULT '[]',
  "receipt_url"     TEXT,
  "issued_at"       TIMESTAMPTZ,
  "paid_at"         TIMESTAMPTZ,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "invoices_user_id_idx" ON "invoices"("user_id");
CREATE INDEX IF NOT EXISTS "invoices_status_idx"  ON "invoices"("status");
CREATE INDEX IF NOT EXISTS "invoices_number_idx"  ON "invoices"("number");

-- ── payment_webhooks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "payment_webhooks" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider_type"   "payment_provider_type" NOT NULL,
  "event_id"        VARCHAR(200) NOT NULL,
  "event_type"      VARCHAR(100) NOT NULL,
  "payment_id"      UUID REFERENCES "payments"("id") ON DELETE SET NULL,
  "status"          "webhook_status" NOT NULL DEFAULT 'received',
  "signature_valid" BOOLEAN NOT NULL DEFAULT FALSE,
  "payload"         JSONB NOT NULL,
  "error"           TEXT,
  "received_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "processed_at"    TIMESTAMPTZ,
  CONSTRAINT "payment_webhooks_provider_event_key" UNIQUE ("provider_type","event_id")
);
CREATE INDEX IF NOT EXISTS "payment_webhooks_status_idx"      ON "payment_webhooks"("status");
CREATE INDEX IF NOT EXISTS "payment_webhooks_event_type_idx"  ON "payment_webhooks"("event_type");
CREATE INDEX IF NOT EXISTS "payment_webhooks_received_at_idx" ON "payment_webhooks"("received_at");

-- ── payment_logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "payment_logs" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "payment_id"  UUID NOT NULL REFERENCES "payments"("id") ON DELETE CASCADE,
  "action"      VARCHAR(80) NOT NULL,
  "from_status" VARCHAR(40),
  "to_status"   VARCHAR(40),
  "actor_id"    UUID,
  "detail"      JSONB NOT NULL DEFAULT '{}',
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "payment_logs_payment_id_idx" ON "payment_logs"("payment_id");
CREATE INDEX IF NOT EXISTS "payment_logs_created_at_idx" ON "payment_logs"("created_at");

-- ──────────────────────────────────────────────────────────────────────────────
-- Migration complete. Rollback:
--   DROP TABLE payment_logs, payment_webhooks, invoices, payments, subscriptions, subscription_plans;
--   DROP TYPE webhook_status, invoice_status, payment_method_type, payment_provider_type,
--             payment_status, subscription_status, plan_interval;
-- ──────────────────────────────────────────────────────────────────────────────
