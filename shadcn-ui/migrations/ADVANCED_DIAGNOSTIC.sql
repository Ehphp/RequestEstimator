-- ============================================================================
-- ADVANCED DIAGNOSTIC - Trova la causa esatta dell'errore 42601
-- ============================================================================
-- Esegui ogni query in sequenza e condividi i risultati
-- ============================================================================

-- ============================================================================
-- QUERY 1: Tutti i trigger su requirements (inclusi system triggers)
-- ============================================================================
SELECT 
    t.tgname AS trigger_name,
    t.tgenabled AS enabled,
    p.proname AS function_name,
    CASE t.tgtype::int & 1
        WHEN 1 THEN 'ROW'
        ELSE 'STATEMENT'
    END AS level,
    CASE t.tgtype::int & 66
        WHEN 2 THEN 'BEFORE'
        WHEN 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END AS timing,
    CASE 
        WHEN t.tgtype::int & 4 = 4 THEN 'INSERT '
        ELSE ''
    END ||
    CASE 
        WHEN t.tgtype::int & 8 = 8 THEN 'DELETE '
        ELSE ''
    END ||
    CASE 
        WHEN t.tgtype::int & 16 = 16 THEN 'UPDATE '
        ELSE ''
    END AS events
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'app_5939507989_requirements'
ORDER BY t.tgname;

-- ============================================================================
-- QUERY 2: Definizione completa di tutte le funzioni trigger
-- ============================================================================
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_code
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'app_5939507989_requirements'
ORDER BY p.proname;

-- ============================================================================
-- QUERY 3: Cerca funzioni che contengono SELECT senza INTO
-- ============================================================================
SELECT 
    p.proname AS function_name,
    p.prosrc AS source_code
FROM pg_proc p
WHERE p.prosrc LIKE '%app_5939507989_requirements%'
AND p.proname IN (
    SELECT DISTINCT proname 
    FROM pg_trigger t
    JOIN pg_proc ON t.tgfoid = pg_proc.oid
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'app_5939507989_requirements'
);

-- ============================================================================
-- QUERY 4: Controllo trigger anche su tabella parent (lists)
-- ============================================================================
SELECT 
    t.tgname AS trigger_name,
    c.relname AS table_name,
    p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('app_5939507989_lists', 'app_5939507989_requirements', 'app_5939507989_estimates')
AND t.tgname NOT LIKE 'RI_%'
ORDER BY c.relname, t.tgname;

-- ============================================================================
-- QUERY 5: Controlla se ci sono regole (RULES) sulla tabella
-- ============================================================================
SELECT 
    r.rulename AS rule_name,
    pg_get_ruledef(r.oid) AS rule_definition
FROM pg_rewrite r
JOIN pg_class c ON r.ev_class = c.oid
WHERE c.relname = 'app_5939507989_requirements'
AND r.rulename != '_RETURN';

-- ============================================================================
-- QUERY 6: Controlla politiche RLS attive
-- ============================================================================
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
WHERE tablename = 'app_5939507989_requirements';

-- ============================================================================
-- EMERGENCY FIX: Disabilita TUTTI i trigger temporaneamente
-- ============================================================================
-- ⚠️ ATTENZIONE: Questo disabilita anche i constraint FK!
-- Esegui solo se le altre soluzioni non funzionano
-- ⚠️ RICORDATI DI RIABILITARE DOPO!

-- Per disabilitare:
-- ALTER TABLE app_5939507989_requirements DISABLE TRIGGER ALL;

-- Per riabilitare:
-- ALTER TABLE app_5939507989_requirements ENABLE TRIGGER ALL;

-- ============================================================================
-- ALTERNATIVE FIX: Disabilita solo trigger USER (non FK)
-- ============================================================================
-- Più sicuro della soluzione precedente

-- Per disabilitare solo trigger utente:
ALTER TABLE app_5939507989_requirements DISABLE TRIGGER USER;

-- Verifica che i trigger USER siano disabilitati:
SELECT tgname, tgenabled 
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'app_5939507989_requirements';
-- tgenabled = 'D' significa disabilitato

-- ============================================================================
-- ISTRUZIONI
-- ============================================================================
-- 
-- PASSO 1: Esegui QUERY 1-6 e condividi i risultati
-- 
-- PASSO 2: Se trovi trigger sospetti nei risultati, eliminali con:
--          DROP TRIGGER <nome_trigger> ON app_5939507989_requirements;
-- 
-- PASSO 3: Se non funziona, esegui "ALTERNATIVE FIX" (disabilita trigger USER)
--          Questo mantiene i constraint FK ma disabilita i trigger custom
-- 
-- PASSO 4: Prova a creare un requisito dall'app
-- 
-- PASSO 5: Se funziona con trigger disabilitati, il problema è confermato
--          essere in un trigger. Analizza i risultati delle QUERY 2-3 per
--          trovare quale funzione contiene SELECT senza destinazione.
-- 
-- ============================================================================
