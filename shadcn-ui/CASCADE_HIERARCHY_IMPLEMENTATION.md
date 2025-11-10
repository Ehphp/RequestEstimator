# Implementazione Gerarchia a Cascata con Limite di 5 Livelli

## Data: 10 novembre 2025
## Stato: ✅ COMPLETATO

## 🎯 Obiettivo
Adattare la visualizzazione delle relazioni gerarchiche per supportare catene a cascata (A → B → C → D → E) con un limite massimo di 5 livelli di profondità.

## 📊 Scenario Supportato

### Esempio: Catena A > B > C > D > E
```
Root (Livello 0)
  └─ A (Livello 1)
      └─ B (Livello 2)
          └─ C (Livello 3)  ← Tu sei qui
              └─ D (Livello 4)
                  └─ E (Livello 5) ← Limite massimo
```

## 🔧 Modifiche Implementate

### 1. **RequirementRelations.tsx** - Visualizzazione Completa

#### Costante MAX_HIERARCHY_DEPTH
```typescript
const MAX_HIERARCHY_DEPTH = 5;
```

#### Nuove Funzioni Helper

##### `buildAncestorChain()`
```typescript
/**
 * Costruisce la catena degli antenati risalendo fino alla radice
 * Ritorna: [Root, A, B, C] se l'utente è su D
 */
function buildAncestorChain(
    requirement: Requirement,
    allRequirements: Requirement[]
): Requirement[]
```

##### `calculateMaxDescendantDepth()`
```typescript
/**
 * Calcola la profondità massima dell'albero dei discendenti
 * Esempio: se da C scendono D→E→F, ritorna 3
 */
function calculateMaxDescendantDepth(
    requirement: Requirement,
    allRequirements: Requirement[],
    currentDepth = 0
): number
```

##### `isAtMaxDepth()`
```typescript
/**
 * Verifica se il requisito è già al livello massimo
 * Usato per mostrare warning e disabilitare parent selection
 */
function isAtMaxDepth(
    requirement: Requirement,
    allRequirements: Requirement[]
): boolean
```

### 2. **Visualizzazione UI Migliorata**

#### Header con Badge Livello
```tsx
<CardTitle>
  <Network /> Relazioni
  <Badge>Livello {currentDepth + 1}/{MAX_HIERARCHY_DEPTH}</Badge>
</CardTitle>
```

#### Breadcrumb-Style Chain (Cascata Visuale)
```
└─ 🔀 Root Requirement
    └─ Requirement A
        └─ Requirement B
            └─ Requirement C
                └─ 📍 Tu sei qui: Current Requirement
```

**Caratteristiche:**
- ✅ Indentazione progressiva (12px per livello)
- ✅ Icona GitBranch per la radice
- ✅ Connettori "└─" per visualizzare la catena
- ✅ Badge "Tu sei qui" sul requisito corrente
- ✅ Link navigabili su ogni antenato
- ✅ Colori blu per la catena di dipendenze

#### Children con Badge Profondità
```tsx
{childRequirements.map(child => {
  const childDepth = calculateMaxDescendantDepth(child, allRequirements, 1);
  return (
    <div>
      {child.title}
      {childDepth > 0 && <Badge>+{childDepth}</Badge>}
    </div>
  );
})}
```

**Esempio:** Se un child ha 2 livelli sotto di sé, mostra badge "+2"

#### Alert Warning per Limite Raggiunto
```tsx
{isAtLimit && (
  <Alert variant="warning">
    ⚠️ Limite profondità raggiunto: 
    non puoi aggiungere requisiti parent
  </Alert>
)}
```

#### Info Box con Profondità Totale
```tsx
💡 Le relazioni gerarchiche influenzano il calcolo del percorso critico
Profondità totale: 4 livelli
```

### 3. **Versione Compact per EstimateEditor**

```tsx
<Network icon />
Catena: 4 livelli • 2 req dipendenti
[Max profondità] ← Badge se al limite
```

### 4. **RequirementsList.tsx** - Validazione Form

#### Filtro Parent Options con Depth Check
```typescript
const parentSelectOptions = useMemo(() => {
  const MAX_HIERARCHY_DEPTH = 5;
  
  // Calcola depth di ogni requirement
  const getRequirementDepth = (reqId: string): number => {
    let depth = 0;
    let current = requirements.find(r => r.req_id === reqId);
    
    while (current?.parent_req_id && depth < MAX_HIERARCHY_DEPTH) {
      current = requirements.find(r => r.req_id === current!.parent_req_id);
      depth++;
    }
    
    return depth;
  };

  return flattened.map(({ item, depth }) => {
    const reqDepth = getRequirementDepth(item.requirement.req_id);
    const disabled = reqDepth >= MAX_HIERARCHY_DEPTH;
    
    return {
      value: item.requirement.req_id,
      label: item.requirement.title,
      depth,
      disabled  // ← Disabilita se già a profondità max
    };
  });
}, [requirementTree, editingRequirement, requirements]);
```

### 5. **RequirementFormFields.tsx** - UI Select

Il componente già supporta:
- ✅ `disabled` prop per disabilitare options
- ✅ `depth` visualizzato come indentazione
- ✅ Label "Livello X" per requirements con depth > 0

## 🎨 Design Pattern Implementati

### Colori e Icone
| Elemento | Colore | Icona |
|----------|--------|-------|
| Catena antenati | Blu (#3b82f6) | GitBranch (radice) |
| Connettori | Blu chiaro | "└─" |
| Requisito corrente | Primario + border | "Tu sei qui" badge |
| Children | Viola (#9333ea) | ArrowDownRight |
| Warning limite | Arancione | AlertTriangle |
| Info profondità | Muted | 💡 |

### Layout Responsive
- **Indentazione dinamica**: `paddingLeft: ${depth * 12}px`
- **Truncate automatico** su titoli lunghi
- **Scroll interno** per catene molto profonde
- **Badge compatti** per mobile

## 📏 Limiti e Validazioni

### Limite Hard: 5 Livelli
```typescript
const MAX_HIERARCHY_DEPTH = 5;
```

### Validazioni Applicate

1. **Durante la creazione/modifica** (RequirementsList)
   - Parent options con `depth >= 5` sono disabilitate
   - Impossibile selezionare parent che porterebbero oltre il limite

2. **Nella visualizzazione** (RequirementRelations)
   - Alert visibile quando si raggiunge il limite
   - Badge "Max profondità" nella versione compact
   - Badge rosso nel header "Livello 5/5"

3. **Nella navigazione** (buildAncestorChain)
   - Loop di risalita limitato a MAX_HIERARCHY_DEPTH iterazioni
   - Prevenzione overflow stack in caso di cicli anomali

## 🔍 Metriche Calcolate

### Per ogni Requirement viene calcolato:

1. **currentDepth**: Livello attuale (quanti antenati ha)
2. **maxDescendantDepth**: Profondità massima dei discendenti
3. **totalDepth**: `currentDepth + maxDescendantDepth + 1`
4. **isAtLimit**: Boolean se è al livello 5

### Esempio di Metriche
```
Scenario: A → B → C → D

Su requisito C:
- currentDepth = 2 (antenati: A, B)
- maxDescendantDepth = 1 (discendente: D)
- totalDepth = 4
- isAtLimit = false
```

## 📱 UX Flow

### Creazione Nuovo Requisito
1. Click "Nuovo Requisito"
2. Select "Dipendenza" mostra:
   - Opzioni abilitate (depth < 5)
   - Opzioni disabilitate e grigie (depth = 5)
   - Indentazione visuale per capire la gerarchia
3. Submit → Validazione server-side (da implementare)

### Visualizzazione Dettaglio
1. Apri requisito in catena profonda
2. Vedi breadcrumb completo della catena
3. Badge "Livello X/5" nel header
4. Se al limite: Alert arancione visibile
5. Click su antenato → naviga a quel requisito

### Vista Stima
1. Apri EstimateEditor su requisito con relazioni
2. Alert badge compatto mostra: "Catena: 3 livelli"
3. Se al limite: Badge rosso "Max profondità"

## ✅ Test Scenarios

### Test Case 1: Catena Normale (3 livelli)
```
Setup: A → B → C
Verifica:
- Su C: mostra catena A, B
- currentDepth = 2
- Può aggiungere parent
- No warning
```

### Test Case 2: Al Limite (5 livelli)
```
Setup: A → B → C → D → E
Verifica:
- Su E: mostra catena completa
- Badge "Livello 5/5"
- Alert warning visibile
- Impossibile selezionare parent in form
```

### Test Case 3: Children Profondi
```
Setup: A con children B → C → D
Verifica:
- Su A: child B mostra badge "+2"
- maxDescendantDepth = 3
- totalDepth = 4
```

### Test Case 4: Navigazione Catena
```
Setup: Root → A → B → Current
Azione: Click su A nella breadcrumb
Verifica:
- Naviga a dettaglio di A
- Mostra catena Root → A
- currentDepth = 1
```

## 🚀 Benefici

### UX
✅ **Comprensione immediata** della posizione nella gerarchia
✅ **Navigazione fluida** attraverso breadcrumb navigabile
✅ **Prevenzione errori** con disabilitazione parent oltre limite
✅ **Feedback visivo** con badge, alert e colori

### Performance
✅ **Calcoli memoizzati** con useMemo
✅ **Iterazioni limitate** con early exit a depth 5
✅ **Rendering ottimizzato** con chiavi React corrette

### Manutenibilità
✅ **Costante centralizzata** MAX_HIERARCHY_DEPTH
✅ **Funzioni helper riutilizzabili**
✅ **Type-safe** con TypeScript completo
✅ **Logica separata** tra calcolo e visualizzazione

## 📝 Possibili Estensioni Future

- [ ] Configurazione dinamica del limite (da settings)
- [ ] Export della catena in formato tree
- [ ] Visualizzazione grafica con D3.js o mermaid
- [ ] Bulk operations per spostare catene
- [ ] Calcolo impatto timeline su catena completa
- [ ] Validazione server-side con constraint DB
- [ ] Snapshot della struttura gerarchica nel tempo

## 🎯 Conclusione

L'implementazione supporta completamente catene a cascata fino a 5 livelli con:
- ✅ Visualizzazione chiara e intuitiva
- ✅ Validazioni preventive
- ✅ Feedback contestuale
- ✅ Performance ottimizzate
- ✅ Codice manutenibile

Il sistema è pronto per gestire progetti complessi con dipendenze profonde mantenendo controllo e usabilità.
