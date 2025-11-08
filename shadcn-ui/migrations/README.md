# Database Migrations - Supabase Validations & RLS

## 📋 Overview

Questo pacchetto di migrations implementa validazioni database-level e Row Level Security (RLS) per il sistema di stima Power Platform, garantendo integrità dei dati e sicurezza a livello di riga.

---

## 📁 Files Struttura

```
migrations/
├── SCHEMA_ANALYSIS.md          # Analisi completa schema esistente
├── 001_add_validations.sql     # CHECK constraints, FK, Indexes
├── 002_rls_policies.sql        # Row Level Security policies
├── rollback_validations.sql    # Emergency rollback script
└── README.md                   # Questa documentazione
```

---

## 🎯 Obiettivi

### 1. **Integrità Dati** (Migration 001)
- ✅ **CHECK Constraints**: Validazione enum values (priority, state, complexity, etc.)
- ✅ **Range Constraints**: Valori numerici validi (base_days > 0, contingency_pct ≤ 0.50)
- ✅ **Foreign Keys**: Relazioni referenziali con CASCADE delete
- ✅ **NOT NULL**: Campi obbligatori sempre popolati
- ✅ **DEFAULT Values**: Valori di default sicuri

### 2. **Sicurezza Row-Level** (Migration 002)
- 🔐 **RLS Enabled**: Solo su tabelle dati (non catalog)
- 🔐 **Owner-Based Access**: Utenti vedono/modificano solo i propri dati
- 🔐 **Catalog Protection**: Tabelle catalogo read-only per users
- 🔐 **Permissive Phase**: Policy iniziali permissive per transizione sicura

### 3. **Performance**
- ⚡ **Indexes**: JOIN operations, filtri, sort
- ⚡ **Composite Indexes**: Query complesse ottimizzate

---

## 🚀 Execution Plan

### ⚠️ PRE-REQUISITI

1. **Backup Database Completo**
   ```bash
   # Via Supabase Dashboard
   Dashboard > Database > Backups > Create Backup
   
   # O via pg_dump
   pg_dump -h <host> -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Test Environment Ready**
   - Clone del database production
   - Ambiente isolato per testing
   - User di test configurati

3. **Monitoring Setup**
   ```sql
   -- Enable pg_stat_statements
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
   ```

---

### 📅 PHASE 1: Analysis & Preparation (COMPLETED ✅)

**Status**: ✅ Completato  
**Duration**: N/A (Solo documentazione)

**Tasks:**
- [x] Analisi schema esistente (`SCHEMA_ANALYSIS.md`)
- [x] Creazione migration 001 (validations)
- [x] Creazione migration 002 (RLS)
- [x] Creazione test suite (`supabase-validation.test.ts`)
- [x] Creazione rollback script

**Output:**
- Documentazione completa schema
- Script SQL testabili
- Test suite pronto
- Piano di rollback

---

### 📅 PHASE 2: Test Environment Validation

**Status**: ⏳ Da iniziare  
**Duration**: 2-4 ore  
**Risk Level**: 🟡 MEDIUM

**Tasks:**
1. **Setup Test Database**
   ```sql
   -- Apply migration 001 (Fase 1-4: Indexes + FK + CHECK)
   psql -h test-db -U postgres -d postgres -f migrations/001_add_validations.sql
   ```

2. **Run Test Suite**
   ```bash
   # Configurare test environment
   cp .env.test .env
   
   # Eseguire test
   pnpm test supabase-validation.test.ts
   ```

3. **Verify Constraints**
   ```sql
   -- Check constraints attivi
   SELECT conname, pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE conrelid::regclass::text LIKE 'app_5939507989_%';
   ```

4. **Test Application**
   - Creare lista
   - Aggiungere requisiti
   - Salvare stime
   - Eliminare lista (verificare CASCADE)

**Success Criteria:**
- [ ] Tutti i test passano (green)
- [ ] App funziona senza errori
- [ ] CASCADE delete funziona correttamente
- [ ] Performance accettabile (<10% overhead)

**Rollback Plan:**
```sql
-- Se problemi, eseguire rollback
psql -h test-db -U postgres -d postgres -f migrations/rollback_validations.sql
```

---

### 📅 PHASE 3: Production Deployment - Validations

**Status**: ⏳ Da iniziare  
**Duration**: 30-60 minuti  
**Risk Level**: 🟠 HIGH  
**Maintenance Window**: ✅ Richiesto

**Pre-Flight Checklist:**
- [ ] Backup production database
- [ ] Test environment validation passed
- [ ] Team notified (stakeholders, users)
- [ ] Rollback script tested
- [ ] Monitoring dashboard ready

**Execution Steps:**

1. **Announce Maintenance**
   ```
   Sistema in manutenzione per 30-60 minuti
   Operazioni bloccate temporaneamente
   ```

2. **Verify Current State**
   ```sql
   -- Count records per table
   SELECT 'lists' AS table, COUNT(*) FROM app_5939507989_lists
   UNION ALL
   SELECT 'requirements', COUNT(*) FROM app_5939507989_requirements
   UNION ALL
   SELECT 'estimates', COUNT(*) FROM app_5939507989_estimates;
   
   -- Check for orphan records
   -- (queries in 001_add_validations.sql FASE 2)
   ```

3. **Apply Indexes** (Safe, no downtime)
   ```sql
   -- Execute FASE 1 of 001_add_validations.sql
   CREATE INDEX IF NOT EXISTS idx_requirements_list_id ...
   ```

4. **Apply Foreign Keys** (Requires validation)
   ```sql
   -- Execute FASE 3 of 001_add_validations.sql
   ALTER TABLE app_5939507989_requirements
   ADD CONSTRAINT fk_requirements_list_id ...
   ```

5. **Apply CHECK Constraints**
   ```sql
   -- Execute FASE 4-5 of 001_add_validations.sql
   ALTER TABLE app_5939507989_lists
   ADD CONSTRAINT chk_lists_status ...
   ```

6. **Apply NOT NULL & Defaults**
   ```sql
   -- Execute FASE 6 of 001_add_validations.sql
   ALTER TABLE app_5939507989_lists
   ALTER COLUMN name SET NOT NULL ...
   ```

7. **Verify & Test**
   ```sql
   -- Run verification queries from 001_add_validations.sql
   SELECT * FROM pg_constraint WHERE ...
   ```

8. **Test Application**
   - Login
   - Create/Read/Update/Delete operations
   - Verify error handling

**Success Criteria:**
- [ ] All constraints applied successfully
- [ ] No existing data violates constraints
- [ ] Application works normally
- [ ] Error messages user-friendly

**Rollback Triggers:**
- Any constraint fails to apply
- Application breaks
- Performance degradation >20%
- User reports critical errors

---

### 📅 PHASE 4: RLS Policies Deployment

**Status**: ⏳ Da iniziare  
**Duration**: 1-2 ore  
**Risk Level**: 🔴 CRITICAL  
**Maintenance Window**: ✅ Richiesto

**Pre-Flight Checklist:**
- [ ] Migration 001 successful
- [ ] App tested with constraints
- [ ] RLS tested in test environment
- [ ] Multiple test users created
- [ ] Monitoring ready

**Execution Steps:**

1. **Phase 1 & 2: Permissive RLS** (Safe)
   ```sql
   -- Execute FASE 1-2 of 002_rls_policies.sql
   ALTER TABLE app_5939507989_lists ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "lists_permissive_all" ...
   ```

2. **Verify App Still Works**
   - Test with multiple users
   - Verify all operations work
   - Check for RLS denials in logs

3. **Phase 3: Granular Policies** (Gradual)
   ```sql
   -- Uncomment FASE 3 in 002_rls_policies.sql
   -- Apply one table at a time
   -- Test between each table
   ```

4. **Monitor RLS Denials**
   ```sql
   SELECT * FROM v_rls_performance_monitor;
   ```

**Success Criteria:**
- [ ] RLS enabled without breaking app
- [ ] Users see appropriate data
- [ ] Owner-based access works
- [ ] Catalog tables read-only

**Rollback Triggers:**
- Users locked out of their data
- Permission denied errors
- Performance issues
- Incorrect data visibility

---

### 📅 PHASE 5: Refactor Storage Layer

**Status**: ⏳ Da iniziare  
**Duration**: 2-4 ore  
**Risk Level**: 🟡 MEDIUM

**Tasks:**

1. **Remove Manual CASCADE Logic**
   ```typescript
   // storage.ts - deleteList()
   // BEFORE (manual cascade):
   // 1. Get requirement IDs
   // 2. Delete estimates
   // 3. Delete requirements
   // 4. Delete list
   
   // AFTER (FK cascade):
   const { error } = await supabase
     .from(TABLES.LISTS)
     .delete()
     .eq('list_id', listId);
   // FK handles cascade automatically
   ```

2. **Enhanced Error Handling**
   ```typescript
   // Distinguish RLS vs validation errors
   if (error.code === '42501') {
     throw new Error('Permesso negato (RLS)');
   } else if (error.code === '23514') {
     throw new Error('Dati non validi (CHECK)');
   } else if (error.code === '23503') {
     throw new Error('Riferimento non valido (FK)');
   }
   ```

3. **Update Test Suite**
   - Test new error messages
   - Verify CASCADE behavior
   - Test RLS with different users

**Success Criteria:**
- [ ] Code semplificato (meno logica manuale)
- [ ] Error messages chiari
- [ ] Backward compatibility mantenuta
- [ ] Tutti i test passano

---

## 🔧 Troubleshooting

### Issue: Constraint Violation on Existing Data

**Symptom:** Migration 001 fails with "violates check constraint"

**Solution:**
```sql
-- Find invalid data
SELECT * FROM app_5939507989_lists 
WHERE status NOT IN ('Active', 'Archived');

-- Fix data
UPDATE app_5939507989_lists 
SET status = 'Active' 
WHERE status IS NULL OR status NOT IN ('Active', 'Archived');

-- Retry migration
```

---

### Issue: RLS Locks Out Users

**Symptom:** Users get "permission denied" errors

**Solution:**
```sql
-- Check active policies
SELECT * FROM pg_policies 
WHERE tablename = 'app_5939507989_lists';

-- Temporarily disable RLS
ALTER TABLE app_5939507989_lists DISABLE ROW LEVEL SECURITY;

-- Re-apply with correct policy
-- (see 002_rls_policies.sql)
```

---

### Issue: Performance Degradation

**Symptom:** Queries slower after migration

**Solution:**
```sql
-- Check index usage
SELECT 
    schemaname, tablename, indexname, 
    idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename LIKE 'app_5939507989_%'
ORDER BY idx_scan DESC;

-- Analyze tables
ANALYZE app_5939507989_lists;
ANALYZE app_5939507989_requirements;
ANALYZE app_5939507989_estimates;

-- Check RLS overhead
-- (see monitoring queries in 002_rls_policies.sql)
```

---

### Issue: Orphan Records Break FK

**Symptom:** FK constraint fails to apply

**Solution:**
```sql
-- Find orphan requirements
SELECT r.req_id, r.list_id
FROM app_5939507989_requirements r
LEFT JOIN app_5939507989_lists l ON r.list_id = l.list_id
WHERE l.list_id IS NULL;

-- Options:
-- 1. Delete orphans
DELETE FROM app_5939507989_requirements 
WHERE req_id IN (...);

-- 2. Create dummy list
INSERT INTO app_5939507989_lists (list_id, name, ...)
VALUES ('orphan-list', 'Orphan Requirements', ...);
```

---

## 📊 Monitoring & Alerts

### Key Metrics to Track

1. **Constraint Violations**
   ```sql
   -- Check Supabase logs for errors
   -- Look for code: 23514 (CHECK), 23503 (FK), 23502 (NOT NULL)
   ```

2. **RLS Denials**
   ```sql
   SELECT * FROM v_rls_performance_monitor;
   ```

3. **Query Performance**
   ```sql
   SELECT query, calls, mean_exec_time
   FROM pg_stat_statements
   WHERE query LIKE '%app_5939507989_%'
   ORDER BY mean_exec_time DESC
   LIMIT 20;
   ```

4. **Database Size**
   ```sql
   SELECT 
       schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE tablename LIKE 'app_5939507989_%';
   ```

### Alert Thresholds

- 🔴 **Critical**: RLS denial rate > 5%
- 🔴 **Critical**: Constraint violation rate > 1%
- 🟠 **Warning**: Query time increase > 20%
- 🟠 **Warning**: Index usage < 80%

---

## 📚 Resources

### Documentation
- [SCHEMA_ANALYSIS.md](./SCHEMA_ANALYSIS.md) - Schema completo
- [001_add_validations.sql](./001_add_validations.sql) - Script validazioni
- [002_rls_policies.sql](./002_rls_policies.sql) - Script RLS
- [rollback_validations.sql](./rollback_validations.sql) - Emergency rollback

### Test Files
- `src/lib/__tests__/supabase-validation.test.ts` - Test suite completo

### Supabase Docs
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Functions](https://supabase.com/docs/guides/database/functions)
- [Postgres Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

---

## ✅ Sign-Off Checklist

Prima di considerare le migrations complete:

### Testing
- [ ] Test suite passa al 100%
- [ ] Test manuali completati
- [ ] Test con utenti multipli (RLS)
- [ ] Test performance accettabili
- [ ] Test rollback funzionante

### Documentation
- [ ] README aggiornato
- [ ] Error handling documentato
- [ ] Monitoring setup documentato
- [ ] Runbook per troubleshooting

### Code Quality
- [ ] storage.ts refactored
- [ ] Manual CASCADE logic rimossa
- [ ] Error messages user-friendly
- [ ] Logging appropriato

### Production Ready
- [ ] Backup verified
- [ ] Rollback tested
- [ ] Monitoring active
- [ ] Team trained
- [ ] Stakeholders notified

---

## 🆘 Emergency Contacts

**In caso di problemi critici:**

1. **Rollback Immediato**
   ```bash
   psql -h prod-db -U postgres -d postgres -f migrations/rollback_validations.sql
   ```

2. **Check Logs**
   - Supabase Dashboard > Database > Logs
   - Application logs (Sentry/CloudWatch)

3. **Contact**
   - DBA: [email]
   - DevOps: [email]
   - Product Owner: [email]

---

**Last Updated:** 2025-11-08  
**Version:** 1.0  
**Status:** Ready for Testing
