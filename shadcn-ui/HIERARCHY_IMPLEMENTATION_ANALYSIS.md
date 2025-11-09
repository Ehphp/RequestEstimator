# Analisi Implementazione Gerarchia Padre-Figlio tra Requisiti

**Data:** 9 Novembre 2025  
**Obiettivo:** Implementare relazioni gerarchiche tra requisiti con impatto sui tempi di implementazione

---

## 📋 EXECUTIVE SUMMARY

### Desiderata
Ogni requisito deve poter essere **padre** o **figlio** di un altro requisito, con le seguenti implicazioni:
- **Dipendenze temporali**: requisiti figlio concatenati prolungano i tempi di implementazione
- **Visualizzazione gerarchica**: treemap e liste devono mostrare la struttura padre-figlio
- **Calcolo aggregato**: i giorni stimati devono considerare le dipendenze

### Complessità Stimata
- **Impatto Database**: MEDIO (nuova colonna + trigger)
- **Impatto Logica Calcolo**: ALTO (ricalcolo aggregati ricorsivi)
- **Impatto UI**: MEDIO-ALTO (visualizzazione gerarchica + gestione cicli)
- **Stima Totale**: **15-20 giorni** per implementazione completa

---

## 🗄️ ANALISI DATABASE

### Schema Attuale - `app_5939507989_requirements`

```sql
CREATE TABLE app_5939507989_requirements (
  req_id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('High', 'Med', 'Low')),
  state TEXT CHECK (state IN ('Proposed', 'Selected', 'Scheduled', 'Done')),
  business_owner TEXT NOT NULL,
  labels TEXT,
  created_on TIMESTAMPTZ DEFAULT NOW(),
  last_estimated_on TIMESTAMPTZ,
  estimator TEXT,
  -- Default tracking fields...
  priority_default_source TEXT,
  priority_is_overridden BOOLEAN DEFAULT FALSE,
  -- ... altri campi default tracking
);
```

### Modifiche Necessarie

#### 1. Nuova Colonna per Gerarchia

```sql
-- Migration 005_add_requirement_hierarchy.sql
ALTER TABLE app_5939507989_requirements 
ADD COLUMN parent_req_id TEXT,
ADD COLUMN hierarchy_level INTEGER DEFAULT 0,
ADD COLUMN dependency_type TEXT DEFAULT 'sequential' 
  CHECK (dependency_type IN ('sequential', 'parallel', 'blocking'));

-- Foreign key auto-referenziale
ALTER TABLE app_5939507989_requirements
ADD CONSTRAINT fk_requirements_parent
FOREIGN KEY (parent_req_id) REFERENCES app_5939507989_requirements(req_id)
ON DELETE SET NULL;

-- Indici per performance
CREATE INDEX idx_requirements_parent ON app_5939507989_requirements(parent_req_id);
CREATE INDEX idx_requirements_hierarchy ON app_5939507989_requirements(list_id, hierarchy_level);

-- Commenti
COMMENT ON COLUMN app_5939507989_requirements.parent_req_id IS 
  'Parent requirement ID for hierarchical dependencies';
COMMENT ON COLUMN app_5939507989_requirements.hierarchy_level IS 
  'Depth in hierarchy tree (0=root, 1=child, 2=grandchild, etc.)';
COMMENT ON COLUMN app_5939507989_requirements.dependency_type IS 
  'Sequential: parent must complete first | Parallel: can run together | Blocking: strict dependency';
```

#### 2. Validazioni e Constraint

```sql
-- Trigger per prevenire cicli
CREATE OR REPLACE FUNCTION prevent_requirement_cycles()
RETURNS TRIGGER AS $$
DECLARE
  current_id TEXT;
  visited_ids TEXT[];
  max_depth INTEGER := 10;
  depth INTEGER := 0;
BEGIN
  -- Se non c'è parent, OK
  IF NEW.parent_req_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Self-reference check
  IF NEW.parent_req_id = NEW.req_id THEN
    RAISE EXCEPTION 'Un requisito non può essere padre di se stesso';
  END IF;

  -- Check parent exists and is in same list
  IF NOT EXISTS (
    SELECT 1 FROM app_5939507989_requirements 
    WHERE req_id = NEW.parent_req_id AND list_id = NEW.list_id
  ) THEN
    RAISE EXCEPTION 'Parent requirement deve esistere nella stessa lista';
  END IF;

  -- Cycle detection: walk up the tree
  current_id := NEW.parent_req_id;
  visited_ids := ARRAY[NEW.req_id];
  
  WHILE current_id IS NOT NULL AND depth < max_depth LOOP
    -- Check cycle
    IF current_id = ANY(visited_ids) THEN
      RAISE EXCEPTION 'Ciclo rilevato nella gerarchia: % -> %', 
        array_to_string(visited_ids, ' -> '), current_id;
    END IF;
    
    visited_ids := visited_ids || current_id;
    depth := depth + 1;
    
    -- Get next parent
    SELECT parent_req_id INTO current_id
    FROM app_5939507989_requirements
    WHERE req_id = current_id;
  END LOOP;

  -- Update hierarchy level
  IF NEW.parent_req_id IS NOT NULL THEN
    SELECT COALESCE(hierarchy_level, 0) + 1 INTO NEW.hierarchy_level
    FROM app_5939507989_requirements
    WHERE req_id = NEW.parent_req_id;
  ELSE
    NEW.hierarchy_level := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_requirement_cycles
  BEFORE INSERT OR UPDATE OF parent_req_id ON app_5939507989_requirements
  FOR EACH ROW
  EXECUTE FUNCTION prevent_requirement_cycles();
```

#### 3. Funzione Ricorsiva per Aggregati

```sql
-- CTE ricorsiva per calcolo effort totale di un albero
CREATE OR REPLACE FUNCTION calculate_tree_effort(root_req_id TEXT)
RETURNS TABLE(
  req_id TEXT,
  direct_effort NUMERIC,
  children_effort NUMERIC,
  total_effort NUMERIC,
  depth INTEGER,
  path TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE req_tree AS (
    -- Base: root requirement
    SELECT 
      r.req_id,
      COALESCE(e.total_days, 0) as direct_effort,
      0::NUMERIC as children_effort,
      COALESCE(e.total_days, 0) as total_effort,
      0 as depth,
      r.title::TEXT as path
    FROM app_5939507989_requirements r
    LEFT JOIN LATERAL (
      SELECT total_days 
      FROM app_5939507989_estimates 
      WHERE req_id = r.req_id 
      ORDER BY created_on DESC 
      LIMIT 1
    ) e ON TRUE
    WHERE r.req_id = root_req_id

    UNION ALL

    -- Recursive: children
    SELECT 
      r.req_id,
      COALESCE(e.total_days, 0),
      0::NUMERIC,
      COALESCE(e.total_days, 0),
      rt.depth + 1,
      rt.path || ' > ' || r.title
    FROM app_5939507989_requirements r
    INNER JOIN req_tree rt ON r.parent_req_id = rt.req_id
    LEFT JOIN LATERAL (
      SELECT total_days 
      FROM app_5939507989_estimates 
      WHERE req_id = r.req_id 
      ORDER BY created_on DESC 
      LIMIT 1
    ) e ON TRUE
  )
  SELECT * FROM req_tree;
END;
$$ LANGUAGE plpgsql;
```

---

## 🧮 ANALISI IMPATTO CALCOLI

### Logica Attuale - `calculations.ts`

```typescript
// calculateDashboardKPIs: somma semplice dei total_days
acc.totalDays += estimationDays; // ❌ Non considera gerarchia

// prepareRequirementsWithEstimates: mapping 1:1
const estimationDays = estimate?.total_days || 0; // ❌ Solo effort diretto
```

### Nuova Logica Necessaria

#### 1. Calcolo Effort Gerarchico

```typescript
/**
 * Calcola l'effort totale di un requisito includendo tutti i figli.
 * 
 * Strategia:
 * - Sequential: effort = direct + SUM(children)
 * - Parallel: effort = direct + MAX(children)
 * - Blocking: effort = direct + critical_path(children)
 */
export interface HierarchicalEffort {
  reqId: string;
  directDays: number;
  childrenDays: number;
  totalDays: number;
  children: HierarchicalEffort[];
  dependencyType: 'sequential' | 'parallel' | 'blocking';
}

export function calculateHierarchicalEffort(
  requirement: Requirement,
  allRequirements: Requirement[],
  estimatesMap: Map<string, number>
): HierarchicalEffort {
  const directDays = estimatesMap.get(requirement.req_id) || 0;
  
  // Trova tutti i figli diretti
  const children = allRequirements.filter(r => r.parent_req_id === requirement.req_id);
  
  if (children.length === 0) {
    return {
      reqId: requirement.req_id,
      directDays,
      childrenDays: 0,
      totalDays: directDays,
      children: [],
      dependencyType: requirement.dependency_type || 'sequential'
    };
  }

  // Calcolo ricorsivo per ogni figlio
  const childrenEfforts = children.map(child => 
    calculateHierarchicalEffort(child, allRequirements, estimatesMap)
  );

  // Aggregazione basata su dependency_type
  let childrenDays = 0;
  switch (requirement.dependency_type) {
    case 'sequential':
      // Somma tutti i figli (uno dopo l'altro)
      childrenDays = childrenEfforts.reduce((sum, child) => sum + child.totalDays, 0);
      break;
    
    case 'parallel':
      // Prende il MAX (i figli si fanno in parallelo)
      childrenDays = Math.max(...childrenEfforts.map(c => c.totalDays), 0);
      break;
    
    case 'blocking':
      // Critical path: percorso più lungo
      childrenDays = calculateCriticalPath(childrenEfforts);
      break;
  }

  return {
    reqId: requirement.req_id,
    directDays,
    childrenDays,
    totalDays: directDays + childrenDays,
    children: childrenEfforts,
    dependencyType: requirement.dependency_type || 'sequential'
  };
}

function calculateCriticalPath(efforts: HierarchicalEffort[]): number {
  // Simplified critical path: assume sequential with max branch
  // Per implementazione completa serve dependency graph
  return efforts.reduce((max, effort) => Math.max(max, effort.totalDays), 0);
}
```

#### 2. Aggiornamento KPI Dashboard

```typescript
// Modificare calculateDashboardKPIs per considerare solo root requirements
export function calculateDashboardKPIs(
  requirements: Requirement[],
  estimatesMap: Map<string, number>
): DashboardKPI {
  // Filtra solo root requirements (parent_req_id = null)
  const rootRequirements = requirements.filter(r => !r.parent_req_id);
  
  // Calcola effort gerarchico per ogni root
  const hierarchicalEfforts = rootRequirements.map(req =>
    calculateHierarchicalEffort(req, requirements, estimatesMap)
  );

  // Aggrega usando totalDays (include figli)
  const totalDays = hierarchicalEfforts.reduce((sum, effort) => sum + effort.totalDays, 0);
  
  // ... resto della logica KPI
}
```

#### 3. Impatto su Projection Planning

```typescript
// calculateNeutralProjection deve considerare critical path
export function calculateNeutralProjection(
  hierarchicalEfforts: HierarchicalEffort[],
  nDevelopers: number,
  startDate: string,
  // ... altri parametri
): ProjectionResult {
  // Invece di dividere semplicemente totalDays / nDevelopers,
  // serve simulazione timeline con dependencies
  
  const timeline = buildTimeline(hierarchicalEfforts, nDevelopers);
  const endDate = calculateEndDate(timeline, startDate, excludeWeekends, holidays);
  
  return {
    endDate,
    totalWorkdays: timeline.length,
    // ... altri campi
  };
}
```

---

## 🎨 ANALISI IMPATTO UI

### 1. RequirementsList.tsx

#### Modifiche Necessarie

```typescript
// ✅ Aggiungere colonna Parent nella form
<div className="space-y-2">
  <Label htmlFor="parent">Requisito Padre (Opzionale)</Label>
  <Select
    value={formData.parent_req_id || ''}
    onValueChange={(value) => setFormData({ ...formData, parent_req_id: value || null })}
  >
    <SelectTrigger id="parent">
      <SelectValue placeholder="Nessun padre (requisito root)" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">Nessun padre</SelectItem>
      {availableParents.map(req => (
        <SelectItem key={req.req_id} value={req.req_id}>
          {req.title}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

// ✅ Aggiungere select per dependency type
<Select value={formData.dependency_type} onValueChange={...}>
  <SelectItem value="sequential">Sequenziale (uno dopo l'altro)</SelectItem>
  <SelectItem value="parallel">Parallelo (contemporanei)</SelectItem>
  <SelectItem value="blocking">Bloccante (critical path)</SelectItem>
</Select>
```

#### Visualizzazione Gerarchica

```typescript
// Opzione 1: Indentazione nel layout lista
const renderRequirementRow = (req: Requirement, level: number = 0) => {
  return (
    <div style={{ paddingLeft: `${level * 24}px` }} className="border-l-2 border-muted">
      <Card>
        {/* contenuto requirement */}
        {req.hierarchy_level > 0 && (
          <Badge variant="outline">
            <ArrowDownRight className="w-3 h-3 mr-1" />
            Figlio di {getParentTitle(req.parent_req_id)}
          </Badge>
        )}
      </Card>
    </div>
  );
};

// Opzione 2: Tree view collapsible
const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

const renderTreeNode = (req: Requirement) => {
  const children = requirements.filter(r => r.parent_req_id === req.req_id);
  const isExpanded = expandedNodes.has(req.req_id);
  
  return (
    <div className="ml-4 border-l pl-2">
      <div className="flex items-center gap-2">
        {children.length > 0 && (
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => toggleExpand(req.req_id)}
          >
            {isExpanded ? <ChevronDown /> : <ChevronRight />}
          </Button>
        )}
        <RequirementCard requirement={req} />
      </div>
      {isExpanded && children.map(child => renderTreeNode(child))}
    </div>
  );
};
```

### 2. TreemapApexRequirements.tsx

#### Modifiche per Visualizzazione Gerarchica

```typescript
// Opzione 1: Nested treemap (treemap dentro treemap)
const buildHierarchicalTreemapData = (requirements: Requirement[]) => {
  const roots = requirements.filter(r => !r.parent_req_id);
  
  return roots.map(root => {
    const rootEffort = calculateHierarchicalEffort(root, requirements, estimatesMap);
    
    return {
      x: root.title,
      y: rootEffort.totalDays, // Usa total, non solo direct
      children: rootEffort.children.map(child => ({
        x: child.reqId,
        y: child.totalDays,
        fillColor: getPriorityColor(child.priority, 0.7) // Più trasparente per figli
      }))
    };
  });
};

// Opzione 2: Connessioni visive con linee
// Usare ApexCharts annotations per disegnare frecce tra parent-child
const parentChildLinks = requirements
  .filter(r => r.parent_req_id)
  .map(child => {
    const parent = requirements.find(r => r.req_id === child.parent_req_id);
    return {
      type: 'line',
      x: parent.title,
      y: child.title,
      borderColor: '#6366f1',
      label: { text: child.dependency_type }
    };
  });
```

### 3. DashboardView.tsx

#### Aggiornamento KPI Card

```typescript
// ✅ Mostrare breakdown effort diretto vs figlio
<Card>
  <CardHeader>
    <CardTitle>Effort Breakdown</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      <div className="flex justify-between">
        <span>Effort Diretto:</span>
        <span className="font-bold">{kpis.directDays} gg</span>
      </div>
      <div className="flex justify-between">
        <span>Effort Dipendenze:</span>
        <span className="font-bold text-amber-600">{kpis.dependencyDays} gg</span>
      </div>
      <Separator />
      <div className="flex justify-between text-lg">
        <span>Totale Progetto:</span>
        <span className="font-bold">{kpis.totalDays} gg</span>
      </div>
    </div>
  </CardContent>
</Card>

// ✅ Dependency graph visualization
<Card>
  <CardHeader>
    <CardTitle>Dependency Graph</CardTitle>
  </CardHeader>
  <CardContent>
    <DependencyGraphVisualization 
      requirements={requirements}
      hierarchicalEfforts={hierarchicalEfforts}
    />
  </CardContent>
</Card>
```

---

## 🔧 MODIFICHE NECESSARIE - TypeScript Types

```typescript
// src/types.ts
export interface Requirement {
  req_id: string;
  list_id: string;
  title: string;
  description: string;
  priority: 'High' | 'Med' | 'Low';
  state: 'Proposed' | 'Selected' | 'Scheduled' | 'Done';
  business_owner: string;
  labels?: string;
  created_on: string;
  last_estimated_on?: string;
  estimator?: string;
  
  // ✅ NUOVI CAMPI GERARCHIA
  parent_req_id?: string | null;
  hierarchy_level?: number;
  dependency_type?: 'sequential' | 'parallel' | 'blocking';
  
  // ... existing default tracking fields
}

export interface HierarchicalEffort {
  reqId: string;
  directDays: number;
  childrenDays: number;
  totalDays: number;
  children: HierarchicalEffort[];
  dependencyType: 'sequential' | 'parallel' | 'blocking';
  path: string[]; // Breadcrumb path from root
}

export interface DashboardKPI {
  totalDays: number;
  avgDays: number;
  medianDays: number;
  p80Days: number;
  
  // ✅ NUOVI CAMPI
  directEffortDays: number; // Solo effort diretto (senza figli)
  dependencyEffortDays: number; // Effort aggiunto da dipendenze
  hierarchyDepth: number; // Max hierarchy level nel progetto
  
  difficultyMix: {
    low: number;
    medium: number;
    high: number;
  };
  // ... rest of existing fields
}
```

---

## 📦 MODIFICHE NECESSARIE - Storage Layer

```typescript
// src/lib/storage.ts

// ✅ Aggiornare getRequirements per includere hierarchy
export async function getRequirements(listId: string): Promise<Requirement[]> {
  return safeDbRead(async () => {
    const { data, error } = await supabase
      .from(TABLES.REQUIREMENTS)
      .select('*, parent:parent_req_id(req_id, title)') // Join opzionale per parent title
      .eq('list_id', listId)
      .order('hierarchy_level', { ascending: true }) // Root prima, poi figli
      .order('created_on', { ascending: false });

    if (error) throw error;
    return data || [];
  }, 'getRequirements', []);
}

// ✅ Nuova funzione per validazione parent
export async function validateParentRequirement(
  reqId: string, 
  parentReqId: string
): Promise<{ valid: boolean; error?: string }> {
  if (reqId === parentReqId) {
    return { valid: false, error: 'Un requisito non può essere padre di se stesso' };
  }

  // Check parent esiste e stessa lista
  const { data: parent } = await supabase
    .from(TABLES.REQUIREMENTS)
    .select('list_id')
    .eq('req_id', parentReqId)
    .single();

  if (!parent) {
    return { valid: false, error: 'Parent requirement non trovato' };
  }

  const { data: child } = await supabase
    .from(TABLES.REQUIREMENTS)
    .select('list_id')
    .eq('req_id', reqId)
    .single();

  if (parent.list_id !== child?.list_id) {
    return { valid: false, error: 'Parent e figlio devono essere nella stessa lista' };
  }

  // Cycle detection: walk up the tree (client-side)
  // Il trigger DB farà il check definitivo, questo è per UX
  return { valid: true };
}

// ✅ Funzione per ottenere albero completo
export async function getRequirementTree(listId: string): Promise<RequirementTree> {
  const requirements = await getRequirements(listId);
  const estimatesMap = await getLatestEstimatesMap(listId);
  
  const roots = requirements.filter(r => !r.parent_req_id);
  
  return roots.map(root => buildTreeNode(root, requirements, estimatesMap));
}

function buildTreeNode(
  requirement: Requirement,
  allRequirements: Requirement[],
  estimatesMap: Map<string, Estimate>
): RequirementTreeNode {
  const children = allRequirements.filter(r => r.parent_req_id === requirement.req_id);
  const estimate = estimatesMap.get(requirement.req_id);
  
  return {
    requirement,
    estimate,
    children: children.map(child => buildTreeNode(child, allRequirements, estimatesMap)),
    hierarchicalEffort: calculateHierarchicalEffort(requirement, allRequirements, estimatesMap)
  };
}
```

---

## 🚀 PIANO DI IMPLEMENTAZIONE

### FASE 1: Database Foundation (2-3 giorni)

**Obiettivo:** Setup schema e validazioni base

1. **Migration 005_add_requirement_hierarchy.sql**
   - [ ] Aggiungere colonne: `parent_req_id`, `hierarchy_level`, `dependency_type`
   - [ ] Creare FK auto-referenziale con ON DELETE SET NULL
   - [ ] Creare indici per performance
   - [ ] Testing migration su ambiente dev

2. **Trigger e Validazioni**
   - [ ] Implementare `prevent_requirement_cycles()` trigger
   - [ ] Testare cycle detection con casi complessi
   - [ ] Implementare funzione `calculate_tree_effort()` ricorsiva
   - [ ] Unit test SQL per validazioni

3. **Rollback Migration**
   - [ ] Creare `rollback_hierarchy.sql`
   - [ ] Testare rollback senza perdita dati

**Deliverable:** Database schema aggiornato con validazioni funzionanti

---

### FASE 2: TypeScript Types & Storage (2 giorni)

**Obiettivo:** Aggiornare type system e layer di storage

1. **Type Definitions**
   - [ ] Aggiornare `Requirement` interface in `types.ts`
   - [ ] Creare `HierarchicalEffort` interface
   - [ ] Aggiornare `DashboardKPI` con nuovi campi
   - [ ] Creare `RequirementTreeNode` type

2. **Storage Layer Updates**
   - [ ] Modificare `getRequirements()` per includere hierarchy fields
   - [ ] Implementare `validateParentRequirement()`
   - [ ] Implementare `getRequirementTree()`
   - [ ] Aggiornare `saveRequirement()` per gestire parent_req_id
   - [ ] Unit test per storage functions

**Deliverable:** Type-safe storage layer con supporto gerarchia

---

### FASE 3: Calculation Engine (3-4 giorni)

**Obiettivo:** Implementare logica calcolo gerarchico

1. **Core Calculations**
   - [ ] Implementare `calculateHierarchicalEffort()` con recursion
   - [ ] Implementare aggregazione per dependency_type (sequential, parallel, blocking)
   - [ ] Implementare `calculateCriticalPath()` per blocking dependencies
   - [ ] Unit test estensivi per tutti i casi edge

2. **Dashboard KPI Updates**
   - [ ] Refactoring `calculateDashboardKPIs()` per usare hierarchical efforts
   - [ ] Aggiungere calcolo `directEffortDays` vs `dependencyEffortDays`
   - [ ] Aggiornare projection functions (`calculateNeutralProjection`, etc.)
   - [ ] Testing con dataset realistici

3. **Performance Optimization**
   - [ ] Implementare caching per alberi requirement
   - [ ] Ottimizzare query ricorsive
   - [ ] Benchmarking con liste grandi (100+ requirements)

**Deliverable:** Engine di calcolo completo con supporto gerarchia

---

### FASE 4: UI Components - Form & Validation (2-3 giorni)

**Obiettivo:** Permettere editing relazioni padre-figlio

1. **RequirementsList Form Updates**
   - [ ] Aggiungere select per Parent Requirement
   - [ ] Filtrare parent disponibili (escludere self e potenziali cicli)
   - [ ] Aggiungere select per Dependency Type
   - [ ] Implementare validazione client-side per cicli
   - [ ] UX: mostrare warning se dependency crea catene lunghe

2. **Validation & Error Handling**
   - [ ] Integrare `validateParentRequirement()` nel form submit
   - [ ] Mostrare errori chiari per cicli rilevati
   - [ ] Toast notifications per successo/errore
   - [ ] Testing interattivo form

**Deliverable:** Form funzionante per creare/modificare gerarchie

---

### FASE 5: UI Components - Visualization (3-4 giorni)

**Obiettivo:** Visualizzare gerarchie in modo chiaro

1. **RequirementsList - Tree View**
   - [ ] Implementare rendering gerarchico con indentazione
   - [ ] Aggiungere badge per indicare parent-child relationship
   - [ ] Implementare collapsible tree con expand/collapse
   - [ ] Mostrare effort breakdown (diretto vs figli) in card
   - [ ] Breadcrumb path per navigazione gerarchica

2. **TreemapApexRequirements - Nested Visualization**
   - [ ] Implementare nested treemap per root + children
   - [ ] Differenziare visualmente root vs children (opacity, bordi)
   - [ ] Tooltip esteso con hierarchy info
   - [ ] Click su parent espande figli
   - [ ] Testing con diversi livelli di profondità

3. **DashboardView - Hierarchy Insights**
   - [ ] Card "Effort Breakdown" (diretto vs dipendenze)
   - [ ] Dependency Graph visualization (opzionale, libreria esterna)
   - [ ] KPI: profondità massima gerarchia
   - [ ] Alert per catene di dipendenze troppo lunghe

**Deliverable:** UI completa con visualizzazioni gerarchiche

---

### FASE 6: Testing & Polish (2-3 giorni)

**Obiettivo:** Validare tutto il flusso end-to-end

1. **Integration Testing**
   - [ ] Test E2E: crea lista → aggiungi requirements → crea gerarchia → visualizza
   - [ ] Test con gerarchie profonde (5+ livelli)
   - [ ] Test con dependency types diversi
   - [ ] Test prestazioni con liste grandi

2. **Edge Cases & Bug Fixing**
   - [ ] Gestione delete requirement con figli (SET NULL o cascade?)
   - [ ] Gestione move requirement tra liste (reset parent)
   - [ ] Gestione copy requirement (clone gerarchia?)
   - [ ] Testing con utenti reali

3. **Documentation**
   - [ ] Aggiornare README con nuova feature
   - [ ] Documentare formule calcolo gerarchico
   - [ ] Screenshot/video demo feature
   - [ ] Update migration README

**Deliverable:** Feature completamente testata e documentata

---

## ⚠️ RISCHI E MITIGAZIONI

### Rischio 1: Cicli Non Rilevati
**Probabilità:** Media  
**Impatto:** Alto (data corruption)  
**Mitigazione:**
- Trigger DB come ultima linea di difesa
- Validazione client-side preventiva
- Testing estensivo con cicli complessi

### Rischio 2: Performance con Gerarchie Profonde
**Probabilità:** Media  
**Impatto:** Medio (UX degradata)  
**Mitigazione:**
- Limitare profondità massima (es. 10 livelli)
- Caching aggressivo degli alberi
- Lazy loading dei children in UI

### Rischio 3: Complessità UX
**Probabilità:** Alta  
**Impatto:** Medio (adozione feature)  
**Mitigazione:**
- Mantenere UI semplice con defaults sensati
- Tutorial/onboarding per feature
- Dependency type "sequential" come default

### Rischio 4: Calcolo Effort Ambiguo
**Probabilità:** Media  
**Impatto:** Alto (stime sbagliate)  
**Mitigazione:**
- Documentazione chiara formule calcolo
- Tooltip esplicativi in UI
- Breakdown dettagliato effort in dashboard

---

## 📊 METRICHE DI SUCCESSO

### Metriche Tecniche
- [ ] Zero cicli rilevati in produzione
- [ ] Query gerarchiche < 100ms per liste fino a 100 req
- [ ] Code coverage > 80% per nuove funzioni
- [ ] Zero regression in funzionalità esistenti

### Metriche UX
- [ ] Tempo medio per creare gerarchia < 30 secondi
- [ ] 90% utenti comprendono dependency types senza aiuto
- [ ] Feedback positivo da beta testers
- [ ] Adozione feature > 50% degli utenti entro 1 mese

---

## 💡 ALTERNATIVE E TRADE-OFFS

### Alternativa 1: Solo Parent-Child Semplice
**Pro:** Implementazione più veloce (10 giorni)  
**Contro:** No dependency types, meno flessibilità  
**Decisione:** ❌ Non sufficiente per use case complessi

### Alternativa 2: Full Dependency Graph (DAG)
**Pro:** Massima flessibilità, multiple dependencies  
**Contro:** Complessità altissima (30+ giorni)  
**Decisione:** ❌ Over-engineering per MVP

### Alternativa 3: Parent-Child + Dependency Types ✅
**Pro:** Bilanciamento complessità/flessibilità  
**Contro:** 15-20 giorni implementazione  
**Decisione:** ✅ **CONSIGLIATO** - Sweet spot per MVP

---

## 🎯 RACCOMANDAZIONE FINALE

### Approccio Consigliato: **Implementazione Incrementale**

#### Sprint 1 (1 settimana): MVP Base
- Database schema (parent_req_id + hierarchy_level)
- Dependency type fissato a "sequential"
- Calcolo hierarchical effort base
- Form per selezionare parent
- Visualizzazione con indentazione semplice

**Valore:** Gerarchia funzionante end-to-end

#### Sprint 2 (1 settimana): Calcoli Avanzati
- Dependency types (sequential, parallel, blocking)
- Critical path calculation
- Dashboard KPI aggiornati
- Effort breakdown visualization

**Valore:** Calcoli precisi e dashboard insights

#### Sprint 3 (3-5 giorni): Polish UI
- Tree view collapsible
- Nested treemap
- Dependency graph (opzionale)
- Testing e bug fixing

**Valore:** UX professionale e feature completa

### Stima Totale: **15-20 giorni lavorativi**

---

## 📝 PROSSIMI PASSI

1. **Approvazione Stakeholder**
   - Review questo documento con team/product owner
   - Decisione su scope (MVP vs Full)
   - Allocazione risorse

2. **Setup Ambiente Dev**
   - Branch feature/requirement-hierarchy
   - Database test con dati realistici
   - CI/CD per testing automatico

3. **Kickoff FASE 1**
   - Creare migration 005
   - Implementare trigger cycle detection
   - Testing DB con casi edge

---

**Documento preparato da:** GitHub Copilot  
**Review richiesta a:** Team di sviluppo + Product Owner  
**Deadline decisione:** Da definire
