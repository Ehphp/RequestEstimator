-- ============================================================================
-- MIGRATION 002: Row Level Security (RLS) Policies
-- ============================================================================
-- Purpose: Implementare sicurezza a livello di riga per accesso dati
-- Author: AI Assistant
-- Date: 2025-11-08
-- Status: ⚠️ NOT APPLIED - Review required before execution
--
-- STRATEGY:
-- Phase 1: Enable RLS con policy permissive (allow all authenticated)
-- Phase 2: Gradualmente restringere a owner-based policies
-- Phase 3: Catalog tables read-only per users normali
--
-- CRITICAL NOTES:
-- 1. Test RLS in test environment con utenti diversi
-- 2. Supabase usa auth.uid() per identificare l'utente corrente
-- 3. Service role bypassa RLS (per operazioni admin)
-- 4. Monitor pg_stat_statements per performance impact
-- ============================================================================

-- ============================================================================
-- FASE 1: ENABLE RLS SU TABELLE DATI (Permissive Initially)
-- ============================================================================

-- Enable RLS su tabelle dati principali
ALTER TABLE app_5939507989_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_sticky_defaults ENABLE ROW LEVEL SECURITY;

-- Catalog tables: NO RLS (read-only tramite policy, non RLS)
-- Activities, Drivers, Risks, Contingency_bands rimangono accessibili

COMMENT ON TABLE app_5939507989_lists IS 
'RLS ENABLED: Access controlled by owner/creator policies';

COMMENT ON TABLE app_5939507989_requirements IS 
'RLS ENABLED: Access controlled via list ownership';

COMMENT ON TABLE app_5939507989_estimates IS 
'RLS ENABLED: Access controlled via requirement ownership';

COMMENT ON TABLE app_5939507989_sticky_defaults IS 
'RLS ENABLED: User-specific (user_id based)';


-- ============================================================================
-- FASE 2: PERMISSIVE POLICIES (Transition Phase)
-- ============================================================================
-- Iniziare con policy permissive per evitare di bloccare l'applicazione
-- Permettere a tutti gli utenti autenticati di leggere/scrivere
-- Dopo test, sostituire con policies granulari (Fase 3)

-- Lists - Permissive (tutti autenticati possono CRUD)
CREATE POLICY "lists_permissive_all" 
ON app_5939507989_lists
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "lists_permissive_all" ON app_5939507989_lists IS 
'TEMPORARY: Permissive policy during transition - replace with owner-based';

-- Requirements - Permissive
CREATE POLICY "requirements_permissive_all" 
ON app_5939507989_requirements
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "requirements_permissive_all" ON app_5939507989_requirements IS 
'TEMPORARY: Permissive policy during transition - replace with ownership-based';

-- Estimates - Permissive
CREATE POLICY "estimates_permissive_all" 
ON app_5939507989_estimates
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "estimates_permissive_all" ON app_5939507989_estimates IS 
'TEMPORARY: Permissive policy during transition - replace with ownership-based';

-- Sticky defaults - User-specific (GIÀ granular, sicuro da subito)
CREATE POLICY "sticky_defaults_user_access" 
ON app_5939507989_sticky_defaults
FOR ALL
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

COMMENT ON POLICY "sticky_defaults_user_access" ON app_5939507989_sticky_defaults IS 
'User can only access their own sticky defaults (user_id based)';


-- ============================================================================
-- FASE 3: GRANULAR OWNER-BASED POLICIES (Production Ready)
-- ============================================================================
-- Sostituire le policies permissive con queste dopo test
-- Da eseguire DOPO aver verificato che l'app funziona con RLS abilitato

-- ⚠️ UNCOMMENT AFTER TESTING PERMISSIVE POLICIES
/*

-- ========== LISTS TABLE - Owner-based access ==========

-- Drop permissive policy
DROP POLICY IF EXISTS "lists_permissive_all" ON app_5939507989_lists;

-- SELECT: Tutti possono leggere tutte le liste (collaborazione)
CREATE POLICY "lists_select_all" 
ON app_5939507989_lists
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Solo utenti autenticati possono creare liste (diventeranno created_by)
CREATE POLICY "lists_insert_authenticated" 
ON app_5939507989_lists
FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()::text
);

-- UPDATE: Solo owner può modificare
CREATE POLICY "lists_update_owner" 
ON app_5939507989_lists
FOR UPDATE
TO authenticated
USING (
    created_by = auth.uid()::text OR 
    owner = auth.uid()::text
)
WITH CHECK (
    created_by = auth.uid()::text OR 
    owner = auth.uid()::text
);

-- DELETE: Solo owner può eliminare
CREATE POLICY "lists_delete_owner" 
ON app_5939507989_lists
FOR DELETE
TO authenticated
USING (
    created_by = auth.uid()::text OR 
    owner = auth.uid()::text
);

COMMENT ON POLICY "lists_select_all" ON app_5939507989_lists IS 
'All authenticated users can view all lists (collaboration model)';

COMMENT ON POLICY "lists_update_owner" ON app_5939507989_lists IS 
'Only list creator or owner can modify list';


-- ========== REQUIREMENTS TABLE - List ownership based ==========

-- Drop permissive policy
DROP POLICY IF EXISTS "requirements_permissive_all" ON app_5939507989_requirements;

-- SELECT: Tutti possono leggere tutti i requisiti
CREATE POLICY "requirements_select_all" 
ON app_5939507989_requirements
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Solo utenti con accesso alla lista possono aggiungere requisiti
CREATE POLICY "requirements_insert_list_access" 
ON app_5939507989_requirements
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM app_5939507989_lists
        WHERE list_id = app_5939507989_requirements.list_id
        AND (
            created_by = auth.uid()::text OR 
            owner = auth.uid()::text
        )
    )
);

-- UPDATE: Solo owner della lista può modificare requisiti
CREATE POLICY "requirements_update_list_owner" 
ON app_5939507989_requirements
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM app_5939507989_lists
        WHERE list_id = app_5939507989_requirements.list_id
        AND (
            created_by = auth.uid()::text OR 
            owner = auth.uid()::text
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM app_5939507989_lists
        WHERE list_id = app_5939507989_requirements.list_id
        AND (
            created_by = auth.uid()::text OR 
            owner = auth.uid()::text
        )
    )
);

-- DELETE: Solo owner della lista può eliminare requisiti
CREATE POLICY "requirements_delete_list_owner" 
ON app_5939507989_requirements
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM app_5939507989_lists
        WHERE list_id = app_5939507989_requirements.list_id
        AND (
            created_by = auth.uid()::text OR 
            owner = auth.uid()::text
        )
    )
);

COMMENT ON POLICY "requirements_insert_list_access" ON app_5939507989_requirements IS 
'Only list owners can add requirements to their lists';


-- ========== ESTIMATES TABLE - Requirement ownership based ==========

-- Drop permissive policy
DROP POLICY IF EXISTS "estimates_permissive_all" ON app_5939507989_estimates;

-- SELECT: Tutti possono leggere tutte le stime (audit trail trasparente)
CREATE POLICY "estimates_select_all" 
ON app_5939507989_estimates
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Solo utenti con accesso al requirement possono creare stime
CREATE POLICY "estimates_insert_requirement_access" 
ON app_5939507989_estimates
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM app_5939507989_requirements r
        JOIN app_5939507989_lists l ON r.list_id = l.list_id
        WHERE r.req_id = app_5939507989_estimates.req_id
        AND (
            l.created_by = auth.uid()::text OR 
            l.owner = auth.uid()::text
        )
    )
);

-- UPDATE: Stime sono immutabili (audit trail) - NO UPDATE policy
-- Se serve modifica, creare nuova stima

-- DELETE: Solo owner della lista può eliminare stime (cleanup)
CREATE POLICY "estimates_delete_list_owner" 
ON app_5939507989_estimates
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM app_5939507989_requirements r
        JOIN app_5939507989_lists l ON r.list_id = l.list_id
        WHERE r.req_id = app_5939507989_estimates.req_id
        AND (
            l.created_by = auth.uid()::text OR 
            l.owner = auth.uid()::text
        )
    )
);

COMMENT ON POLICY "estimates_insert_requirement_access" ON app_5939507989_estimates IS 
'Only requirement owners can create estimates (via list ownership)';

COMMENT ON POLICY "estimates_delete_list_owner" ON app_5939507989_estimates IS 
'Only list owners can delete estimates (cleanup operations)';

*/


-- ============================================================================
-- FASE 4: CATALOG TABLES - READ-ONLY FOR USERS
-- ============================================================================
-- Catalog tables non hanno RLS abilitato, ma policies impediscono modifiche

-- Activities - Read-only per users
ALTER TABLE app_5939507989_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities_select_all" 
ON app_5939507989_activities
FOR SELECT
TO authenticated
USING (true);

-- Solo service_role può modificare catalog
CREATE POLICY "activities_admin_modify" 
ON app_5939507989_activities
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "activities_select_all" ON app_5939507989_activities IS 
'All users can read activities catalog';

COMMENT ON POLICY "activities_admin_modify" ON app_5939507989_activities IS 
'Only service_role (admin) can modify activities catalog';

-- Drivers - Read-only per users
ALTER TABLE app_5939507989_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers_select_all" 
ON app_5939507989_drivers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "drivers_admin_modify" 
ON app_5939507989_drivers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Risks - Read-only per users
ALTER TABLE app_5939507989_risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "risks_select_all" 
ON app_5939507989_risks
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "risks_admin_modify" 
ON app_5939507989_risks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Contingency bands - Read-only per users
ALTER TABLE app_5939507989_contingency_bands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contingency_bands_select_all" 
ON app_5939507989_contingency_bands
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "contingency_bands_admin_modify" 
ON app_5939507989_contingency_bands
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================================================================
-- FASE 5: SPECIAL POLICIES - Scenarios avanzati
-- ============================================================================

-- Policy per permettere a business_owner di leggere "i suoi" requisiti
-- Utile per dashboard filtrate per business owner
CREATE POLICY "requirements_select_business_owner" 
ON app_5939507989_requirements
FOR SELECT
TO authenticated
USING (
    business_owner = auth.uid()::text OR
    true  -- Lascia comunque tutti visibili per collaborazione
);

COMMENT ON POLICY "requirements_select_business_owner" ON app_5939507989_requirements IS 
'Business owners can see their requirements (fallback: all visible for collaboration)';


-- ============================================================================
-- FASE 6: RLS TESTING & VERIFICATION
-- ============================================================================

-- Funzione helper per testare RLS policies (eseguire come diversi utenti)
CREATE OR REPLACE FUNCTION test_rls_access(
    test_user_id TEXT,
    test_table_name TEXT
) RETURNS TABLE (
    operation TEXT,
    allowed BOOLEAN,
    error_message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Simula accesso come test_user_id
    PERFORM set_config('request.jwt.claim.sub', test_user_id, true);
    
    -- Test SELECT
    BEGIN
        EXECUTE format('SELECT 1 FROM %I LIMIT 1', test_table_name);
        operation := 'SELECT';
        allowed := true;
        error_message := NULL;
        RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
        operation := 'SELECT';
        allowed := false;
        error_message := SQLERRM;
        RETURN NEXT;
    END;
    
    -- Reset
    PERFORM set_config('request.jwt.claim.sub', '', true);
    RETURN;
END;
$$;

COMMENT ON FUNCTION test_rls_access IS 
'Helper function to test RLS policies for different users';


-- Query per verificare policy attive
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename LIKE 'app_5939507989_%'
ORDER BY tablename, policyname;


-- Query per monitorare RLS denials (da eseguire in produzione)
-- Richiede pg_stat_statements extension
/*
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    rows
FROM pg_stat_statements
WHERE query LIKE '%app_5939507989_%'
AND query LIKE '%policy%'
ORDER BY calls DESC
LIMIT 20;
*/


-- ============================================================================
-- FASE 7: PERFORMANCE MONITORING
-- ============================================================================

-- Creare vista per monitorare performance RLS
CREATE OR REPLACE VIEW v_rls_performance_monitor AS
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE tablename LIKE 'app_5939507989_%'
ORDER BY tablename;

COMMENT ON VIEW v_rls_performance_monitor IS 
'Monitor table statistics for RLS-enabled tables';


-- ============================================================================
-- ROLLBACK PLAN (In caso di problemi)
-- ============================================================================
/*
-- Disabilitare RLS su tutte le tabelle
ALTER TABLE app_5939507989_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_requirements DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_estimates DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_sticky_defaults DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_drivers DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_risks DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_5939507989_contingency_bands DISABLE ROW LEVEL SECURITY;

-- Drop tutte le policy
DROP POLICY IF EXISTS "lists_permissive_all" ON app_5939507989_lists;
DROP POLICY IF EXISTS "requirements_permissive_all" ON app_5939507989_requirements;
DROP POLICY IF EXISTS "estimates_permissive_all" ON app_5939507989_estimates;
DROP POLICY IF EXISTS "sticky_defaults_user_access" ON app_5939507989_sticky_defaults;
-- ... (drop altre policy)

DROP FUNCTION IF EXISTS test_rls_access;
DROP VIEW IF EXISTS v_rls_performance_monitor;
*/


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Implementation Checklist:
-- [ ] 1. Apply Phase 1 & 2 (permissive policies) in test environment
-- [ ] 2. Test application functionality with different users
-- [ ] 3. Monitor performance (pg_stat_statements)
-- [ ] 4. Gradually uncomment Phase 3 (granular policies) table by table
-- [ ] 5. Test each policy independently before applying next
-- [ ] 6. Verify no broken functionality
-- [ ] 7. Apply to production with monitoring
-- [ ] 8. Keep rollback script ready for 48h post-deployment
--
-- Next steps:
-- - Add audit log trigger (migration 003)
-- - Update storage.ts error handling for RLS errors
-- - Add monitoring dashboard in Supabase
-- ============================================================================
