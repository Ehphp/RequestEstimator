# Semplificazione Stima - Campi Lista e Scenario Automatico

## Panoramica
Implementate modifiche per semplificare l'inserimento dati nelle stime spostando **Ambienti** e **Stakeholder** a livello di lista e rendendo automatica la generazione del nome scenario.

## Modifiche Implementate

### 1. ✅ Campi Lista - Defaults per Stime

#### Database (Migration 006)
- Aggiunte colonne `default_environments` e `default_stakeholders` alla tabella `app_5939507989_lists`
- Vincoli CHECK per valori validi
- Commenti per documentazione

**File**: `migrations/006_add_list_estimate_defaults.sql`

#### TypeScript Types
- Aggiunto `default_environments?: '1 env' | '2 env' | '3 env'` all'interfaccia `List`
- Aggiunto `default_stakeholders?: '1 team' | '2-3 team' | '4+ team'` all'interfaccia `List`

**File**: `src/types.ts`

#### Form Creazione Lista
Nuova sezione "Valori ereditati dalle stime" con:
- Select per **Ambienti default** (1/2/3 ambienti)
- Select per **Stakeholder default** (1 team / 2-3 team / 4+ team)
- Tooltips esplicativi per ogni campo

**File**: `src/pages/Index.tsx`

#### Sistema Defaults
Aggiornata la logica di cascade in `getEstimateDefaults`:
- **Environments**: List Default → Preset → Default ('2 env')
- **Stakeholders**: List Default → Labels Analysis → Preset → Default ('1 team')

**File**: `src/lib/defaults.ts`

### 2. ✅ Scenario Automatico

#### Generazione Nome
- Rimosso campo input manuale per il nome scenario
- Implementata funzione `generateScenarioName()` che crea nomi come:
  - `Scenario 10/11 14:30`
  - Formato: `Scenario {giorno/mese} {ora:minuti}`
- Il nome viene generato automaticamente alla creazione di ogni nuova stima

#### UI Ottimizzata
- Rimosso input del nome scenario dalla sezione "Scenario & Driver"
- Nome scenario ora visualizzato in header come badge con font monospace
- Spazio recuperato utilizzato per aumentare spaziatura tra i driver
- Layout più pulito e focalizzato sui parametri rilevanti

**File**: `src/components/EstimateEditor.tsx`

## Flusso Utente Aggiornato

### Creazione Lista
1. Utente compila dati base (nome, tecnologia, note)
2. **NUOVO**: Seleziona ambienti e stakeholder tipici del progetto
3. Questi valori diventeranno default per tutte le stime della lista

### Creazione Stima
1. L'utente apre l'editor stima
2. **AUTOMATICO**: Nome scenario generato con timestamp
3. **EREDITATI**: Ambienti e stakeholder pre-compilati dalla lista
4. L'utente può sovrascrivere questi valori se necessario (sistema override esistente)
5. Focus sui parametri variabili: Complessità e Riutilizzo

## Benefici

### 🎯 Riduzione Input Ripetitivi
- Ambienti e stakeholder definiti una volta a livello progetto
- Non serve reinserirli per ogni stima
- Valori coerenti per tutte le stime della stessa lista

### ⚡ UX Migliorata
- Meno campi da compilare in fase di stima
- Nome scenario automatico elimina indecisioni
- Timestamp nel nome facilita identificazione versioni
- Layout più pulito e focalizzato

### 🔧 Flessibilità Mantenuta
- Sistema override esistente funziona anche per i nuovi campi
- Possibilità di personalizzare valori per singole stime quando necessario
- DefaultPill mostra la fonte del valore (List Default / Preset / etc.)

## Compatibilità

### ✅ Backward Compatibility
- Liste esistenti continuano a funzionare (campi opzionali)
- Se `default_environments` o `default_stakeholders` non impostati, si usa la logica precedente
- Stime esistenti non modificate

### 🔄 Migration Path
1. Eseguire migration SQL su Supabase
2. Le liste esistenti avranno `NULL` nei nuovi campi
3. L'utente può editare liste esistenti per impostare i default
4. Nuove stime useranno i default se disponibili

## TODO - Applicazione Modifiche

### Database
```bash
# Eseguire su Supabase SQL Editor
cat migrations/006_add_list_estimate_defaults.sql
# Oppure copiare il contenuto manualmente
```

### Verifica
1. ✅ TypeScript types aggiornati
2. ✅ Form creazione lista aggiornato
3. ✅ Sistema defaults aggiornato
4. ✅ EstimateEditor semplificato
5. ⏳ **NECESSARIO**: Applicare migration SQL a database Supabase

## File Modificati

```
src/types.ts                            # +2 campi List interface
src/pages/Index.tsx                     # Form creazione lista aggiornato
src/lib/defaults.ts                     # Logica cascade aggiornata
src/components/EstimateEditor.tsx       # Scenario automatico + UI ottimizzata
migrations/006_add_list_estimate_defaults.sql  # Schema database
```

## Note Implementative

### Formato Scenario
Il formato `Scenario {data} {ora}` è stato scelto perché:
- ✅ Immediatamente identificabile
- ✅ Ordinabile cronologicamente
- ✅ Compatto ma leggibile
- ✅ Include timestamp per tracciabilità

Alternative considerate:
- ❌ Solo timestamp numerico (poco leggibile)
- ❌ Solo progressivo (perde informazione temporale)
- ❌ Nome descrittivo manuale (troppo lungo, inconsistente)

### Priorità Cascade Environments/Stakeholders
```
List Default (massima priorità)
    ↓
Preset (se non c'è list default)
    ↓
Analysis/Inference (per stakeholders)
    ↓
System Default (fallback finale)
```

Questa gerarchia permette:
1. Controllo esplicito a livello progetto (list default)
2. Automazione intelligente (preset/analysis)
3. Sempre un valore valido (system default)
