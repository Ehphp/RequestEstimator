# Fix: Modifica Stima - Caricamento Dati e Calcolo Automatico

## Problemi Risolti

### 1. Pagina di modifica vuota
**Problema**: Quando si cliccava su "Modifica" per una stima esistente, il form era vuoto come se si stesse creando una nuova stima.

**Causa**: Il flag `autoCalcReady` non veniva impostato a `true` dopo il caricamento dei dati della stima selezionata, impedendo il calcolo automatico e rendendo il form non reattivo.

**Soluzione**: Aggiunto `setAutoCalcReady(true)` nel blocco che carica i dati della stima esistente in `EstimateEditor.tsx`:

```typescript
if (selectedEstimate) {
  // ... caricamento dati ...
  
  // CRITICAL: Enable auto-calc after loading estimate data
  if (isMounted) {
    logger.info('Enabling auto-calc for loaded estimate');
    setAutoCalcReady(true);
  }
}
```

### 2. Calcolo automatico non funzionante
**Problema**: Il calcolo automatico della stima non si attivava, anche con tutti i campi compilati.

**Causa**: Collegato al problema precedente - `autoCalcReady` non veniva impostato correttamente.

**Soluzione**: Riorganizzato il flusso di inizializzazione per garantire che `autoCalcReady` venga sempre impostato sia per nuove stime che per modifiche:
- Quando si carica una stima esistente → imposta `autoCalcReady` dopo il caricamento
- Quando si crea una nuova stima → imposta `autoCalcReady` dopo l'applicazione dei defaults

### 3. Gestione user authentication
**Problema**: Il codice bloccava il caricamento se non c'era un utente autenticato.

**Soluzione**: Migliorata la logica per permettere la visualizzazione/modifica anche senza autenticazione, mantenendo il sistema dei defaults solo quando l'utente è autenticato.

## File Modificati

### `src/components/EstimateEditor.tsx`
- Riorganizzato il `useEffect` di inizializzazione
- Aggiunto `setAutoCalcReady(true)` per stime esistenti
- Migliorata gestione autenticazione
- Aggiunti log di debug per tracciare il flusso

### `src/components/RequirementDetailView.tsx`
- Aggiunto log di debug in `openEstimateEditor` per tracciare quale stima viene aperta

## Come Testare

### Test 1: Modifica Stima Esistente
1. Apri l'applicazione su http://localhost:5175
2. Apri la console del browser (F12)
3. Seleziona una lista con requisiti che hanno stime
4. Clicca su un requisito per aprire la vista dettaglio
5. Clicca sul pulsante "Modifica" nella card "Stima Corrente"

**Risultati attesi**:
- Il form si apre popolato con tutti i dati della stima:
  - Scenario (es. "A")
  - Complessità (es. "Low (x0.8)")
  - Ambienti (es. "1 env (x0.7)")
  - Riutilizzo (es. "Low (x1.4)")
  - Stakeholder (es. "1 team (x0.8)")
  - Attività selezionate con checkbox attivi
  - Rischi selezionati
- Il riepilogo mostra automaticamente il calcolo:
  - Totale giorni
  - Subtotal
  - Contingenza
  - Risk score

**Log da verificare nella console**:
```
Opening estimate editor: { hasEstimate: true, estimateId: "EST-...", scenario: "A", ... }
EstimateEditor mounted/updated: { hasSelectedEstimate: true, ... }
Loading selected estimate data: { estimate_id: "EST-..." }
Enabling auto-calc for loaded estimate
EstimateEditor state: { scenario: "A", complexity: "Low (x0.8)", ... autoCalcReady: true }
```

### Test 2: Calcolo Automatico Reattivo
1. Con una stima aperta in modifica
2. Cambia un valore (es. complessità da "Low" a "Medium")

**Risultati attesi**:
- Il riepilogo si aggiorna automaticamente in tempo reale
- I valori di subtotal, contingenza e totale cambiano immediatamente

### Test 3: Nuova Stima (Regressione)
1. Nella vista dettaglio del requisito
2. Clicca su "Nuova Stima"

**Risultati attesi**:
- Il form si apre con i defaults intelligenti (se utente autenticato)
- Il form è vuoto ma funzionale (se non autenticato)
- Il calcolo automatico si attiva quando tutti i campi necessari sono compilati

## Log di Debug

I log aggiunti aiutano a tracciare il flusso completo:

1. **Mount/Update**: Quando il componente si monta o aggiorna
2. **Opening editor**: Quando viene richiesta l'apertura dell'editor
3. **Loading estimate**: Quando i dati della stima vengono caricati
4. **State changes**: Quando cambiano i valori dello stato

Questi log sono utili per debugging futuro e possono essere rimossi o ridotti una volta confermata la stabilità.

## Impatto

- ✅ Risolve completamente il problema della pagina vuota in modifica
- ✅ Risolve il calcolo automatico che non si attivava
- ✅ Mantiene la retrocompatibilità con il flusso di creazione nuova stima
- ✅ Nessun cambiamento breaking per altre funzionalità
- ✅ Miglior gestione dell'autenticazione

## Note Tecniche

### Il ruolo di `autoCalcReady`
Questo flag è critico perché:
1. Previene calcoli durante il caricamento iniziale dei dati
2. Evita loop infiniti di ricalcolo
3. Garantisce che tutti i dati siano caricati prima del primo calcolo
4. Deve essere impostato a `true` DOPO che tutti i dati sono stati caricati nello stato

### Timing dell'inizializzazione
Il `useEffect` di inizializzazione dipende da:
- `selectedEstimate?.estimate_id` - per reagire al cambio di stima
- `requirement.req_id` - per gestire il cambio di requisito
- `list` - per i defaults dipendenti dalla lista
- `currentUser` - per i defaults dipendenti dall'utente

Quando qualsiasi di questi cambia, l'effetto si ri-esegue completamente.
