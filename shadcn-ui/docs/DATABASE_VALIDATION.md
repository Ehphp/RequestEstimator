# Database Validation & Security

**Status**: ⚠️ In Implementation  
**Last Updated**: 2025-11-08  
**Owner**: Development Team

## Overview

Questo documento descrive le validazioni database-level, le Row Level Security (RLS) policies, e il sistema di error handling implementato per garantire integrità dei dati e sicurezza.

## Table of Contents

- [Database Constraints](#database-constraints)
- [Row Level Security (RLS)](#row-level-security-rls)
- [Error Handling](#error-handling)
- [Monitoring](#monitoring)
- [Migration Guide](#migration-guide)

---

## Database Constraints

### Status: ⚠️ Partially Implemented

Le validazioni database sono state progettate ma **non ancora applicate in produzione**. I file SQL sono pronti in `migrations/` directory.

### Constraint Types

#### 1. CHECK Constraints (Enum Validation)

Validano che i valori enum siano corretti:

```sql
-- Priority values
ALTER TABLE app_5939507989_lists 
  ADD CONSTRAINT chk_lists_priority 
  CHECK (priority IN ('High', 'Med', 'Low'));

-- State values  
ALTER TABLE app_5939507989_requirements
  ADD CONSTRAINT chk_requirements_state
  CHECK (state IN ('Proposed', 'Selected', 'Scheduled', 'Done'));

-- Complexity values
ALTER TABLE app_5939507989_estimates
  ADD CONSTRAINT chk_estimates_complexity
  CHECK (complexity IN ('Low', 'Medium', 'High'));
```

**Impatto**: Inserimenti con valori invalidi falliranno con errore `23514` (CHECK_VIOLATION).

#### 2. Foreign Keys with CASCADE

Garantiscono integrità referenziale e cascade delete automatico:

```sql
-- Requirements → Lists
ALTER TABLE app_5939507989_requirements
  ADD CONSTRAINT fk_requirements_list_id
  FOREIGN KEY (list_id) REFERENCES app_5939507989_lists(list_id)
  ON DELETE CASCADE;

-- Estimates → Requirements
ALTER TABLE app_5939507989_estimates
  ADD CONSTRAINT fk_estimates_req_id
  FOREIGN KEY (req_id) REFERENCES app_5939507989_requirements(req_id)
  ON DELETE CASCADE;
```

**Impatto**: 
- Impedisce inserimenti con riferimenti non validi
- Eliminazione lista → elimina automaticamente requirements ed estimates
- Eliminazione requirement → elimina automaticamente estimates
- ⚠️ Logica manuale in `storage.ts` diventa ridondante (vedi [Migration Guide](#migration-guide))

#### 3. NOT NULL Constraints

Garantiscono che campi obbligatori abbiano sempre valori:

```sql
ALTER TABLE app_5939507989_lists
  ALTER COLUMN priority SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'Active';
```

#### 4. Range Validations

Validano range numerici:

```sql
-- Positive values
ALTER TABLE app_5939507989_estimates
  ADD CONSTRAINT chk_estimates_positive_days
  CHECK (activities_base_days > 0 AND subtotal_days >= 0 AND total_days >= 0);

-- Percentage ranges
ALTER TABLE app_5939507989_estimates
  ADD CONSTRAINT chk_estimates_contingency_range
  CHECK (contingency_pct >= 0 AND contingency_pct <= 0.50);
```

### Performance Indexes

Per ottimizzare query con JOIN e filtri:

```sql
-- Foreign key indexes
CREATE INDEX idx_requirements_list_id ON app_5939507989_requirements(list_id);
CREATE INDEX idx_estimates_req_id ON app_5939507989_estimates(req_id);

-- Filter indexes
CREATE INDEX idx_lists_status ON app_5939507989_lists(status);
CREATE INDEX idx_requirements_state ON app_5939507989_requirements(state);
CREATE INDEX idx_activities_status ON app_5939507989_activities(status);
```

**Script**: `migrations/001_add_validations.sql` (7 phases, ~20KB)

---

## Row Level Security (RLS)

### Status: ⚠️ Designed, Not Applied

Le RLS policies sono progettate con strategia **progressive rollout**:

1. **Phase 1-2**: Enable RLS + Permissive policies (allow all authenticated)
2. **Phase 3**: Granular owner-based policies (dopo testing multi-user)

### Current Access Model

❌ **No RLS active**: Tutti gli utenti autenticati hanno accesso completo a tutti i dati.

### Target Access Model (Phase 3)

#### Lists Table

```sql
-- Owner can CRUD their lists
CREATE POLICY policy_lists_owner_crud ON app_5939507989_lists
  FOR ALL USING (owner_id = auth.uid());

-- All authenticated users can READ all lists
CREATE POLICY policy_lists_read_all ON app_5939507989_lists
  FOR SELECT USING (auth.role() = 'authenticated');
```

#### Requirements Table

```sql
-- Access based on list ownership
CREATE POLICY policy_requirements_via_list ON app_5939507989_requirements
  FOR ALL USING (
    list_id IN (
      SELECT list_id FROM app_5939507989_lists 
      WHERE owner_id = auth.uid()
    )
  );
```

#### Estimates Table

```sql
-- Access based on requirement ownership (via list)
CREATE POLICY policy_estimates_via_requirement ON app_5939507989_estimates
  FOR ALL USING (
    req_id IN (
      SELECT r.req_id FROM app_5939507989_requirements r
      JOIN app_5939507989_lists l ON r.list_id = l.list_id
      WHERE l.owner_id = auth.uid()
    )
  );
```

#### Sticky Defaults Table

```sql
-- User can only access their own defaults
CREATE POLICY policy_sticky_user_only ON app_5939507989_sticky_defaults
  FOR ALL USING (user_id = auth.uid());
```

#### Catalog Tables

```sql
-- Read-only for all authenticated users
CREATE POLICY policy_activities_read_only ON app_5939507989_activities
  FOR SELECT USING (auth.role() = 'authenticated');
```

**Script**: `migrations/002_rls_policies.sql` (progressive strategy, ~18KB)

### RLS Testing Checklist

Prima di attivare Phase 3 (granular policies):

- [ ] Test con utente A: può creare/leggere/modificare/eliminare solo sue liste
- [ ] Test con utente B: NON può vedere liste di utente A
- [ ] Test multi-user: utente A e B lavorano contemporaneamente senza conflitti
- [ ] Test catalog access: entrambi possono leggere activities/drivers/risks
- [ ] Test export: utente può esportare solo i suoi requirements
- [ ] Performance test: RLS policies non rallentano query significativamente

---

## Error Handling

### Architecture

Centralizzato in `src/lib/dbErrors.ts` con parsing intelligente degli errori PostgreSQL.

### Error Types

| Type | PostgreSQL Code | User Message |
|------|----------------|--------------|
| **RLS Denial** | `42501` | "Non hai i permessi necessari per eseguire questa operazione" |
| **CHECK Violation** | `23514` | Messaggio specifico per constraint (es. "Priorità non valida. Valori ammessi: High, Med, Low") |
| **Foreign Key Violation** | `23503` | "La lista specificata non esiste" / "Il requisito specificato non esiste" |
| **NOT NULL Violation** | `23502` | "Il campo '[nome]' non può essere vuoto" |
| **Unique Violation** | `23505` | "Questo valore esiste già" |
| **Not Found** | `PGRST116` | "Elemento non trovato" |

### Usage Pattern

#### Old Code (❌ Don't use)
```typescript
if (error) {
  logger.error('Error saving list:', error);
  throw new Error(`Impossibile salvare la lista: ${error.message}`);
}
```

#### New Code (✅ Use this)
```typescript
import { throwDbError } from './dbErrors';

if (error) {
  throwDbError(error, 'Impossibile salvare la lista');
}
```

### Error Parsing Details

```typescript
import { parseDbError, isRlsError, isConstraintError } from './dbErrors';

const errorInfo = parseDbError(error);

// errorInfo structure:
{
  type: 'rls' | 'constraint' | 'not_found' | 'validation' | 'unknown',
  code: '42501' | '23514' | etc.,
  message: 'Non hai i permessi necessari...',  // User-friendly italiano
  originalMessage: 'new row violates...',       // Technical PostgreSQL message
  constraintName?: 'chk_lists_priority',
  tableName?: 'app_5939507989_lists',
  columnName?: 'priority',
  details?: '...'
}
```

### Constraint Message Mapping

L'utility `getCheckConstraintMessage()` mappa constraint names a messaggi user-friendly:

```typescript
const constraintMessages: Record<string, string> = {
  chk_lists_priority: 'Priorità non valida. Valori ammessi: High, Med, Low',
  chk_requirements_state: 'Stato non valido. Valori ammessi: Proposed, Selected, Scheduled, Done',
  chk_estimates_positive_days: 'I giorni stimati devono essere maggiori di zero',
  chk_estimates_contingency_range: 'La percentuale di contingenza deve essere tra 0% e 50%',
  // ... 20+ mappings
};
```

**Benefit**: Gli utenti vedono messaggi chiari invece di errori tecnici PostgreSQL.

---

## Monitoring

### Database Constraint Violations

#### Query: Detect CHECK constraint violations

```sql
-- Trova righe che violerebbero constraint (prima di applicarli)
SELECT 
  list_id, 
  name, 
  priority,
  'Invalid priority value' AS issue
FROM app_5939507989_lists
WHERE priority NOT IN ('High', 'Med', 'Low');

SELECT
  req_id,
  title,
  state,
  'Invalid state value' AS issue
FROM app_5939507989_requirements
WHERE state NOT IN ('Proposed', 'Selected', 'Scheduled', 'Done');
```

#### Query: Orphaned records (FK violations)

```sql
-- Requirements senza lista esistente
SELECT 
  r.req_id,
  r.list_id,
  'Orphaned requirement (list not found)' AS issue
FROM app_5939507989_requirements r
LEFT JOIN app_5939507989_lists l ON r.list_id = l.list_id
WHERE l.list_id IS NULL;

-- Estimates senza requirement esistente
SELECT
  e.estimate_id,
  e.req_id,
  'Orphaned estimate (requirement not found)' AS issue
FROM app_5939507989_estimates e
LEFT JOIN app_5939507989_requirements r ON e.req_id = r.req_id
WHERE r.req_id IS NULL;
```

### RLS Policy Denials

#### Enable RLS logging (Supabase Dashboard)

1. Settings → Database → Logs
2. Enable "RLS Policy Denials"
3. Monitor log stream

#### Query: RLS denied operations (from pg_stat_statements)

```sql
SELECT 
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%policy%denied%'
ORDER BY calls DESC;
```

### Performance Impact

#### Query: Check index usage

```sql
-- Verifica che gli indici FK siano usati
EXPLAIN ANALYZE
SELECT r.* 
FROM app_5939507989_requirements r
WHERE r.list_id = '<some-list-id>';

-- Output dovrebbe mostrare "Index Scan using idx_requirements_list_id"
```

#### Query: Constraint check overhead

```sql
-- Misura tempo con/senza validazioni
SET enable_seqscan = off;

EXPLAIN (ANALYZE, BUFFERS)
INSERT INTO app_5939507989_estimates (...) VALUES (...);

-- Verifica "Trigger" execution time
```

### Monitoring Dashboard (Supabase)

Configurare alert per:

1. **High error rate**: > 5% delle operazioni falliscono
2. **RLS denials spike**: Improvviso aumento di 42501 errors
3. **Slow queries**: Query > 500ms
4. **Constraint violations**: Pattern di violazioni ripetute (possibile bug app)

---

## Migration Guide

### Pre-Migration Checklist

- [ ] **Backup completo database** (Step 5 TODO)
- [ ] **Test environment setup** con copia production data
- [ ] **Review migration scripts** (001, 002, 003)
- [ ] **Team notification** (downtime window if needed)

### Migration Steps (Recommended Order)

#### Phase 1: Safe Validations (Low Risk)

1. Apply **indexes only** (Phase 1 di `001_add_validations.sql`)
   - Zero risk, solo performance improvement
   - Monitor index usage for 24-48h

2. Apply **NOT NULL + DEFAULT** (Phase 6 di `001_add_validations.sql`)
   - Safe se app già popola questi campi sempre
   - Run pre-flight queries per verificare nessun NULL esistente

#### Phase 2: Constraint Validations (Medium Risk)

3. Apply **CHECK constraints** (Phases 4-5 di `001_add_validations.sql`)
   - Valida dati esistenti PRIMA con queries Phase 2
   - Se violazioni trovate → fix data PRIMA di applicare constraint

4. Apply **Foreign Keys** (Phase 3 di `001_add_validations.sql`)
   - Valida nessun orphan record PRIMA
   - Monitora cascade delete behavior

#### Phase 3: Code Refactoring (Post-FK Verification)

5. **After FK verified**: Remove manual cascade delete logic
   - `deleteList()`: Rimuovere Steps 2-4, tenere solo Step 5
   - `deleteRequirement()`: Rimuovere Step 2, tenere solo Step 3
   - Test extensively prima di production deploy

#### Phase 4: RLS Policies (High Risk)

6. Apply **RLS Phase 1-2** (Permissive policies)
   - Enable RLS + allow all authenticated
   - Zero functional impact ma abilita infrastruttura RLS

7. **Multi-user testing** in staging con Phase 3 policies

8. Apply **RLS Phase 3** (Granular policies)
   - Owner-based access control
   - Monitor RLS denials, adjust policies se needed

#### Phase 5: Advanced Triggers (Optional)

9. Apply **triggers** (`003_triggers.sql`)
   - `trg_update_requirement_timestamp` (recommended)
   - `trg_validate_estimate_calculations` (optional, redundant)
   - Audit log triggers (only if compliance required)

### Rollback Plan

Se problemi in production:

```bash
# Execute emergency rollback
psql -f migrations/rollback_validations.sql

# Poi:
# 1. Investigate issue
# 2. Fix migration script
# 3. Re-test in staging
# 4. Re-apply with fix
```

⚠️ **CRITICAL**: Dopo rollback Phase 4 (FK drop), **manual cascade delete** in storage.ts diventa necessario di nuovo!

### Post-Migration Verification

- [ ] Run test suite: `pnpm run test`
- [ ] Smoke test app: Creare lista → requirement → estimate
- [ ] Test delete cascade: Eliminare lista, verificare requirements/estimates eliminati
- [ ] Test validations: Tentare inserire dati invalidi (deve fallire con errore chiaro)
- [ ] Test RLS: Con utente A e B, verificare isolamento dati
- [ ] Monitor logs per 24h: Cercare errori imprevisti

---

## Developer Guide

### Adding New Constraints

1. **Document constraint** in questo README
2. **Update `dbErrors.ts`** con messaggio user-friendly
3. **Create migration** in `migrations/` con numero sequenziale
4. **Add rollback** in `rollback_validations.sql`
5. **Update tests** in `__tests__/supabase-validation.test.ts`
6. **Test in staging** prima di production

### Debugging Constraint Errors

```typescript
// In browser console
import { parseDbError } from './lib/dbErrors';

// Simula errore
const mockError = {
  code: '23514',
  message: 'violates check constraint "chk_lists_priority"',
  details: 'Failing row contains (...)',
};

const info = parseDbError(mockError);
console.log(info);
// Output: { type: 'constraint', message: 'Priorità non valida...', ... }
```

### Testing RLS Locally

```typescript
// Create test users in Supabase Dashboard > Authentication
const userA = { id: 'user-a-uuid', email: 'test-a@example.com' };
const userB = { id: 'user-b-uuid', email: 'test-b@example.com' };

// Login as User A
await supabase.auth.signInWithPassword({ email: userA.email, password: '...' });

// Try to access User B's data (should fail with RLS)
const { data, error } = await supabase
  .from(TABLES.LISTS)
  .select('*')
  .eq('owner_id', userB.id);

// error.code should be '42501' (INSUFFICIENT_PRIVILEGE)
```

---

## References

- **Migration Scripts**: `migrations/001_add_validations.sql`, `002_rls_policies.sql`, `003_triggers.sql`
- **Error Handling**: `src/lib/dbErrors.ts`
- **Storage Layer**: `src/lib/storage.ts`
- **Schema Documentation**: `migrations/SCHEMA_ANALYSIS.md`
- **Deployment Guide**: `migrations/README.md`
- **PostgreSQL Error Codes**: https://www.postgresql.org/docs/current/errcodes-appendix.html
- **Supabase RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-11-08 | Initial documentation, constraint design, RLS policies design, error handling implementation | AI Assistant |
| TBD | Phase 1 applied (indexes + NOT NULL) | - |
| TBD | Phase 2 applied (CHECK + FK) | - |
| TBD | Phase 3 applied (RLS granular) | - |

---

**Next Steps**: Execute Step 5 (Database Backup) before applying any migrations.
