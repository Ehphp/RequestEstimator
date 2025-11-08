-- ============================================================================
-- ROLLBACK SCRIPT: Emergency Rollback for Migrations 001 & 002
-- ============================================================================
-- Purpose: Disabilitare tutte le validazioni e RLS policies
-- Author: AI Assistant
-- Date: 2025-11-08
-- Status: ⚠️ EMERGENCY USE ONLY
--
-- WHEN TO USE:
-- - Critical production issue caused by constraints/RLS
-- - Need immediate rollback to previous state
-- - After testing this script in test environment
--
-- EXECUTION ORDER:
-- 1. Backup database BEFORE rollback
-- 2. Test in non-production first
-- 3. Document reason for rollback
-- 4. Plan fix and re-deployment
-- ============================================================================

-- ============================================================================
-- PHASE 1: DISABLE RLS POLICIES
-- ============================================================================

BEGIN;

-- Disable RLS su tabelle dati
ALTER TABLE app_5939507989_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_requirements DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_estimates DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_sticky_defaults DISABLE ROW LEVEL SECURITY;

-- Disable RLS su catalog tables
ALTER TABLE app_5939507989_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_drivers DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_risks DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_contingency_bands DISABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- PHASE 2: DROP RLS POLICIES
-- ============================================================================

BEGIN;

-- Lists policies
DROP POLICY IF EXISTS "lists_permissive_all" ON app_5939507989_lists;
DROP POLICY IF EXISTS "lists_select_all" ON app_5939507989_lists;
DROP POLICY IF EXISTS "lists_insert_authenticated" ON app_5939507989_lists;
DROP POLICY IF EXISTS "lists_update_owner" ON app_5939507989_lists;
DROP POLICY IF EXISTS "lists_delete_owner" ON app_5939507989_lists;

-- Requirements policies
DROP POLICY IF EXISTS "requirements_permissive_all" ON app_5939507989_requirements;
DROP POLICY IF EXISTS "requirements_select_all" ON app_5939507989_requirements;
DROP POLICY IF EXISTS "requirements_select_business_owner" ON app_5939507989_requirements;
DROP POLICY IF EXISTS "requirements_insert_list_access" ON app_5939507989_requirements;
DROP POLICY IF EXISTS "requirements_update_list_owner" ON app_5939507989_requirements;
DROP POLICY IF EXISTS "requirements_delete_list_owner" ON app_5939507989_requirements;

-- Estimates policies
DROP POLICY IF EXISTS "estimates_permissive_all" ON app_5939507989_estimates;
DROP POLICY IF EXISTS "estimates_select_all" ON app_5939507989_estimates;
DROP POLICY IF EXISTS "estimates_insert_requirement_access" ON app_5939507989_estimates;
DROP POLICY IF EXISTS "estimates_delete_list_owner" ON app_5939507989_estimates;

-- Sticky defaults policies
DROP POLICY IF EXISTS "sticky_defaults_user_access" ON app_5939507989_sticky_defaults;

-- Catalog policies
DROP POLICY IF EXISTS "activities_select_all" ON app_5939507989_activities;
DROP POLICY IF EXISTS "activities_admin_modify" ON app_5939507989_activities;
DROP POLICY IF EXISTS "drivers_select_all" ON app_5939507989_drivers;
DROP POLICY IF EXISTS "drivers_admin_modify" ON app_5939507989_drivers;
DROP POLICY IF EXISTS "risks_select_all" ON app_5939507989_risks;
DROP POLICY IF EXISTS "risks_admin_modify" ON app_5939507989_risks;
DROP POLICY IF EXISTS "contingency_bands_select_all" ON app_5939507989_contingency_bands;
DROP POLICY IF EXISTS "contingency_bands_admin_modify" ON app_5939507989_contingency_bands;

COMMIT;

-- ============================================================================
-- PHASE 3: DROP CHECK CONSTRAINTS
-- ============================================================================

BEGIN;

-- Lists constraints
ALTER TABLE app_5939507989_lists
DROP CONSTRAINT IF EXISTS chk_lists_status;

-- Requirements constraints
ALTER TABLE app_5939507989_requirements
DROP CONSTRAINT IF EXISTS chk_requirements_priority,
DROP CONSTRAINT IF EXISTS chk_requirements_state;

-- Estimates constraints - Enum
ALTER TABLE app_5939507989_estimates
DROP CONSTRAINT IF EXISTS chk_estimates_complexity,
DROP CONSTRAINT IF EXISTS chk_estimates_environments,
DROP CONSTRAINT IF EXISTS chk_estimates_reuse,
DROP CONSTRAINT IF EXISTS chk_estimates_stakeholders;

-- Estimates constraints - Range
ALTER TABLE app_5939507989_estimates
DROP CONSTRAINT IF EXISTS chk_estimates_activities_base_days,
DROP CONSTRAINT IF EXISTS chk_estimates_driver_multiplier,
DROP CONSTRAINT IF EXISTS chk_estimates_subtotal_days,
DROP CONSTRAINT IF EXISTS chk_estimates_risk_score,
DROP CONSTRAINT IF EXISTS chk_estimates_contingency_pct,
DROP CONSTRAINT IF EXISTS chk_estimates_contingency_days,
DROP CONSTRAINT IF EXISTS chk_estimates_total_days,
DROP CONSTRAINT IF EXISTS chk_estimates_total_calculation;

-- Activities constraints
ALTER TABLE app_5939507989_activities
DROP CONSTRAINT IF EXISTS chk_activities_status,
DROP CONSTRAINT IF EXISTS chk_activities_base_days_positive;

-- Drivers constraints
ALTER TABLE app_5939507989_drivers
DROP CONSTRAINT IF EXISTS chk_drivers_multiplier_positive;

-- Risks constraints
ALTER TABLE app_5939507989_risks
DROP CONSTRAINT IF EXISTS chk_risks_weight_nonnegative;

-- Contingency bands constraints
ALTER TABLE app_5939507989_contingency_bands
DROP CONSTRAINT IF EXISTS chk_contingency_pct_range;

-- Sticky defaults constraints
ALTER TABLE app_5939507989_sticky_defaults
DROP CONSTRAINT IF EXISTS chk_sticky_complexity,
DROP CONSTRAINT IF EXISTS chk_sticky_environments,
DROP CONSTRAINT IF EXISTS chk_sticky_reuse,
DROP CONSTRAINT IF EXISTS chk_sticky_stakeholders;

COMMIT;

-- ============================================================================
-- PHASE 4: DROP FOREIGN KEYS
-- ============================================================================

BEGIN;

-- ⚠️ CRITICAL: Dopo questo step, non ci sarà più cascade delete automatico
-- L'app dovrà gestire manualmente le eliminazioni a cascata (come prima)

ALTER TABLE app_5939507989_requirements
DROP CONSTRAINT IF EXISTS fk_requirements_list_id;

ALTER TABLE app_5939507989_estimates
DROP CONSTRAINT IF EXISTS fk_estimates_req_id;

ALTER TABLE app_5939507989_sticky_defaults
DROP CONSTRAINT IF EXISTS fk_sticky_defaults_list_id;

COMMIT;

-- ============================================================================
-- PHASE 5: REMOVE DEFAULT VALUES (Optional - Solo se causano problemi)
-- ============================================================================
-- ⚠️ UNCOMMENT ONLY IF DEFAULT VALUES CAUSE ISSUES

/*
BEGIN;

-- Lists
ALTER TABLE app_5939507989_lists
ALTER COLUMN status DROP DEFAULT;

-- Requirements
ALTER TABLE app_5939507989_requirements
ALTER COLUMN description DROP DEFAULT,
ALTER COLUMN priority DROP DEFAULT,
ALTER COLUMN state DROP DEFAULT;

-- Estimates
ALTER TABLE app_5939507989_estimates
ALTER COLUMN scenario DROP DEFAULT,
ALTER COLUMN included_activities DROP DEFAULT,
ALTER COLUMN optional_activities DROP DEFAULT,
ALTER COLUMN include_optional DROP DEFAULT,
ALTER COLUMN selected_risks DROP DEFAULT,
ALTER COLUMN catalog_version DROP DEFAULT,
ALTER COLUMN drivers_version DROP DEFAULT,
ALTER COLUMN riskmap_version DROP DEFAULT,
ALTER COLUMN complexity_is_overridden DROP DEFAULT,
ALTER COLUMN environments_is_overridden DROP DEFAULT,
ALTER COLUMN reuse_is_overridden DROP DEFAULT,
ALTER COLUMN stakeholders_is_overridden DROP DEFAULT,
ALTER COLUMN activities_is_overridden DROP DEFAULT,
ALTER COLUMN risks_is_overridden DROP DEFAULT;

-- Activities
ALTER TABLE app_5939507989_activities
ALTER COLUMN status DROP DEFAULT;

-- Sticky defaults
ALTER TABLE app_5939507989_sticky_defaults
ALTER COLUMN updated_on DROP DEFAULT,
ALTER COLUMN included_activities DROP DEFAULT;

COMMIT;
*/

-- ============================================================================
-- PHASE 6: REMOVE NOT NULL CONSTRAINTS (Optional - Risky!)
-- ============================================================================
-- ⚠️ UNCOMMENT ONLY IF ABSOLUTELY NECESSARY
-- Rimuovere NOT NULL può portare a dati inconsistenti

/*
BEGIN;

-- Lists
ALTER TABLE app_5939507989_lists
ALTER COLUMN name DROP NOT NULL,
ALTER COLUMN created_on DROP NOT NULL,
ALTER COLUMN created_by DROP NOT NULL,
ALTER COLUMN status DROP NOT NULL;

-- Requirements
ALTER TABLE app_5939507989_requirements
ALTER COLUMN title DROP NOT NULL,
ALTER COLUMN description DROP NOT NULL,
ALTER COLUMN priority DROP NOT NULL,
ALTER COLUMN state DROP NOT NULL,
ALTER COLUMN business_owner DROP NOT NULL,
ALTER COLUMN created_on DROP NOT NULL;

-- Estimates - Solo campi critico
ALTER TABLE app_5939507989_estimates
ALTER COLUMN scenario DROP NOT NULL,
ALTER COLUMN complexity DROP NOT NULL,
ALTER COLUMN environments DROP NOT NULL,
ALTER COLUMN reuse DROP NOT NULL,
ALTER COLUMN stakeholders DROP NOT NULL;

COMMIT;
*/

-- ============================================================================
-- PHASE 7: DROP INDEXES (Optional - Solo se causano performance issue)
-- ============================================================================
-- ⚠️ Rimuovere indici può peggiorare performance!
-- UNCOMMENT ONLY IN EXTREME CASES

/*
BEGIN;

-- Performance indexes
DROP INDEX IF EXISTS idx_requirements_list_id;
DROP INDEX IF EXISTS idx_estimates_req_id;
DROP INDEX IF EXISTS idx_lists_status;
DROP INDEX IF EXISTS idx_requirements_state;
DROP INDEX IF EXISTS idx_requirements_priority;
DROP INDEX IF EXISTS idx_activities_status;
DROP INDEX IF EXISTS idx_estimates_created_on;
DROP INDEX IF EXISTS idx_requirements_created_on;
DROP INDEX IF EXISTS idx_lists_created_on;
DROP INDEX IF EXISTS idx_sticky_defaults_user_list;

COMMIT;
*/

-- ============================================================================
-- PHASE 8: DROP HELPER FUNCTIONS & VIEWS
-- ============================================================================

BEGIN;

-- RLS testing function
DROP FUNCTION IF EXISTS test_rls_access(TEXT, TEXT);

-- Performance monitoring view
DROP VIEW IF EXISTS v_rls_performance_monitor;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename LIKE 'app_5939507989_%'
ORDER BY tablename;

-- Expected: rowsecurity = FALSE for all tables

-- Verify no policies exist
SELECT 
    schemaname,
    tablename,
    policyname
FROM pg_policies
WHERE tablename LIKE 'app_5939507989_%';

-- Expected: No rows returned

-- Verify no CHECK constraints
SELECT 
    conname,
    conrelid::regclass AS table_name
FROM pg_constraint
WHERE contype = 'c'
AND conrelid::regclass::text LIKE 'app_5939507989_%';

-- Expected: Minimal or no CHECK constraints

-- Verify no FK constraints
SELECT 
    conname,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE contype = 'f'
AND conrelid::regclass::text LIKE 'app_5939507989_%';

-- Expected: No rows returned

-- ============================================================================
-- POST-ROLLBACK ACTIONS REQUIRED
-- ============================================================================

/*
ACTION ITEMS AFTER ROLLBACK:

1. ✅ VERIFY APPLICATION FUNCTIONALITY
   - Test create/read/update/delete operations
   - Verify no breaking changes
   - Check error logs

2. 📝 DOCUMENT ROLLBACK REASON
   - What constraint/policy caused issue?
   - What data triggered the problem?
   - What was the error message?

3. 🔧 FIX ROOT CAUSE
   - Adjust constraint logic if too restrictive
   - Fix data quality issues
   - Update validation rules

4. 🧪 RE-TEST IN TEST ENVIRONMENT
   - Apply corrected migrations
   - Test edge cases that failed
   - Verify no regressions

5. 🚀 PLAN RE-DEPLOYMENT
   - Schedule maintenance window
   - Prepare communication
   - Have rollback plan ready again

6. ⚠️ RE-ENABLE MANUAL CASCADE DELETE IN STORAGE.TS
   - FK CASCADE delete è stato rimosso
   - storage.ts:deleteList() deve gestire cascade manualmente
   - storage.ts:deleteRequirement() deve gestire cascade manualmente
   
   Code to restore in storage.ts:
   
   deleteList():
   - Step 1: Get requirement IDs
   - Step 2: Delete estimates for those requirements
   - Step 3: Delete requirements
   - Step 4: Delete list
   
   deleteRequirement():
   - Step 1: Delete estimates
   - Step 2: Delete requirement

7. 🔍 MONITORING
   - Monitor database performance
   - Check for orphan records
   - Verify data integrity

*/

-- ============================================================================
-- EMERGENCY CONTACTS & ESCALATION
-- ============================================================================

/*
If rollback doesn't resolve the issue:

1. Check Supabase Dashboard:
   - Database > Logs
   - Database > Errors
   - API > Logs

2. Review storage.ts:
   - All CRUD operations
   - Error handling
   - Transaction logic

3. Check client-side errors:
   - Browser console
   - Network tab
   - Sentry/error tracking

4. Restore from backup if needed:
   - Supabase Dashboard > Database > Backups
   - Select pre-migration backup
   - Restore and verify
*/

-- ============================================================================
-- ROLLBACK SCRIPT COMPLETE
-- ============================================================================

SELECT 'Rollback script execution complete' AS status,
       'Verify all phases completed successfully' AS next_step,
       'Review POST-ROLLBACK ACTIONS above' AS important;
