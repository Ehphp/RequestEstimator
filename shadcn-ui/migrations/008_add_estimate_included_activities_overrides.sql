-- ============================================================================
-- MIGRATION 008: Add included_activities_overrides to estimates
-- ============================================================================
-- Purpose: Add a JSONB column to store per-estimate activity overrides (name/days/group)
-- so the frontend can persist per-estimate overrides without causing REST upsert errors.
-- IMPORTANT: Review and apply on staging before production.
-- ============================================================================

BEGIN;

ALTER TABLE IF EXISTS app_5939507989_estimates
  ADD COLUMN IF NOT EXISTS included_activities_overrides jsonb NULL;

-- Optional: add a comment describing the shape
COMMENT ON COLUMN app_5939507989_estimates.included_activities_overrides IS
  'Optional per-estimate overrides for activities. Expected shape: [{"activity_code":string,"override_name":string?,"override_days":number?,"override_group":string?}]';

COMMIT;

-- NOTES:
-- After applying, the frontend can upsert Estimate objects containing the
-- included_activities_overrides property. No backfill is necessary.
-- Run this migration using psql or Supabase SQL editor.
