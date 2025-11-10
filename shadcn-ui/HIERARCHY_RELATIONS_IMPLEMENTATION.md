# Analisi e Implementazione Sistema di Relazioni tra Requisiti

## Data: 10 novembre 2025

## 📋 Analisi del Sistema di Ereditarietà

### 1. Struttura Dati

#### Campo Chiave: `parent_req_id`
```typescript
// types.ts - Requirement interface
export interface Requirement {
  req_id: string;
  list_id: string;
  parent_req_id?: string | null;  // 👈 Campo che gestisce la gerarchia
  title: string;
  // ... altri campi
}
```

### 2. Funzionalità Implementate

#### 2.1 Libreria Hierarchy (`src/lib/requirementsHierarchy.ts`)
Sistema completo per gestire alberi gerarchici di requisiti:

- **`buildRequirementTree<T>`**: Costruisce forest (collezione di alberi) da lista piatta
- **`sortRequirementTree<T>`**: Ordina l'albero in-place per livello
- **`flattenRequirementTree<T>`**: Produce lista piatta preservando ordine e profondità
- **`getDescendantIds<T>`**: Ritorna tutti i discendenti di un nodo
- **`getAncestorIds<T>`**: Ritorna la catena di antenati fino alla radice
- **`wouldCreateCycle<T>`**: Verifica se assegnare un parent creerebbe cicli
- **`calculateCriticalPathLength<T>`**: Calcola percorso critico (catena più lunga)

#### 2.2 Utilizzo in RequirementsList
```typescript
// Costruzione dell'albero
const requirementTree = buildRequirementTree(requirementWithMeta, {
  getId: (item) => item.requirement.req_id,
  getParentId: (item) => item.requirement.parent_req_id ?? null
});

// Conteggio figli per requirement
const childCountByParent = new Map<string, number>();
requirementWithMeta.forEach((item) => {
  if (requirement.parent_req_id) {
    childCountByParent.set(
      requirement.parent_req_id,
      (counts.get(requirement.parent_req_id) ?? 0) + 1
    );
  }
});
```

#### 2.3 UI nell'Editor di Requisiti
```typescript
// RequirementFormFields.tsx - Selezione del parent
<Select
  value={formData.parent_req_id ?? '__none'}
  onValueChange={(value) =>
    handleFieldChange('parent_req_id')(value === '__none' ? null : value)
  }
>
  <SelectItem value="__none">Nessuno (radice)</SelectItem>
  {potentialParents.map(req => (
    <SelectItem key={req.req_id} value={req.req_id}>
      {req.title}
    </SelectItem>
  ))}
</Select>
```

#### 2.4 Calcolo Percorso Critico
```typescript
// calculations.ts
export function calculateRequirementCriticalPath(
  requirementsWithEstimates: RequirementWithEstimate[]
): number {
  const tree = buildRequirementTree(requirementsWithEstimates, {
    getId: (item) => item.requirement.req_id,
    getParentId: (item) => item.requirement.parent_req_id ?? null
  });

  return calculateCriticalPathLength(tree, (item) => item.estimationDays);
}
```

### 3. Punti di Integrazione Mancanti

#### ❌ RequirementDetailView
- **Problema**: Non visualizza relazioni parent/children
- **Mancanza**: Nessun componente per mostrare la gerarchia
- **Necessità**: Aggiungere sezione dedicata alle relazioni

#### ❌ EstimateEditor
- **Problema**: Non avvisa l'utente delle dipendenze
- **Mancanza**: Nessun badge/alert che indichi relazioni attive
- **Necessità**: Alert badge visibile durante la stima

## 🎨 Soluzione Implementata

### 1. Nuovo Componente: `RequirementRelations.tsx`

```typescript
interface RequirementRelationsProps {
  currentRequirement: Requirement;
  allRequirements: Requirement[];
  onNavigate: (reqId: string) => void;
  compact?: boolean;  // Per versione ridotta in EstimateEditor
}
```

#### Caratteristiche:
- ✅ Visualizza requirement parent (se presente)
- ✅ Lista tutti i children requirements
- ✅ Link navigabili per esplorare relazioni
- ✅ Conteggio rapido delle dipendenze
- ✅ Icone intuitive (ArrowUpRight per parent, ArrowDownRight per children)
- ✅ Colori distintivi (blu per parent, viola per children)
- ✅ Versione compact per badge in EstimateEditor

### 2. Integrazione in RequirementDetailView

#### Posizione: Colonna 2 (Dettagli Requisito)
Inserito dopo la sezione "Etichette", prima della fine di CardContent:

```tsx
{/* Relations Section */}
<RequirementRelations
  currentRequirement={requirement}
  allRequirements={allRequirements}
  onNavigate={handleNavigateToRequirement}
/>
```

#### Modifiche necessarie:
1. Import di `getRequirementsByListId` da storage
2. Stato aggiuntivo: `allRequirements`
3. Funzione `loadAllRequirements()` in useEffect
4. Handler `handleNavigateToRequirement` con callback
5. Props aggiuntiva: `onNavigateToRequirement?: (reqId: string) => void`

### 3. Integrazione in EstimateEditor

#### Posizione: Header, vicino al titolo requirement
Badge Alert compatto che mostra:
- "Dipende da 1 req" se ha parent
- "N req dipendenti" se ha children
- Icona Network per identificazione immediata

```tsx
<Alert variant="info" className="border-blue-200 bg-blue-50">
  <RequirementRelations
    currentRequirement={requirement}
    allRequirements={allRequirements}
    compact={true}
  />
</Alert>
```

## 🔄 Modifiche Necessarie a Index.tsx

Per supportare la navigazione tra requisiti correlati:

```typescript
const handleNavigateToRequirement = (reqId: string) => {
  const req = requirements.find(r => r.req_id === reqId);
  if (req) {
    setSelectedRequirement(req);
    updateSearchParams((params) => {
      params.set('reqId', reqId);
    });
  }
};

// Passaggio al RequirementDetailView
<RequirementDetailView
  requirement={selectedRequirement}
  list={selectedList}
  onBack={() => ...}
  onNavigateToRequirement={handleNavigateToRequirement}
/>
```

## 📊 Benefici dell'Implementazione

### UX/UI
✅ **Visibilità**: Le relazioni sono immediatamente visibili
✅ **Navigazione**: Link diretti tra requisiti correlati
✅ **Contesto**: L'utente capisce le dipendenze durante la stima
✅ **Percorso critico**: Consapevolezza dell'impatto sulla timeline

### Tecnici
✅ **Riusabilità**: Componente unico per entrambi i contesti
✅ **Manutenibilità**: Logica centralizzata in RequirementRelations
✅ **Performance**: Caricamento requirements solo quando necessario
✅ **Scalabilità**: Supporta gerarchie profonde e complesse

## 🎯 Punti di Attenzione

1. **Performance**: Con liste molto grandi, considerare lazy loading dei requirements
2. **Cicli**: La validazione anti-ciclo è implementata in wouldCreateCycle ma non esposta in UI
3. **Profondità**: Attualmente nessun limite alla profondità dell'albero
4. **Breadcrumb**: Potrebbe essere utile mostrare il percorso completo dell'antenato

## 📝 Prossimi Sviluppi Possibili

- [ ] Visualizzazione grafica dell'albero (tree view completo)
- [ ] Drag & drop per riorganizzare gerarchie
- [ ] Indicatori visivi del percorso critico
- [ ] Export della struttura gerarchica
- [ ] Gantt chart basato su parent_req_id
- [ ] Validazione automatica di cicli in UI
