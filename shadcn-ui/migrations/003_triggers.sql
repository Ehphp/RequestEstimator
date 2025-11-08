-- ============================================================================
-- MIGRATION 003: Advanced Database Triggers
-- ============================================================================
-- Purpose: Validazioni complesse e audit trail tramite PL/pgSQL triggers
-- Author: AI Assistant
-- Date: 2025-11-08
-- Status: ⚠️ NOT APPLIED - Review required before execution
--
-- TRIGGERS IMPLEMENTED:
-- 1. validate_estimate_calculations - Verifica coerenza calcoli
-- 2. update_requirement_timestamp - Aggiorna last_estimated_on
-- 3. audit_log_trigger - Traccia modifiche (optional)
--
-- CRITICAL NOTES:
-- - Triggers eseguono ad ogni INSERT/UPDATE (performance impact)
-- - Testare in test environment prima di production
-- - Considerare se validazioni sono necessarie (app già valida)
-- ============================================================================

-- ============================================================================
-- PHASE 1: HELPER FUNCTIONS
-- ============================================================================

-- Function: Round number con logica roundHalfUp (come calculations.ts)
CREATE OR REPLACE FUNCTION round_half_up(num NUMERIC, decimals INTEGER)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN ROUND(num + 0.0000001, decimals);
END;
$$;

COMMENT ON FUNCTION round_half_up IS 
'Rounds number using half-up logic (matches calculations.ts)';

-- Function: Calcola contingency percentage da risk score
CREATE OR REPLACE FUNCTION calculate_contingency_pct(risk_score INTEGER)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    contingency_pct NUMERIC;
BEGIN
    IF risk_score = 0 THEN
        contingency_pct := 0;
    ELSIF risk_score <= 10 THEN
        -- Low band
        SELECT cb.contingency_pct INTO contingency_pct
        FROM app_5939507989_contingency_bands cb
        WHERE cb.band = 'Low';
        
        IF contingency_pct IS NULL THEN
            contingency_pct := 0.10;
        END IF;
    ELSIF risk_score <= 20 THEN
        -- Medium band
        SELECT cb.contingency_pct INTO contingency_pct
        FROM app_5939507989_contingency_bands cb
        WHERE cb.band = 'Medium';
        
        IF contingency_pct IS NULL THEN
            contingency_pct := 0.20;
        END IF;
    ELSE
        -- High band (21+)
        SELECT cb.contingency_pct INTO contingency_pct
        FROM app_5939507989_contingency_bands cb
        WHERE cb.band = 'High';
        
        IF contingency_pct IS NULL THEN
            contingency_pct := 0.35;
        END IF;
    END IF;
    
    -- Cap at 50%
    IF contingency_pct > 0.50 THEN
        contingency_pct := 0.50;
    END IF;
    
    RETURN contingency_pct;
END;
$$;

COMMENT ON FUNCTION calculate_contingency_pct IS 
'Calculates contingency percentage from risk score (matches calculations.ts logic)';


-- ============================================================================
-- PHASE 2: ESTIMATE CALCULATION VALIDATION TRIGGER
-- ============================================================================

-- Trigger function: Valida coerenza calcoli nelle stime
CREATE OR REPLACE FUNCTION validate_estimate_calculations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    expected_subtotal NUMERIC;
    expected_contingency_pct NUMERIC;
    expected_contingency_days NUMERIC;
    expected_total NUMERIC;
    tolerance NUMERIC := 0.01; -- Tolleranza per floating point
BEGIN
    -- Valida subtotal_days = activities_base_days × driver_multiplier
    expected_subtotal := round_half_up(NEW.activities_base_days * NEW.driver_multiplier, 3);
    
    IF ABS(NEW.subtotal_days - expected_subtotal) > tolerance THEN
        RAISE EXCEPTION 'Calcolo subtotal_days non valido: atteso %, ricevuto %', 
            expected_subtotal, NEW.subtotal_days
        USING HINT = 'subtotal_days deve essere activities_base_days × driver_multiplier';
    END IF;
    
    -- Valida contingency_pct basato su risk_score
    expected_contingency_pct := calculate_contingency_pct(NEW.risk_score);
    
    IF ABS(NEW.contingency_pct - expected_contingency_pct) > tolerance THEN
        RAISE EXCEPTION 'Calcolo contingency_pct non valido: atteso % per risk_score %, ricevuto %', 
            expected_contingency_pct, NEW.risk_score, NEW.contingency_pct
        USING HINT = 'contingency_pct deve corrispondere al risk_score secondo contingency_bands';
    END IF;
    
    -- Valida contingency_days = subtotal_days × contingency_pct
    expected_contingency_days := round_half_up(NEW.subtotal_days * NEW.contingency_pct, 3);
    
    IF ABS(NEW.contingency_days - expected_contingency_days) > tolerance THEN
        RAISE EXCEPTION 'Calcolo contingency_days non valido: atteso %, ricevuto %', 
            expected_contingency_days, NEW.contingency_days
        USING HINT = 'contingency_days deve essere subtotal_days × contingency_pct';
    END IF;
    
    -- Valida total_days = subtotal_days + contingency_days
    expected_total := NEW.subtotal_days + NEW.contingency_days;
    
    IF ABS(NEW.total_days - expected_total) > tolerance THEN
        RAISE EXCEPTION 'Calcolo total_days non valido: atteso %, ricevuto %', 
            expected_total, NEW.total_days
        USING HINT = 'total_days deve essere subtotal_days + contingency_days';
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_estimate_calculations IS 
'Validates estimate calculation coherence on INSERT/UPDATE';

-- Create trigger
CREATE TRIGGER trg_validate_estimate_calculations
    BEFORE INSERT OR UPDATE ON app_5939507989_estimates
    FOR EACH ROW
    EXECUTE FUNCTION validate_estimate_calculations();

COMMENT ON TRIGGER trg_validate_estimate_calculations ON app_5939507989_estimates IS 
'Validates calculation coherence before insert/update (matches calculations.ts formulas)';


-- ============================================================================
-- PHASE 3: AUTO-UPDATE REQUIREMENT TIMESTAMP
-- ============================================================================

-- Trigger function: Aggiorna last_estimated_on quando viene salvata una stima
CREATE OR REPLACE FUNCTION update_requirement_last_estimated()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Aggiorna timestamp del requirement
    UPDATE app_5939507989_requirements
    SET last_estimated_on = NEW.created_on
    WHERE req_id = NEW.req_id;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_requirement_last_estimated IS 
'Updates requirement.last_estimated_on when new estimate is saved';

-- Create trigger (AFTER INSERT per non interferire con validations)
CREATE TRIGGER trg_update_requirement_timestamp
    AFTER INSERT ON app_5939507989_estimates
    FOR EACH ROW
    EXECUTE FUNCTION update_requirement_last_estimated();

COMMENT ON TRIGGER trg_update_requirement_timestamp ON app_5939507989_estimates IS 
'Auto-updates requirement timestamp when estimate is created';


-- ============================================================================
-- PHASE 4: AUDIT LOG (OPTIONAL)
-- ============================================================================

-- Audit log table (optional - se serve tracciabilità completa)
CREATE TABLE IF NOT EXISTS app_5939507989_audit_log (
    audit_id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    record_id TEXT NOT NULL,
    user_id TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    old_data JSONB,
    new_data JSONB,
    change_summary TEXT
);

CREATE INDEX idx_audit_log_table_name ON app_5939507989_audit_log(table_name);
CREATE INDEX idx_audit_log_record_id ON app_5939507989_audit_log(record_id);
CREATE INDEX idx_audit_log_changed_at ON app_5939507989_audit_log(changed_at DESC);
CREATE INDEX idx_audit_log_user_id ON app_5939507989_audit_log(user_id);

COMMENT ON TABLE app_5939507989_audit_log IS 
'Audit trail for all data modifications (optional - enable if needed)';

-- Generic audit log function
CREATE OR REPLACE FUNCTION audit_log_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    audit_user_id TEXT;
    record_id_value TEXT;
    change_summary_text TEXT;
BEGIN
    -- Get user ID from auth context
    audit_user_id := current_setting('request.jwt.claim.sub', true);
    
    -- Determine record ID based on table
    CASE TG_TABLE_NAME
        WHEN 'app_5939507989_lists' THEN
            record_id_value := COALESCE(NEW.list_id, OLD.list_id);
        WHEN 'app_5939507989_requirements' THEN
            record_id_value := COALESCE(NEW.req_id, OLD.req_id);
        WHEN 'app_5939507989_estimates' THEN
            record_id_value := COALESCE(NEW.estimate_id, OLD.estimate_id);
        ELSE
            record_id_value := 'unknown';
    END CASE;
    
    -- Build change summary
    CASE TG_OP
        WHEN 'INSERT' THEN
            change_summary_text := 'Created ' || TG_TABLE_NAME;
        WHEN 'UPDATE' THEN
            change_summary_text := 'Updated ' || TG_TABLE_NAME;
        WHEN 'DELETE' THEN
            change_summary_text := 'Deleted ' || TG_TABLE_NAME;
    END CASE;
    
    -- Insert audit record
    INSERT INTO app_5939507989_audit_log (
        table_name,
        operation,
        record_id,
        user_id,
        old_data,
        new_data,
        change_summary
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        record_id_value,
        audit_user_id,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        change_summary_text
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION audit_log_trigger_func IS 
'Generic audit log function for tracking all data changes';

-- ⚠️ AUDIT LOG TRIGGERS - UNCOMMENT SE NECESSARIO
-- Attenzione: Audit log può impattare performance e occupare spazio

/*
-- Enable audit log on lists
CREATE TRIGGER trg_audit_lists
    AFTER INSERT OR UPDATE OR DELETE ON app_5939507989_lists
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_trigger_func();

-- Enable audit log on requirements
CREATE TRIGGER trg_audit_requirements
    AFTER INSERT OR UPDATE OR DELETE ON app_5939507989_requirements
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_trigger_func();

-- Enable audit log on estimates
CREATE TRIGGER trg_audit_estimates
    AFTER INSERT OR UPDATE OR DELETE ON app_5939507989_estimates
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_trigger_func();
*/


-- ============================================================================
-- PHASE 5: RISK VALIDATION (OPTIONAL)
-- ============================================================================

-- Trigger function: Valida che selected_risks esistano in risks table
CREATE OR REPLACE FUNCTION validate_estimate_risks()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    risk_id TEXT;
    risk_exists BOOLEAN;
BEGIN
    -- Valida ogni risk_id in selected_risks
    FOREACH risk_id IN ARRAY NEW.selected_risks
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM app_5939507989_risks r
            WHERE r.risk_id = validate_estimate_risks.risk_id
        ) INTO risk_exists;
        
        IF NOT risk_exists THEN
            RAISE EXCEPTION 'Risk ID % non esiste nella tabella risks', risk_id
            USING HINT = 'Verificare che risk_id sia valido';
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$;

-- ⚠️ UNCOMMENT SE SI VUOLE VALIDARE RISKS A LIVELLO DB
-- Nota: Potrebbe essere eccessivo se l'app già valida

/*
CREATE TRIGGER trg_validate_estimate_risks
    BEFORE INSERT OR UPDATE ON app_5939507989_estimates
    FOR EACH ROW
    EXECUTE FUNCTION validate_estimate_risks();
*/


-- ============================================================================
-- PHASE 6: ACTIVITIES VALIDATION (OPTIONAL)
-- ============================================================================

-- Trigger function: Valida che included_activities esistano in activities table
CREATE OR REPLACE FUNCTION validate_estimate_activities()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    activity_code TEXT;
    activity_exists BOOLEAN;
BEGIN
    -- Valida ogni activity_code in included_activities
    FOREACH activity_code IN ARRAY NEW.included_activities
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM app_5939507989_activities a
            WHERE a.activity_code = validate_estimate_activities.activity_code
            AND a.status = 'Active'
        ) INTO activity_exists;
        
        IF NOT activity_exists THEN
            RAISE EXCEPTION 'Activity code % non esiste o non è Active', activity_code
            USING HINT = 'Verificare che activity_code sia valido e Active';
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$;

-- ⚠️ UNCOMMENT SE SI VUOLE VALIDARE ACTIVITIES A LIVELLO DB

/*
CREATE TRIGGER trg_validate_estimate_activities
    BEFORE INSERT OR UPDATE ON app_5939507989_estimates
    FOR EACH ROW
    EXECUTE FUNCTION validate_estimate_activities();
*/


-- ============================================================================
-- PHASE 7: MONITORING & UTILITIES
-- ============================================================================

-- View: Audit log summary (se audit log abilitato)
CREATE OR REPLACE VIEW v_audit_log_summary AS
SELECT 
    table_name,
    operation,
    user_id,
    DATE_TRUNC('day', changed_at) AS day,
    COUNT(*) AS operation_count
FROM app_5939507989_audit_log
GROUP BY table_name, operation, user_id, DATE_TRUNC('day', changed_at)
ORDER BY day DESC, operation_count DESC;

COMMENT ON VIEW v_audit_log_summary IS 
'Summary of audit log activity by table, operation, and user';

-- Function: Get trigger status
CREATE OR REPLACE FUNCTION get_trigger_status()
RETURNS TABLE (
    table_name TEXT,
    trigger_name TEXT,
    event TEXT,
    timing TEXT,
    enabled BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tgrelid::regclass::text,
        t.tgname::text,
        CASE 
            WHEN t.tgtype & 1 = 1 THEN 'INSERT'
            WHEN t.tgtype & 2 = 2 THEN 'DELETE'
            WHEN t.tgtype & 4 = 4 THEN 'UPDATE'
        END,
        CASE 
            WHEN t.tgtype & 64 = 64 THEN 'BEFORE'
            WHEN t.tgtype & 1 = 1 THEN 'AFTER'
        END,
        NOT t.tgdisabled
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname LIKE 'app_5939507989_%'
    AND NOT t.tgisinternal
    ORDER BY t.tgrelid::regclass::text, t.tgname;
END;
$$;

COMMENT ON FUNCTION get_trigger_status IS 
'Returns status of all triggers on app tables';


-- ============================================================================
-- PHASE 8: PERFORMANCE CONSIDERATIONS
-- ============================================================================

-- Note: I trigger BEFORE possono impattare performance su INSERT/UPDATE
-- Considerazioni:
-- 1. validate_estimate_calculations: Esegue 4+ controlli matematici
-- 2. update_requirement_timestamp: Esegue 1 UPDATE aggiuntivo
-- 3. audit_log: Esegue 1 INSERT aggiuntivo (se abilitato)
--
-- Stima performance impact:
-- - validate_estimate_calculations: ~1-2ms per estimate
-- - update_requirement_timestamp: ~1-2ms per estimate
-- - audit_log: ~2-3ms per operation (se abilitato)
--
-- Total overhead per estimate INSERT: ~2-7ms (accettabile)
--
-- Se performance è critica:
-- - Disabilitare validate_estimate_calculations (app già valida)
-- - Mantenere solo update_requirement_timestamp (utile)
-- - Evitare audit_log in production (usare per debug/testing)


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- List all triggers
SELECT * FROM get_trigger_status();

-- Check trigger functions
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
WHERE p.proname LIKE '%estimate%'
OR p.proname LIKE '%audit%'
ORDER BY p.proname;

-- Test calculation validation (should pass)
/*
INSERT INTO app_5939507989_estimates (
    estimate_id, req_id, scenario, complexity, environments, reuse, stakeholders,
    included_activities, optional_activities, include_optional, selected_risks,
    activities_base_days, driver_multiplier, subtotal_days,
    risk_score, contingency_pct, contingency_days, total_days,
    catalog_version, drivers_version, riskmap_version, created_on,
    complexity_is_overridden, environments_is_overridden, reuse_is_overridden,
    stakeholders_is_overridden, activities_is_overridden, risks_is_overridden
) VALUES (
    'TEST-EST-001', 'TEST-REQ-001', 'A', 'Medium', '2 env', 'Medium', '2-3 team',
    ARRAY['ANL_ALIGN'], ARRAY[]::TEXT[], false, ARRAY[]::TEXT[],
    1.0, 1.0, 1.0,  -- Valid calculation
    0, 0.0, 0.0, 1.0,  -- risk_score=0 → contingency=0
    'v1.0', 'v1.0', 'v1.0', NOW(),
    false, false, false, false, false, false
);
*/

-- Test calculation validation (should fail)
/*
INSERT INTO app_5939507989_estimates (
    ...
    subtotal_days, contingency_days, total_days
) VALUES (
    ...
    10.0, 2.0, 15.0  -- ❌ Invalid: 10+2≠15
);
*/


-- ============================================================================
-- DISABLE/ENABLE TRIGGERS
-- ============================================================================

-- Disable trigger temporarily (maintenance)
-- ALTER TABLE app_5939507989_estimates DISABLE TRIGGER trg_validate_estimate_calculations;

-- Enable trigger
-- ALTER TABLE app_5939507989_estimates ENABLE TRIGGER trg_validate_estimate_calculations;

-- Disable ALL triggers on table (risky!)
-- ALTER TABLE app_5939507989_estimates DISABLE TRIGGER ALL;


-- ============================================================================
-- ROLLBACK PLAN
-- ============================================================================

/*
-- Drop all triggers
DROP TRIGGER IF EXISTS trg_validate_estimate_calculations ON app_5939507989_estimates;
DROP TRIGGER IF EXISTS trg_update_requirement_timestamp ON app_5939507989_estimates;
DROP TRIGGER IF EXISTS trg_audit_lists ON app_5939507989_lists;
DROP TRIGGER IF EXISTS trg_audit_requirements ON app_5939507989_requirements;
DROP TRIGGER IF EXISTS trg_audit_estimates ON app_5939507989_estimates;
DROP TRIGGER IF EXISTS trg_validate_estimate_risks ON app_5939507989_estimates;
DROP TRIGGER IF EXISTS trg_validate_estimate_activities ON app_5939507989_estimates;

-- Drop functions
DROP FUNCTION IF EXISTS validate_estimate_calculations();
DROP FUNCTION IF EXISTS update_requirement_last_estimated();
DROP FUNCTION IF EXISTS audit_log_trigger_func();
DROP FUNCTION IF EXISTS validate_estimate_risks();
DROP FUNCTION IF EXISTS validate_estimate_activities();
DROP FUNCTION IF EXISTS calculate_contingency_pct(INTEGER);
DROP FUNCTION IF EXISTS round_half_up(NUMERIC, INTEGER);
DROP FUNCTION IF EXISTS get_trigger_status();

-- Drop audit log table (if created)
DROP TABLE IF EXISTS app_5939507989_audit_log CASCADE;
DROP VIEW IF EXISTS v_audit_log_summary;
*/


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Implementation Checklist:
-- [ ] 1. Review trigger logic (matches calculations.ts?)
-- [ ] 2. Test in test environment
-- [ ] 3. Measure performance impact
-- [ ] 4. Decide which triggers to enable (calculation validation vs audit)
-- [ ] 5. Apply to production
-- [ ] 6. Monitor trigger execution (pg_stat_user_functions)
-- [ ] 7. Keep rollback script ready
--
-- Recommendations:
-- ✅ ENABLE: trg_update_requirement_timestamp (useful, low overhead)
-- ⚠️ OPTIONAL: trg_validate_estimate_calculations (redundant if app validates)
-- ⚠️ OPTIONAL: audit_log triggers (only for compliance/debugging)
-- ❌ AVOID: validate_risks, validate_activities (app already validates)
-- ============================================================================
