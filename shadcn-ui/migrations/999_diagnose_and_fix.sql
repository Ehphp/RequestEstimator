-- ============================================================================
-- DIAGNOSTIC & FIX SCRIPT
-- ============================================================================
-- Purpose: Diagnose and fix the "query has no destination for result data" error
-- Date: 2025-11-10
-- ============================================================================

-- ============================================================================
-- PHASE 1: DIAGNOSTICS - Show all triggers and functions on requirements table
-- ============================================================================

-- 1. List all triggers on requirements table
SELECT 
    tgname AS trigger_name,
    tgtype AS trigger_type,
    tgenabled AS enabled,
    proname AS function_name,
    prosrc AS function_source
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'app_5939507989_requirements'
AND tgname NOT LIKE 'RI_%'  -- Exclude RI triggers (foreign keys)
ORDER BY tgname;

-- 2. List all functions that reference the requirements table
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
WHERE pg_get_functiondef(p.oid) LIKE '%app_5939507989_requirements%'
ORDER BY p.proname;

-- ============================================================================
-- PHASE 2: COMMON FIXES
-- ============================================================================

-- FIX 1: Drop any audit log trigger (if exists from migration 003)
DROP TRIGGER IF EXISTS trg_audit_requirements ON app_5939507989_requirements;

-- FIX 2: Drop any validation trigger (if exists)
DROP TRIGGER IF EXISTS trg_validate_estimate_calculations ON app_5939507989_estimates;
DROP TRIGGER IF EXISTS trg_update_requirement_timestamp ON app_5939507989_requirements;
DROP TRIGGER IF EXISTS trg_validate_estimate_risks ON app_5939507989_estimates;
DROP TRIGGER IF EXISTS trg_validate_estimate_activities ON app_5939507989_estimates;

-- FIX 3: Check for any custom trigger you might have created
-- Run this and then drop any suspect triggers:
-- DROP TRIGGER IF EXISTS <trigger_name> ON app_5939507989_requirements;

-- ============================================================================
-- PHASE 3: VERIFY FIX
-- ============================================================================

-- After applying fixes, verify no triggers remain:
SELECT 
    tgname AS trigger_name,
    tgtype AS trigger_type
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'app_5939507989_requirements'
AND tgname NOT LIKE 'RI_%'
ORDER BY tgname;

-- Expected result: No rows (or only RI_% triggers which are for FKs)

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- 
-- After running this script:
-- 1. Check if any triggers were dropped
-- 2. Try creating a requirement from the app
-- 3. If still failing, run PHASE 1 again to see what's left
-- 4. Look for triggers with SELECT statements that don't have INTO or RETURN
--
-- Common problematic pattern in triggers:
--    SELECT something FROM table;  -- ❌ BAD - no destination
--    SELECT something INTO var FROM table;  -- ✅ GOOD
--    RETURN NEW;  -- ✅ GOOD
-- ============================================================================
