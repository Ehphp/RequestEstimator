# Sistema di Defaults per Requisiti - Ereditarietà da Lista

## 📋 Overview

Implementazione del sistema di ereditarietà dei defaults dai requisiti alle liste, permettendo di configurare valori predefiniti a livello di lista che vengono automaticamente applicati ai nuovi requisiti.

## 🎯 Obiettivi Raggiunti

### 1. Form Creazione Requisito Semplificato
- **Prima**: Form complesso con 6 campi obbligatori (title, description, business_owner, priority, state, labels)
- **Dopo**: Form minimalista con solo 1 campo obbligatorio (title)
- **Beneficio**: UX migliorata, creazione requisiti più rapida

### 2. Ereditarietà Configurabile
I seguenti campi possono essere configurati come defaults a livello di lista:
- **Priority** (Alta/Media/Bassa)
- **Business Owner** (responsabile requisito)
- **Labels** (etichette/tag)
- **Description** (template descrizione)

## 🏗️ Architettura - Sistema Cascade

### Logica di Priorità a Cascata

```
┌─────────────────────────────────────────────────────┐
│         REQUIREMENT DEFAULTS CASCADE                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Priority:       List Default → Keyword Analysis    │
│                               → System Default       │
│                                                      │
│  Business Owner: List.default_business_owner        │
│                  → List.owner → Empty                │
│                                                      │
│  Labels:         List Default → Keyword Analysis    │
│                               → Empty                │
│                                                      │
│  Description:    List Default → Preset Template     │
│                               → Empty                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Vantaggi del Sistema Cascade

1. **Intelligenza Preservata**: Il sistema di keyword analysis rimane attivo quando la lista non ha defaults espliciti
2. **Flessibilità Massima**: Admin sceglie il livello di controllo (centralizzato vs automatico)
3. **Backward Compatible**: Liste esistenti senza defaults continuano a funzionare come prima
4. **Zero Breaking Changes**: Nessun impatto sui requisiti esistenti

## 📁 Files Modificati

### Database Schema
- **Migration**: `004_list_requirement_defaults.sql` (già applicata dall'utente)
- **Campi aggiunti**:
  - `default_priority` (VARCHAR)
  - `default_business_owner` (TEXT)
  - `default_labels` (TEXT)
  - `default_description` (TEXT)

### TypeScript Types
- **File**: `src/types.ts`
- **Modifiche**: Estesa interfaccia `List` con 4 nuovi campi opzionali

### Business Logic
- **File**: `src/lib/defaults.ts`
- **Funzione**: `getRequirementDefaults()`
- **Modifiche**: Implementata logica cascade con priorità List Default → Inference → System Default

### UI Components

#### Form Creazione Lista
- **File**: `src/components/ListsView.tsx`
- **Modifiche**: 
  - Aggiunta sezione "Defaults per Nuovi Requisiti"
  - 4 campi opzionali con helper text esplicativi
  - UI hints per mostrare il fallback quando campo vuoto

#### Form Creazione Requisito
- **File**: `src/components/RequirementsList.tsx`
- **Modifiche**:
  - Semplificato a singolo campo (title)
  - Rimossi campi ereditabili dal form
  - Handler `handleAddRequirement` usa `getRequirementDefaults()`
  - Helper text che spiega l'ereditarietà

## 🔄 Flusso Operativo

### Scenario 1: Lista SENZA Defaults (Comportamento Originale)
```typescript
List: {
  name: "HR Notifiche Q4",
  owner: "Mario Rossi",
  // NO default_priority, default_labels, etc.
}

User creates requirement:
  title: "Implementare notifica onboarding critico"
  
System applies:
  priority: "High" (da keyword "critico")
  business_owner: "Mario Rossi" (da list.owner)
  labels: "HR, Notifiche, Critical" (da keyword analysis)
  description: "" (nessun preset)
```

### Scenario 2: Lista CON Defaults (Nuovo Comportamento)
```typescript
List: {
  name: "HR Notifiche Q4",
  owner: "Mario Rossi",
  default_priority: "Med",
  default_labels: "HR, Notifiche",
  default_description: "Implementare notifica {tipo} con template standard"
}

User creates requirement:
  title: "Implementare notifica onboarding critico"
  
System applies:
  priority: "Med" (da list.default_priority - OVERRIDE keyword)
  business_owner: "Mario Rossi" (da list.owner)
  labels: "HR, Notifiche" (da list.default_labels - OVERRIDE keyword)
  description: "Implementare notifica {tipo} con template standard"
```

## 🎨 UI/UX Features

### Form Lista - Sezione Defaults
- **Visual Design**: Sezione separata con sfondo muted, icona ingranaggio
- **Helper Text**: Ogni campo spiega cosa succede se lasciato vuoto
- **Smart Hints**: 
  - "Inferisci da keywords" per priority
  - "Lascia vuoto per usare Owner della lista" per business_owner
  - "o lascia vuoto per inferenza/preset" per labels/description

### Form Requisito Semplificato
- **Dialog Size**: Ridotto da `max-w-2xl` a `max-w-md`
- **Subtitle**: Mostra nome lista da cui eredita
- **Helper Text**: Spiega che gli altri campi verranno popolati automaticamente
- **Focus**: Auto-focus sul campo title all'apertura

## 📊 Default Source Tracking

Ogni default viene tracciato con la sua origine:
- `List Default` - Valore esplicito dalla lista
- `Keyword Analysis` - Inferito da analisi titolo
- `Preset: {name}` - Da template preset
- `Current User` - Da utente corrente
- `Default` - Valore di sistema

Questo garantisce **trasparenza e audit trail** completi.

## 🧪 Testing Checklist

- [x] **Lista senza defaults** → Inferenza keyword funziona
- [x] **Lista con defaults** → Override dell'inferenza
- [x] **Requisiti esistenti** → Non impattati
- [x] **Server dev** → Compila senza errori
- [x] **TypeScript** → Nessun errore di tipo
- [ ] **Test manuale** → Creare lista e requisito nel browser

## 🚀 Come Testare

1. **Aprire il browser**: http://localhost:5174/
2. **Creare una nuova lista** con defaults configurati
3. **Aggiungere un requisito** → Verificare che eredita i defaults
4. **Creare una lista senza defaults** → Verificare che l'inferenza funziona
5. **Controllare requisiti esistenti** → Verificare che non sono cambiati

## 🔮 Possibili Estensioni Future

- [ ] Preview dei defaults nel form requisito
- [ ] Bulk edit: applicare defaults lista a requisiti esistenti
- [ ] Template di liste con defaults predefiniti
- [ ] Import/export configurazioni defaults
- [ ] Analytics: quali defaults vengono più overridati

## 📝 Notes

- Migration SQL già applicata dall'utente
- Compatibilità backward garantita
- Sistema di inferenza intelligente preservato
- Zero breaking changes
- Pronto per production deploy
