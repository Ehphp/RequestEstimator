# Database Schema Analysis - Power Platform Estimation System

**Generated:** 2025-11-08  
**Purpose:** Documentation dello schema esistente prima dell'implementazione di validazioni e RLS policies

---

## 📊 OVERVIEW TABELLE

### Tabelle Dati Principali
1. `app_5939507989_lists` - Contenitori di progetto
2. `app_5939507989_requirements` - Requisiti per lista
3. `app_5939507989_estimates` - Stime storiche per requisito
4. `app_5939507989_sticky_defaults` - Preferenze utente persistenti

### Tabelle Catalogo (Read-Only)
5. `app_5939507989_activities` - Catalogo attività
6. `app_5939507989_drivers` - Moltiplicatori driver
7. `app_5939507989_risks` - Catalogo rischi
8. `app_5939507989_contingency_bands` - Bande di contingenza

---

## 🗂️ SCHEMA DETTAGLIATO

### 1. app_5939507989_lists

**Purpose:** Container per gruppi di requisiti (progetti/sprint)

| Campo | Tipo | Required | Enum/Constraint | Default | Note |
|-------|------|----------|-----------------|---------|------|
| `list_id` | TEXT | ✅ PRIMARY KEY | - | - | Format: "LST-timestamp-random" |
| `name` | TEXT | ✅ | - | - | Nome lista (user-facing) |
| `description` | TEXT | ❌ | - | NULL | Descrizione estesa |
| `preset_key` | TEXT | ❌ | Riferisce presets.ts | NULL | Es: 'HR_NOTIFY', 'DV_EXT' |
| `created_on` | TIMESTAMPTZ | ✅ | - | NOW() | ISO 8601 timestamp |
| `created_by` | TEXT | ✅ | - | - | User ID creator |
| `status` | TEXT | ✅ | 'Active', 'Archived' | 'Active' | Lifecycle status |
| `owner` | TEXT | ❌ | - | NULL | Business owner |
| `period` | TEXT | ❌ | - | NULL | Es: "Q1/2025" |
| `notes` | TEXT | ❌ | - | NULL | Note libere |

**Relationships:**
- `requirements.list_id` → `lists.list_id` (1:N) ⚠️ NO FK attualmente

**Business Rules:**
- Status 'Active' è il default per nuove liste
- `preset_key` determina defaults intelligenti per requirements
- Delete di lista richiede cascade manuale su requirements

---

### 2. app_5939507989_requirements

**Purpose:** Requisiti individuali all'interno di una lista

| Campo | Tipo | Required | Enum/Constraint | Default | Note |
|-------|------|----------|-----------------|---------|------|
| `req_id` | TEXT | ✅ PRIMARY KEY | - | - | Format: "REQ-timestamp-random" |
| `list_id` | TEXT | ✅ FOREIGN KEY | - | - | ⚠️ NO FK constraint attualmente |
| `title` | TEXT | ✅ | - | - | Nome breve requisito |
| `description` | TEXT | ✅ | - | '' | Descrizione dettagliata |
| `priority` | TEXT | ✅ | 'High', 'Med', 'Low' | 'Med' | Priorità business |
| `state` | TEXT | ✅ | 'Proposed', 'Selected', 'Scheduled', 'Done' | 'Proposed' | Stato workflow |
| `business_owner` | TEXT | ✅ | - | - | Owner del requisito |
| `labels` | TEXT | ❌ | - | NULL | CSV tags (es: "HR, Notifiche") |
| `created_on` | TIMESTAMPTZ | ✅ | - | NOW() | Timestamp creazione |
| `last_estimated_on` | TIMESTAMPTZ | ❌ | - | NULL | Ultimo salvataggio stima |
| `estimator` | TEXT | ❌ | - | NULL | User che ha stimato |
| `priority_default_source` | TEXT | ❌ | - | NULL | Source del default (audit) |
| `priority_is_overridden` | BOOLEAN | ❌ | - | FALSE | Flag override manuale |
| `labels_default_source` | TEXT | ❌ | - | NULL | Source default labels |
| `labels_is_overridden` | BOOLEAN | ❌ | - | FALSE | Flag override manuale |
| `description_default_source` | TEXT | ❌ | - | NULL | Source default description |
| `description_is_overridden` | BOOLEAN | ❌ | - | FALSE | Flag override manuale |

**Relationships:**
- `requirements.list_id` → `lists.list_id` (N:1) ⚠️ NO FK
- `estimates.req_id` → `requirements.req_id` (1:N) ⚠️ NO FK

**Business Rules:**
- Priority inferita da keyword analysis su title (inferPriorityFromTitle)
- Labels inferiti da title (inferLabelsFromTitle)
- Description da preset template se disponibile
- Cascade delete manuale: delete req → delete estimates

**Inference Logic:**
- 'critico', 'compliance', 'blocco' → Priority: High
- 'miglioria', 'refactor' → Priority: Low
- Keywords HR, Finance, IT → Labels corrispondenti

---

### 3. app_5939507989_estimates

**Purpose:** Stime storiche per tracking audit trail e versioning

| Campo | Tipo | Required | Enum/Constraint | Default | Note |
|-------|------|----------|-----------------|---------|------|
| `estimate_id` | TEXT | ✅ PRIMARY KEY | - | - | Format: "EST-timestamp" |
| `req_id` | TEXT | ✅ FOREIGN KEY | - | - | ⚠️ NO FK constraint |
| `scenario` | TEXT | ✅ | - | 'A' | Scenario name (es: 'A', 'Standard') |
| `complexity` | TEXT | ✅ | 'Low', 'Medium', 'High' | - | Driver complessità |
| `environments` | TEXT | ✅ | '1 env', '2 env', '3 env' | - | Driver ambienti |
| `reuse` | TEXT | ✅ | 'Low', 'Medium', 'High' | - | Driver riutilizzo |
| `stakeholders` | TEXT | ✅ | '1 team', '2-3 team', '4+ team' | - | Driver stakeholder |
| `included_activities` | TEXT[] | ✅ | - | '{}' | Array activity_codes |
| `optional_activities` | TEXT[] | ✅ | - | '{}' | Array activity_codes opzionali |
| `include_optional` | BOOLEAN | ✅ | - | FALSE | Flag inclusione optional |
| `selected_risks` | TEXT[] | ✅ | - | '{}' | Array risk_ids |
| `activities_base_days` | NUMERIC(10,3) | ✅ | >= 0 | - | Somma base_days attività |
| `driver_multiplier` | NUMERIC(10,3) | ✅ | > 0 | - | Prodotto 4 drivers |
| `subtotal_days` | NUMERIC(10,3) | ✅ | >= 0 | - | base_days × multiplier |
| `risk_score` | INTEGER | ✅ | >= 0 | - | Somma weight rischi |
| `contingency_pct` | NUMERIC(5,3) | ✅ | 0.00-0.50 | - | Percentuale contingenza |
| `contingency_days` | NUMERIC(10,3) | ✅ | >= 0 | - | subtotal × contingency_pct |
| `total_days` | NUMERIC(10,3) | ✅ | >= 0 | - | subtotal + contingency |
| `catalog_version` | TEXT | ✅ | - | 'v1.0' | Versione catalogo attività |
| `drivers_version` | TEXT | ✅ | - | 'v1.0' | Versione drivers |
| `riskmap_version` | TEXT | ✅ | - | 'v1.0' | Versione risk map |
| `created_on` | TIMESTAMPTZ | ✅ | - | NOW() | Timestamp stima |
| `complexity_default_source` | TEXT | ❌ | - | NULL | Source default (audit) |
| `complexity_is_overridden` | BOOLEAN | ✅ | - | FALSE | Override flag |
| `environments_default_source` | TEXT | ❌ | - | NULL | Source default |
| `environments_is_overridden` | BOOLEAN | ✅ | - | FALSE | Override flag |
| `reuse_default_source` | TEXT | ❌ | - | NULL | Source default |
| `reuse_is_overridden` | BOOLEAN | ✅ | - | FALSE | Override flag |
| `stakeholders_default_source` | TEXT | ❌ | - | NULL | Source default |
| `stakeholders_is_overridden` | BOOLEAN | ✅ | - | FALSE | Override flag |
| `activities_default_source` | TEXT | ❌ | - | NULL | Source default |
| `activities_is_overridden` | BOOLEAN | ✅ | - | FALSE | Override flag |
| `risks_default_source` | TEXT | ❌ | - | NULL | Source default |
| `risks_is_overridden` | BOOLEAN | ✅ | - | FALSE | Override flag |
| `default_json` | TEXT | ❌ | - | NULL | JSON completo defaults |

**Relationships:**
- `estimates.req_id` → `requirements.req_id` (N:1) ⚠️ NO FK

**Business Rules:**
- Tutte le stime sono immutabili (audit trail)
- Latest estimate per requirement: ORDER BY created_on DESC LIMIT 1
- Calcoli deterministici (formule in calculations.ts)

**Calculation Formulas:**
```
driver_multiplier = complexity × environments × reuse × stakeholders
subtotal_days = activities_base_days × driver_multiplier
risk_score = SUM(selected_risks.weight)
contingency_pct = getContingencyPercentage(risk_score)  // 0%, 10%, 20%, 35% max 50%
contingency_days = subtotal_days × contingency_pct
total_days = subtotal_days + contingency_days
```

---

### 4. app_5939507989_sticky_defaults

**Purpose:** Preferenze utente persistenti per pre-compilazione stime

| Campo | Tipo | Required | Enum/Constraint | Default | Note |
|-------|------|----------|-----------------|---------|------|
| `user_id` | TEXT | ✅ PRIMARY KEY | - | - | User identifier |
| `list_id` | TEXT | ✅ PRIMARY KEY | - | - | Context-specific defaults |
| `complexity` | TEXT | ❌ | 'Low', 'Medium', 'High' | NULL | Last used complexity |
| `environments` | TEXT | ❌ | '1 env', '2 env', '3 env' | NULL | Last used environments |
| `reuse` | TEXT | ❌ | 'Low', 'Medium', 'High' | NULL | Last used reuse |
| `stakeholders` | TEXT | ❌ | '1 team', '2-3 team', '4+ team' | NULL | Last used stakeholders |
| `included_activities` | TEXT[] | ❌ | - | '{}' | Last selected activities |
| `updated_on` | TIMESTAMPTZ | ✅ | - | NOW() | Last update timestamp |

**Composite Primary Key:** (user_id, list_id)

**Business Rules:**
- Aggiornato ad ogni salvataggio stima
- Override preset defaults se presenti
- Scope per lista (diversi progetti = diversi defaults)

---

### 5. app_5939507989_activities (CATALOG)

**Purpose:** Catalogo master attività con effort base

| Campo | Tipo | Required | Enum/Constraint | Default | Note |
|-------|------|----------|-----------------|---------|------|
| `activity_code` | TEXT | ✅ PRIMARY KEY | - | - | Es: 'ANL_ALIGN', 'DV_FIELD' |
| `display_name` | TEXT | ✅ | - | - | Nome user-friendly |
| `driver_group` | TEXT | ✅ | - | - | Gruppo logico (Analysis, Dataverse, etc) |
| `base_days` | NUMERIC(5,2) | ✅ | > 0 | - | Effort base in giorni/uomo |
| `helper_short` | TEXT | ✅ | - | - | Tooltip breve |
| `helper_long` | TEXT | ✅ | - | - | Documentazione estesa |
| `status` | TEXT | ✅ | 'Active', 'Deprecated' | 'Active' | Lifecycle status |

**Business Rules:**
- Read-only per users
- Modifiche richiedono nuovo catalog_version
- Esempio: 'ANL_ALIGN' = 0.5 giorni, 'PA_FLOW' = 0.5 giorni

---

### 6. app_5939507989_drivers (CATALOG)

**Purpose:** Moltiplicatori per calcolo effort

| Campo | Tipo | Required | Enum/Constraint | Default | Note |
|-------|------|----------|-----------------|---------|------|
| `driver` | TEXT | ✅ COMPOSITE KEY | 'complexity', 'environments', 'reuse', 'stakeholders' | - | Driver type |
| `option` | TEXT | ✅ COMPOSITE KEY | Varies by driver | - | Valore specifico |
| `multiplier` | NUMERIC(5,3) | ✅ | > 0 | - | Moltiplicatore numerico |
| `explanation` | TEXT | ✅ | - | - | Documentazione |

**Composite Primary Key:** (driver, option)

**Valid Combinations:**
- driver='complexity': option IN ('Low', 'Medium', 'High')
- driver='environments': option IN ('1 env', '2 env', '3 env')
- driver='reuse': option IN ('Low', 'Medium', 'High')
- driver='stakeholders': option IN ('1 team', '2-3 team', '4+ team')

**Example Multipliers:**
- complexity.Low = 0.8, Medium = 1.0, High = 1.5
- environments.'1 env' = 0.8, '2 env' = 1.0, '3 env' = 1.3

---

### 7. app_5939507989_risks (CATALOG)

**Purpose:** Catalogo rischi con pesatura

| Campo | Tipo | Required | Enum/Constraint | Default | Note |
|-------|------|----------|-----------------|---------|------|
| `risk_id` | TEXT | ✅ PRIMARY KEY | - | - | Es: 'R001', 'R002' |
| `risk_item` | TEXT | ✅ | - | - | Descrizione rischio |
| `weight` | INTEGER | ✅ | >= 0 | - | Peso per calcolo risk_score |
| `guidance` | TEXT | ✅ | - | - | Guidance per identificazione |

**Business Rules:**
- Read-only per users
- risk_score = SUM(selected_risks.weight)
- Weights tipicamente: 1-10 range

---

### 8. app_5939507989_contingency_bands (CATALOG)

**Purpose:** Mapping risk_score → contingency_pct

| Campo | Tipo | Required | Enum/Constraint | Default | Note |
|-------|------|----------|-----------------|---------|------|
| `band` | TEXT | ✅ PRIMARY KEY | 'Low', 'Medium', 'High' | - | Risk band name |
| `level` | TEXT | ✅ | - | - | Descrizione testuale |
| `contingency_pct` | NUMERIC(5,3) | ✅ | 0.00-0.50 | - | Percentuale contingenza |

**Business Rules:**
- risk_score 0: 0% contingenza (fixed)
- risk_score 1-10: Low band (default 10%)
- risk_score 11-20: Medium band (default 20%)
- risk_score 21+: High band (default 35%)
- Cap massimo: 50%

---

## 🔗 RELAZIONI E INTEGRITÀ REFERENZIALE

### ⚠️ MISSING CONSTRAINTS (CRITICI)

```
app_5939507989_requirements.list_id
  → app_5939507989_lists.list_id
  ❌ NO FOREIGN KEY CONSTRAINT
  ⚠️ Cascade delete implementato manualmente in storage.ts:deleteList()

app_5939507989_estimates.req_id
  → app_5939507989_requirements.req_id
  ❌ NO FOREIGN KEY CONSTRAINT
  ⚠️ Cascade delete implementato manualmente in storage.ts:deleteRequirement()
```

### Logica Cascade Manuale Attuale

**storage.ts:deleteList()**
```typescript
// Step 1: Recupera requirements IDs
// Step 2: Delete estimates IN (req_ids)
// Step 3: Delete requirements WHERE list_id
// Step 4: Delete list
```

**storage.ts:deleteRequirement()**
```typescript
// Step 1: Delete estimates WHERE req_id
// Step 2: Delete requirement
```

---

## 🚨 VALIDAZIONI MANCANTI (da implementare)

### CHECK Constraints Necessari

1. **Enum Validation**
   - lists.status IN ('Active', 'Archived')
   - requirements.priority IN ('High', 'Med', 'Low')
   - requirements.state IN ('Proposed', 'Selected', 'Scheduled', 'Done')
   - estimates.complexity IN ('Low', 'Medium', 'High')
   - estimates.environments IN ('1 env', '2 env', '3 env')
   - estimates.reuse IN ('Low', 'Medium', 'High')
   - estimates.stakeholders IN ('1 team', '2-3 team', '4+ team')
   - activities.status IN ('Active', 'Deprecated')

2. **Range Constraints**
   - activities.base_days > 0
   - drivers.multiplier > 0
   - risks.weight >= 0
   - estimates.activities_base_days >= 0
   - estimates.driver_multiplier > 0
   - estimates.subtotal_days >= 0
   - estimates.risk_score >= 0
   - estimates.contingency_pct BETWEEN 0.00 AND 0.50
   - estimates.contingency_days >= 0
   - estimates.total_days >= 0
   - contingency_bands.contingency_pct BETWEEN 0.00 AND 0.50

3. **NOT NULL Necessari** (campi che l'app popola sempre)
   - lists.name NOT NULL
   - lists.status NOT NULL (già ha default)
   - requirements.title NOT NULL
   - requirements.priority NOT NULL
   - requirements.state NOT NULL
   - estimates.* (la maggior parte dei campi numerici)

4. **Calculation Validation** (via trigger)
   - estimates.subtotal_days ≈ activities_base_days × driver_multiplier
   - estimates.total_days ≈ subtotal_days + contingency_days
   - estimates.contingency_days ≈ subtotal_days × contingency_pct

---

## 🔐 ROW LEVEL SECURITY (da implementare)

### Status Attuale
- ❌ RLS NON abilitato su nessuna tabella
- ⚠️ Tutti gli utenti autenticati hanno accesso completo
- ⚠️ Nessuna separazione owner-based

### Policy Requirements

#### Tabelle Dati (lists, requirements, estimates, sticky_defaults)
1. **SELECT**: Tutti possono leggere (collaborazione)
2. **INSERT**: Solo owner/creator
3. **UPDATE**: Solo owner (lists) / creator (altri)
4. **DELETE**: Solo owner/creator

#### Tabelle Catalogo (activities, drivers, risks, contingency_bands)
1. **SELECT**: Tutti possono leggere
2. **INSERT/UPDATE/DELETE**: Solo admin/system

---

## 📊 STATISTICHE E INDICI NECESSARI

### Indici Mancanti (performance)
```sql
-- Per JOIN frequenti
CREATE INDEX idx_requirements_list_id ON app_5939507989_requirements(list_id);
CREATE INDEX idx_estimates_req_id ON app_5939507989_estimates(req_id);

-- Per queries filtrate
CREATE INDEX idx_lists_status ON app_5939507989_lists(status);
CREATE INDEX idx_requirements_state ON app_5939507989_requirements(state);
CREATE INDEX idx_requirements_priority ON app_5939507989_requirements(priority);

-- Per sort operations
CREATE INDEX idx_estimates_created_on ON app_5939507989_estimates(created_on DESC);
CREATE INDEX idx_requirements_created_on ON app_5939507989_requirements(created_on DESC);

-- Per sticky defaults lookup
CREATE INDEX idx_sticky_defaults_user_list ON app_5939507989_sticky_defaults(user_id, list_id);
```

---

## 🎯 PRIORITÀ IMPLEMENTAZIONE

### FASE 1 (CRITICHE) - Non rompono l'esistente
1. ✅ Foreign Keys con CASCADE (sostituiscono logica manuale)
2. ✅ Indici per performance
3. ✅ NOT NULL su campi sempre popolati
4. ✅ DEFAULT values

### FASE 2 (ALTE) - Richiedono validazione dati esistenti
1. CHECK constraints per enum
2. CHECK constraints per range numerici
3. RLS abilitazione + policy permissive

### FASE 3 (MEDIE) - Validazioni avanzate
1. RLS policies granulari owner-based
2. Triggers per calculation validation
3. Audit log triggers

---

## 📝 NOTE IMPLEMENTATIVE

### Backward Compatibility
- ✅ Tutte le validazioni proposte sono compatibili con dati esistenti
- ✅ FK CASCADE sostituiscono logica manuale senza side effects
- ⚠️ Verificare che non esistano orphan records prima di FK
- ⚠️ Verificare enum values su dati esistenti prima di CHECK

### Migration Strategy
1. Backup database completo
2. Applicare indici (safe, no downtime)
3. Applicare FK dopo verifica integrità
4. Applicare CHECK dopo validazione dati
5. Abilitare RLS con policy permissive
6. Graduale restrizione policy
7. Rimuovere logica manuale da storage.ts SOLO dopo test

---

**Analysis Complete** ✅  
Pronto per Step 2: Creazione script SQL validazioni

