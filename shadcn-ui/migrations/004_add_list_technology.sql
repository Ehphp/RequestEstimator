/*
  Adds the `technology` column to app_5939507989_lists so that each list can
  declare the reference stack/platform (es. "Power Platform", "Dynamics CRM").
  The column is populated for legacy rows and enforced with a default to keep
  backwards compatibility with existing inserts.
*/

BEGIN;

ALTER TABLE app_5939507989_lists
  ADD COLUMN IF NOT EXISTS technology TEXT;

COMMENT ON COLUMN app_5939507989_lists.technology IS
  'Stack tecnologico o piattaforma associata alla lista (es. Power Platform, Dynamics)';

UPDATE app_5939507989_lists
SET technology = COALESCE(technology, 'Power Platform');

ALTER TABLE app_5939507989_lists
  ALTER COLUMN technology SET DEFAULT 'Power Platform';

COMMIT;
