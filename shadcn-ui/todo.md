# Sistema Gestione Liste di Requisiti Stimati - TODO

## Struttura MVP
1. **src/types/index.ts** - Definizioni TypeScript per tutti i modelli dati
2. **src/data/catalog.ts** - Catalogo attività con helper, driver, rischi
3. **src/lib/calculations.ts** - Logica di calcolo deterministico
4. **src/lib/storage.ts** - Gestione localStorage
5. **src/components/ListsView.tsx** - Vista principale liste con KPI
6. **src/components/RequirementsView.tsx** - Vista requisiti per lista
7. **src/components/EstimateEditor.tsx** - Editor stima con pannelli
8. **src/components/ExportDialog.tsx** - Dialog export CSV
9. **src/pages/Index.tsx** - Homepage con routing interno

## Funzionalità Core
- ✅ Modello dati completo (Lists, Requirements, Estimates, Activities)
- ✅ Sistema calcolo deterministico con moltiplicatori
- ✅ Catalogo attività con helper short/long
- ✅ UI con pannelli driver/attività/rischi/contingenza
- ✅ Export CSV semplice
- ✅ Validazioni e tooltip helper
- ✅ Gestione stato con localStorage

## Relazioni
- Lists 1:N Requirements
- Requirements 1:N Estimates (storico)
- Activities con helper integrati
- Driver/Risks/Contingency per calcoli