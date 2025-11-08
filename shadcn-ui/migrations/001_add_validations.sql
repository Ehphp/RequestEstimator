-- ============================================================================
-- MIGRATION 001: Database Validations - Constraints, Foreign Keys, Indexes
-- ============================================================================
-- Purpose: Aggiungere validazioni database-level per integrità dati
-- Author: AI Assistant
-- Date: 2025-11-08
-- Status: ⚠️ NOT APPLIED - Review required before execution
--
-- CRITICAL NOTES:
-- 1. BACKUP database before applying
-- 2. Validate existing data before adding constraints
-- 3. Test in non-production environment first
-- 4. Apply in stages (indexes → FK → CHECK → NOT NULL)
-- ============================================================================

-- ============================================================================
-- FASE 1: INDICI PER PERFORMANCE (SAFE - No data validation)
-- ============================================================================

-- Indici per JOIN operations (requirements-lists, estimates-requirements)
CREATE INDEX IF NOT EXISTS idx_requirements_list_id 
ON app_5939507989_requirements(list_id);

CREATE INDEX IF NOT EXISTS idx_estimates_req_id 
ON app_5939507989_estimates(req_id);

-- Indici per filtri comuni
CREATE INDEX IF NOT EXISTS idx_lists_status 
ON app_5939507989_lists(status) 
WHERE status = 'Active';

CREATE INDEX IF NOT EXISTS idx_requirements_state 
ON app_5939507989_requirements(state);

CREATE INDEX IF NOT EXISTS idx_requirements_priority 
ON app_5939507989_requirements(priority);

CREATE INDEX IF NOT EXISTS idx_activities_status 
ON app_5939507989_activities(status) 
WHERE status = 'Active';

-- Indici per sort operations (DESC per LIMIT queries)
CREATE INDEX IF NOT EXISTS idx_estimates_created_on 
ON app_5939507989_estimates(created_on DESC);

CREATE INDEX IF NOT EXISTS idx_requirements_created_on 
ON app_5939507989_requirements(created_on DESC);

CREATE INDEX IF NOT EXISTS idx_lists_created_on 
ON app_5939507989_lists(created_on DESC);

-- Indice composito per sticky_defaults lookup
CREATE INDEX IF NOT EXISTS idx_sticky_defaults_user_list 
ON app_5939507989_sticky_defaults(user_id, list_id);

COMMENT ON INDEX idx_requirements_list_id IS 'Performance index for list-requirements JOIN';
COMMENT ON INDEX idx_estimates_req_id IS 'Performance index for requirement-estimates JOIN';
COMMENT ON INDEX idx_estimates_created_on IS 'Performance index for latest estimate query';


-- ============================================================================
-- FASE 2: VALIDAZIONE DATI ESISTENTI (Query per verifica)
-- ============================================================================

-- Query per verificare integrità referenziale PRIMA di aggiungere FK
-- ⚠️ Eseguire queste query e risolvere eventuali orphan records

-- Check orphan requirements (list_id inesistente)
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM app_5939507989_requirements r
    LEFT JOIN app_5939507989_lists l ON r.list_id = l.list_id
    WHERE l.list_id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE WARNING 'Found % orphan requirements without valid list_id', orphan_count;
        -- Log orphan records
        RAISE NOTICE 'Orphan requirements: %', (
            SELECT string_agg(req_id, ', ')
            FROM app_5939507989_requirements r
            LEFT JOIN app_5939507989_lists l ON r.list_id = l.list_id
            WHERE l.list_id IS NULL
        );
    ELSE
        RAISE NOTICE 'No orphan requirements found - FK ready';
    END IF;
END $$;

-- Check orphan estimates (req_id inesistente)
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM app_5939507989_estimates e
    LEFT JOIN app_5939507989_requirements r ON e.req_id = r.req_id
    WHERE r.req_id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE WARNING 'Found % orphan estimates without valid req_id', orphan_count;
        RAISE NOTICE 'Orphan estimates: %', (
            SELECT string_agg(estimate_id, ', ')
            FROM app_5939507989_estimates e
            LEFT JOIN app_5939507989_requirements r ON e.req_id = r.req_id
            WHERE r.req_id IS NULL
        );
    ELSE
        RAISE NOTICE 'No orphan estimates found - FK ready';
    END IF;
END $$;

-- Validate enum values before adding CHECK constraints
DO $$
BEGIN
    -- Check lists.status
    IF EXISTS (
        SELECT 1 FROM app_5939507989_lists 
        WHERE status NOT IN ('Active', 'Archived')
    ) THEN
        RAISE WARNING 'Invalid status values found in lists table';
    END IF;
    
    -- Check requirements.priority
    IF EXISTS (
        SELECT 1 FROM app_5939507989_requirements 
        WHERE priority NOT IN ('High', 'Med', 'Low')
    ) THEN
        RAISE WARNING 'Invalid priority values found in requirements table';
    END IF;
    
    -- Check requirements.state
    IF EXISTS (
        SELECT 1 FROM app_5939507989_requirements 
        WHERE state NOT IN ('Proposed', 'Selected', 'Scheduled', 'Done')
    ) THEN
        RAISE WARNING 'Invalid state values found in requirements table';
    END IF;
    
    -- Check estimates enums
    IF EXISTS (
        SELECT 1 FROM app_5939507989_estimates 
        WHERE complexity NOT IN ('Low', 'Medium', 'High')
           OR environments NOT IN ('1 env', '2 env', '3 env')
           OR reuse NOT IN ('Low', 'Medium', 'High')
           OR stakeholders NOT IN ('1 team', '2-3 team', '4+ team')
    ) THEN
        RAISE WARNING 'Invalid enum values found in estimates table';
    END IF;
    
    RAISE NOTICE 'Enum validation complete';
END $$;


-- ============================================================================
-- FASE 3: FOREIGN KEYS CON CASCADE DELETE
-- ============================================================================

-- FK: requirements.list_id → lists.list_id
-- Sostituisce logica manuale in storage.ts:deleteList()
ALTER TABLE app_5939507989_requirements
ADD CONSTRAINT fk_requirements_list_id 
FOREIGN KEY (list_id) 
REFERENCES app_5939507989_lists(list_id)
ON DELETE CASCADE
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_requirements_list_id ON app_5939507989_requirements 
IS 'Delete requirements when parent list is deleted (replaces manual cascade in storage.ts)';

-- FK: estimates.req_id → requirements.req_id
-- Sostituisce logica manuale in storage.ts:deleteRequirement()
ALTER TABLE app_5939507989_estimates
ADD CONSTRAINT fk_estimates_req_id 
FOREIGN KEY (req_id) 
REFERENCES app_5939507989_requirements(req_id)
ON DELETE CASCADE
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_estimates_req_id ON app_5939507989_estimates 
IS 'Delete estimates when parent requirement is deleted (replaces manual cascade in storage.ts)';

-- FK: sticky_defaults.list_id → lists.list_id
-- Pulisce defaults quando lista viene eliminata
ALTER TABLE app_5939507989_sticky_defaults
ADD CONSTRAINT fk_sticky_defaults_list_id 
FOREIGN KEY (list_id) 
REFERENCES app_5939507989_lists(list_id)
ON DELETE CASCADE
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_sticky_defaults_list_id ON app_5939507989_sticky_defaults 
IS 'Clean sticky defaults when list is deleted';


-- ============================================================================
-- FASE 4: CHECK CONSTRAINTS - ENUM VALIDATION
-- ============================================================================

-- Lists table
ALTER TABLE app_5939507989_lists
ADD CONSTRAINT chk_lists_status 
CHECK (status IN ('Active', 'Archived'));

-- Requirements table
ALTER TABLE app_5939507989_requirements
ADD CONSTRAINT chk_requirements_priority 
CHECK (priority IN ('High', 'Med', 'Low'));

ALTER TABLE app_5939507989_requirements
ADD CONSTRAINT chk_requirements_state 
CHECK (state IN ('Proposed', 'Selected', 'Scheduled', 'Done'));

-- Estimates table - Driver enums
ALTER TABLE app_5939507989_estimates
ADD CONSTRAINT chk_estimates_complexity 
CHECK (complexity IN ('Low', 'Medium', 'High'));

ALTER TABLE app_5939507989_estimates
ADD CONSTRAINT chk_estimates_environments 
CHECK (environments IN ('1 env', '2 env', '3 env'));

ALTER TABLE app_5939507989_estimates
ADD CONSTRAINT chk_estimates_reuse 
CHECK (reuse IN ('Low', 'Medium', 'High'));

ALTER TABLE app_5939507989_estimates
ADD CONSTRAINT chk_estimates_stakeholders 
CHECK (stakeholders IN ('1 team', '2-3 team', '4+ team'));

-- Activities table
ALTER TABLE app_5939507989_activities
ADD CONSTRAINT chk_activities_status 
CHECK (status IN ('Active', 'Deprecated'));

-- Sticky defaults table (optional enums)
ALTER TABLE app_5939507989_sticky_defaults
ADD CONSTRAINT chk_sticky_complexity 
CHECK (complexity IS NULL OR complexity IN ('Low', 'Medium', 'High'));

ALTER TABLE app_5939507989_sticky_defaults
ADD CONSTRAINT chk_sticky_environments 
CHECK (environments IS NULL OR environments IN ('1 env', '2 env', '3 env'));

ALTER TABLE app_5939507989_sticky_defaults
ADD CONSTRAINT chk_sticky_reuse 
CHECK (reuse IS NULL OR reuse IN ('Low', 'Medium', 'High'));

ALTER TABLE app_5939507989_sticky_defaults
ADD CONSTRAINT chk_sticky_stakeholders 
CHECK (stakeholders IS NULL OR stakeholders IN ('1 team', '2-3 team', '4+ team'));


-- ============================================================================
-- FASE 5: CHECK CONSTRAINTS - RANGE VALIDATION
-- ============================================================================

-- Activities - base_days must be positive
ALTER TABLE app_5939507989_activities
ADD CONSTRAINT chk_activities_base_days_positive 
CHECK (base_days > 0);

-- Drivers - multiplier must be positive
ALTER TABLE app_5939507989_drivers
ADD CONSTRAINT chk_drivers_multiplier_positive 
CHECK (multiplier > 0);

-- Risks - weight non-negative
ALTER TABLE app_5939507989_risks
ADD CONSTRAINT chk_risks_weight_nonnegative 
CHECK (weight >= 0);

-- Contingency bands - percentage between 0 and 50%
ALTER TABLE app_5939507989_contingency_bands
ADD CONSTRAINT chk_contingency_pct_range 
CHECK (contingency_pct >= 0 AND contingency_pct <= 0.50);

-- Estimates - Calculation validation
ALTER TABLE app_5939507989_estimates
ADD CONSTRAINT chk_estimates_activities_base_days 
CHECK (activities_base_days >= 0);

ALTER TABLE app_5939507989_estimates
ADD CONSTRAINT chk_estimates_driver_multiplier 
CHECK (driver_multiplier > 0);

ALTER TABLE app_5939507989_estimates
ADD CONSTRAINT chk_estimates_subtotal_days 
CHECK (subtotal_days >= 0);

ALTER TABLE app_5939507989_estimates
ADD CONSTRAINT chk_estimates_risk_score 
CHECK (risk_score >= 0);

ALTER TABLE app_5939507989_estimates
ADD CONSTRAINT chk_estimates_contingency_pct 
CHECK (contingency_pct >= 0 AND contingency_pct <= 0.50);

ALTER TABLE app_5939507989_estimates
ADD CONSTRAINT chk_estimates_contingency_days 
CHECK (contingency_days >= 0);

ALTER TABLE app_5939507989_estimates
ADD CONSTRAINT chk_estimates_total_days 
CHECK (total_days >= 0);

-- Logical validation: total_days should approximately equal subtotal + contingency
-- Using tolerance for floating point arithmetic
ALTER TABLE app_5939507989_estimates
ADD CONSTRAINT chk_estimates_total_calculation 
CHECK (
    ABS(total_days - (subtotal_days + contingency_days)) < 0.01
);

COMMENT ON CONSTRAINT chk_estimates_total_calculation ON app_5939507989_estimates 
IS 'Validates total_days = subtotal_days + contingency_days (0.01 tolerance for rounding)';


-- ============================================================================
-- FASE 6: NOT NULL CONSTRAINTS & DEFAULT VALUES
-- ============================================================================

-- Lists table - Core fields
ALTER TABLE app_5939507989_lists
ALTER COLUMN name SET NOT NULL,
ALTER COLUMN created_on SET NOT NULL,
ALTER COLUMN created_by SET NOT NULL,
ALTER COLUMN status SET NOT NULL,
ALTER COLUMN status SET DEFAULT 'Active';

-- Requirements table - Core fields
ALTER TABLE app_5939507989_requirements
ALTER COLUMN title SET NOT NULL,
ALTER COLUMN description SET NOT NULL,
ALTER COLUMN description SET DEFAULT '',
ALTER COLUMN priority SET NOT NULL,
ALTER COLUMN priority SET DEFAULT 'Med',
ALTER COLUMN state SET NOT NULL,
ALTER COLUMN state SET DEFAULT 'Proposed',
ALTER COLUMN business_owner SET NOT NULL,
ALTER COLUMN created_on SET NOT NULL;

-- Estimates table - All calculation fields are required
-- (già NOT NULL nel TypeScript interface, garantire a livello DB)
ALTER TABLE app_5939507989_estimates
ALTER COLUMN scenario SET NOT NULL,
ALTER COLUMN scenario SET DEFAULT 'A',
ALTER COLUMN complexity SET NOT NULL,
ALTER COLUMN environments SET NOT NULL,
ALTER COLUMN reuse SET NOT NULL,
ALTER COLUMN stakeholders SET NOT NULL,
ALTER COLUMN included_activities SET NOT NULL,
ALTER COLUMN included_activities SET DEFAULT '{}',
ALTER COLUMN optional_activities SET NOT NULL,
ALTER COLUMN optional_activities SET DEFAULT '{}',
ALTER COLUMN include_optional SET NOT NULL,
ALTER COLUMN include_optional SET DEFAULT FALSE,
ALTER COLUMN selected_risks SET NOT NULL,
ALTER COLUMN selected_risks SET DEFAULT '{}',
ALTER COLUMN activities_base_days SET NOT NULL,
ALTER COLUMN driver_multiplier SET NOT NULL,
ALTER COLUMN subtotal_days SET NOT NULL,
ALTER COLUMN risk_score SET NOT NULL,
ALTER COLUMN contingency_pct SET NOT NULL,
ALTER COLUMN contingency_days SET NOT NULL,
ALTER COLUMN total_days SET NOT NULL,
ALTER COLUMN catalog_version SET NOT NULL,
ALTER COLUMN catalog_version SET DEFAULT 'v1.0',
ALTER COLUMN drivers_version SET NOT NULL,
ALTER COLUMN drivers_version SET DEFAULT 'v1.0',
ALTER COLUMN riskmap_version SET NOT NULL,
ALTER COLUMN riskmap_version SET DEFAULT 'v1.0',
ALTER COLUMN created_on SET NOT NULL,
ALTER COLUMN complexity_is_overridden SET NOT NULL,
ALTER COLUMN complexity_is_overridden SET DEFAULT FALSE,
ALTER COLUMN environments_is_overridden SET NOT NULL,
ALTER COLUMN environments_is_overridden SET DEFAULT FALSE,
ALTER COLUMN reuse_is_overridden SET NOT NULL,
ALTER COLUMN reuse_is_overridden SET DEFAULT FALSE,
ALTER COLUMN stakeholders_is_overridden SET NOT NULL,
ALTER COLUMN stakeholders_is_overridden SET DEFAULT FALSE,
ALTER COLUMN activities_is_overridden SET NOT NULL,
ALTER COLUMN activities_is_overridden SET DEFAULT FALSE,
ALTER COLUMN risks_is_overridden SET NOT NULL,
ALTER COLUMN risks_is_overridden SET DEFAULT FALSE;

-- Activities table - Catalog fields
ALTER TABLE app_5939507989_activities
ALTER COLUMN display_name SET NOT NULL,
ALTER COLUMN driver_group SET NOT NULL,
ALTER COLUMN base_days SET NOT NULL,
ALTER COLUMN helper_short SET NOT NULL,
ALTER COLUMN helper_long SET NOT NULL,
ALTER COLUMN status SET NOT NULL,
ALTER COLUMN status SET DEFAULT 'Active';

-- Drivers table - All fields required
ALTER TABLE app_5939507989_drivers
ALTER COLUMN driver SET NOT NULL,
ALTER COLUMN option SET NOT NULL,
ALTER COLUMN multiplier SET NOT NULL,
ALTER COLUMN explanation SET NOT NULL;

-- Risks table - All fields required
ALTER TABLE app_5939507989_risks
ALTER COLUMN risk_item SET NOT NULL,
ALTER COLUMN weight SET NOT NULL,
ALTER COLUMN guidance SET NOT NULL;

-- Contingency bands - All fields required
ALTER TABLE app_5939507989_contingency_bands
ALTER COLUMN level SET NOT NULL,
ALTER COLUMN contingency_pct SET NOT NULL;

-- Sticky defaults - Core fields
ALTER TABLE app_5939507989_sticky_defaults
ALTER COLUMN user_id SET NOT NULL,
ALTER COLUMN list_id SET NOT NULL,
ALTER COLUMN updated_on SET NOT NULL,
ALTER COLUMN updated_on SET DEFAULT NOW(),
ALTER COLUMN included_activities SET DEFAULT '{}';


-- ============================================================================
-- FASE 7: TABLE COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE app_5939507989_lists IS 
'Project/sprint containers with preset configurations';

COMMENT ON TABLE app_5939507989_requirements IS 
'Individual feature requirements within lists';

COMMENT ON TABLE app_5939507989_estimates IS 
'Historical estimation records with full audit trail (immutable)';

COMMENT ON TABLE app_5939507989_sticky_defaults IS 
'User-specific estimation preferences per list context';

COMMENT ON TABLE app_5939507989_activities IS 
'Master catalog of activities with base effort (read-only for users)';

COMMENT ON TABLE app_5939507989_drivers IS 
'Effort multipliers for complexity, environments, reuse, stakeholders';

COMMENT ON TABLE app_5939507989_risks IS 
'Risk catalog with weights for contingency calculation';

COMMENT ON TABLE app_5939507989_contingency_bands IS 
'Risk score to contingency percentage mapping';

-- Column comments for key fields
COMMENT ON COLUMN app_5939507989_estimates.total_days IS 
'Final estimated effort: subtotal_days + contingency_days (in person-days)';

COMMENT ON COLUMN app_5939507989_estimates.driver_multiplier IS 
'Product of 4 drivers: complexity × environments × reuse × stakeholders';

COMMENT ON COLUMN app_5939507989_estimates.contingency_pct IS 
'Contingency percentage based on risk_score (0.00 to 0.50)';

COMMENT ON COLUMN app_5939507989_requirements.last_estimated_on IS 
'Timestamp of most recent estimate save (updated via trigger or app)';


-- ============================================================================
-- VERIFICATION QUERIES (Run after applying migration)
-- ============================================================================

-- Verify FK constraints are active
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    contype AS constraint_type
FROM pg_constraint
WHERE connamespace = (
    SELECT oid FROM pg_namespace WHERE nspname = 'public'
)
AND contype = 'f'
AND conrelid::regclass::text LIKE 'app_5939507989_%'
ORDER BY table_name, constraint_name;

-- Verify CHECK constraints
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE connamespace = (
    SELECT oid FROM pg_namespace WHERE nspname = 'public'
)
AND contype = 'c'
AND conrelid::regclass::text LIKE 'app_5939507989_%'
ORDER BY table_name, constraint_name;

-- Verify indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename LIKE 'app_5939507989_%'
ORDER BY tablename, indexname;

-- Performance check: Explain analyze on common queries
EXPLAIN ANALYZE
SELECT r.*, e.total_days
FROM app_5939507989_requirements r
LEFT JOIN LATERAL (
    SELECT total_days, created_on
    FROM app_5939507989_estimates
    WHERE req_id = r.req_id
    ORDER BY created_on DESC
    LIMIT 1
) e ON true
WHERE r.list_id = 'test-list-id';


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Review and verify this migration in test environment
-- 2. Update storage.ts to remove manual cascade delete logic
-- 3. Test application functionality
-- 4. Apply RLS policies (migration 002)
-- 5. Add triggers for advanced validation (migration 003)
-- ============================================================================
