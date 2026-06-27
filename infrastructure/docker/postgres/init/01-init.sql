-- =============================================================================
-- CE Board Master — PostgreSQL Initialization
-- Runs once on first container start
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search

-- Create a read-only analytics user (mirrors production RDS analytics user)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ceboardmaster_analytics') THEN
    CREATE ROLE ceboardmaster_analytics WITH LOGIN PASSWORD 'analytics_password';
    GRANT CONNECT ON DATABASE ceboardmaster_dev TO ceboardmaster_analytics;
    GRANT USAGE ON SCHEMA public TO ceboardmaster_analytics;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO ceboardmaster_analytics;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ceboardmaster_analytics;
  END IF;
END
$$;

-- =============================================================================
-- Trigger function: automatically update updated_at on every row update
-- This function is applied to every business table in migrations.
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Trigger function: prevent updates on immutable tables
-- Applied to: login_attempts, question_versions, question_review_workflow
-- =============================================================================
CREATE OR REPLACE FUNCTION prevent_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Updates are not allowed on this immutable table: %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
