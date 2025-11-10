# Fix: Gestione Corretta Modifica vs Nuova Stima

## Problema Risolto
Il sistema non gestiva correttamente la distinzione tra:
- **"Modifica"**: aprire l'editor con i dati di una stima esistente precaricati
- **"Nuova Stima"**: aprire l'editor con un form completamente vuoto (o con defaults)

## Modifiche Apportate

### 1. RequirementDetailView.tsx
**Problema**: Il button "Crea Stima" (quando non ci sono stime) chiamava direttamente `setEditMode(true)` senza passare attraverso `openEstimateEditor(null)`.

**Fix**: 
```tsx
// Prima (ERRATO)
<Button onClick={() => setEditMode(true)} size="sm">
    Crea Stima
</Button>

// Dopo (CORRETTO)
<Button onClick={() => openEstimateEditor(null)} size="sm">
    Crea Stima
</Button>
```

### 2. EstimateEditor.tsx
**Problema**: L'useEffect che inizializzava i dati dipendeva da `selectedEstimate?.estimate_id`, il che poteva causare problemi quando si passava da una stima esistente a `null`.

**Fix**:
1. Cambiata la dipendenza da `selectedEstimate?.estimate_id` a `selectedEstimate` per triggherare sempre quando cambia
2. Aggiunto reset esplicito di tutti i campi quando `selectedEstimate` è `null` e non c'è un utente corrente
3. Aggiunto log esplicito: `'Loading defaults for new estimate'`

```tsx
// Dipendenze useEffect
// Prima
[selectedEstimate?.estimate_id, ...]

// Dopo  
[selectedEstimate, ...]
```

## Comportamento Attuale

### Scenario 1: Click su "Modifica"
1. Viene chiamato `openEstimateEditor(latestEstimate)` o `openEstimateEditor(viewingEstimate)`
2. `EstimateEditor` riceve `selectedEstimate` con tutti i dati
3. L'useEffect carica tutti i campi dalla stima esistente:
   - Scenario, Complexity, Environments, Reuse, Stakeholders
   - Attività selezionate e opzionali
   - Rischi selezionati
   - Flag include_optional
4. Tutti i campi sono marcati come "overridden" (nessun default applicato)

### Scenario 2: Click su "Nuova Stima"
1. Viene chiamato `openEstimateEditor(null)`
2. `EstimateEditor` riceve `selectedEstimate = null`
3. L'useEffect:
   - Se c'è un utente: carica i defaults dal sistema
   - Se NON c'è un utente: resetta tutti i campi a valori vuoti
4. I campi mostrano le pillole dei defaults (se applicabili)

### Scenario 3: Tornare Indietro
1. Viene chiamato `onBack()` che esegue:
   ```tsx
   setEditMode(false);
   setSelectedEstimate(null);  // Reset dello stato
   loadEstimates();  // Ricarica le stime
   ```
2. Lo stato viene completamente resettato per la prossima apertura

## Testing
Per testare il comportamento:
1. Apri un requisito che ha già delle stime
2. Clicca "Modifica" → verifica che i campi siano precompilati
3. Torna indietro
4. Clicca "Nuova Stima" → verifica che i campi siano vuoti (o con defaults)
5. Torna indietro
6. Ripeti i passi 2-5 per verificare che non ci siano problemi di "sticky state"

## Logs Aggiunti
Per debugging, sono stati aggiunti log specifici:
- `'Loading selected estimate data:'` quando si carica una stima esistente
- `'Loading defaults for new estimate'` quando si crea una nuova stima

Controllare la console del browser per verificare quale path viene eseguito.

## File Modificati
- `src/components/RequirementDetailView.tsx` - Fix button "Crea Stima"
- `src/components/EstimateEditor.tsx` - Migliorato useEffect per reset corretto

## Data
10 Novembre 2025
