-- ============================================================================
-- MIGRATION 007: Per-list Activity Catalog
-- ============================================================================
-- Purpose: Add a table to persist activity/section customizations per list and per technology.
-- This allows lists to have a custom catalog (groups + activities) that the UI can load
-- and update. Implemented as a JSONB payload for flexibility.
-- IMPORTANT: Review on a staging DB before applying to production.
-- ============================================================================

BEGIN;

-- Create table (Postgres / Supabase)
CREATE TABLE IF NOT EXISTS app_5939507989_list_activity_catalogs (
  id bigserial PRIMARY KEY,
  list_id text NOT NULL,
  technology text NULL,
  catalog jsonb NOT NULL,
  created_on timestamptz NOT NULL DEFAULT now(),
  updated_on timestamptz NOT NULL DEFAULT now(),
  created_by text NULL
);

-- Foreign key to lists (cascade on delete so catalogs are removed when list is removed)
ALTER TABLE app_5939507989_list_activity_catalogs
  ADD CONSTRAINT fk_list_activity_catalogs_list_id
  FOREIGN KEY (list_id)
  REFERENCES app_5939507989_lists(list_id)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Unique constraint so we can upsert by list_id+technology
CREATE UNIQUE INDEX IF NOT EXISTS ux_list_activity_catalogs_listid_tech
  ON app_5939507989_list_activity_catalogs(list_id, technology);

-- Index on list_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_list_activity_catalogs_list_id
  ON app_5939507989_list_activity_catalogs(list_id);

-- Trigger to keep updated_on current
CREATE OR REPLACE FUNCTION trg_set_updated_on()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_on = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_on_list_activity_catalogs ON app_5939507989_list_activity_catalogs;
CREATE TRIGGER set_updated_on_list_activity_catalogs
BEFORE UPDATE ON app_5939507989_list_activity_catalogs
FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_on();

COMMIT;

-- ============================================================================
-- NOTES:
-- - The `catalog` jsonb should contain an object like:
--   { "groups": [ { "group": "Core", "activities": [ { ...Activity shape... } ] } ] }
-- - The application (frontend) is responsible for merging the persisted catalog with
--   the canonical activities table when building the UI (overrides and custom items).
-- - When upserting from the app, use the unique index (list_id, technology) to replace or insert.
-- ============================================================================
