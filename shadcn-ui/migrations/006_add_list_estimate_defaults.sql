-- Migration 006: Add estimate default fields to lists table
-- Purpose: Support default values for environments and stakeholders at list level

-- Add default_environments column
ALTER TABLE app_5939507989_lists
ADD COLUMN IF NOT EXISTS default_environments TEXT CHECK (default_environments IN ('1 env', '2 env', '3 env'));

-- Add default_stakeholders column
ALTER TABLE app_5939507989_lists
ADD COLUMN IF NOT EXISTS default_stakeholders TEXT CHECK (default_stakeholders IN ('1 team', '2-3 team', '4+ team'));

-- Add comments for documentation
COMMENT ON COLUMN app_5939507989_lists.default_environments IS 'Default number of environments for estimates in this list (cascades to new estimates)';
COMMENT ON COLUMN app_5939507989_lists.default_stakeholders IS 'Default stakeholder complexity for estimates in this list (cascades to new estimates)';
