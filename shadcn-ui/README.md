# 📊 Power Platform Requirements Estimation System# Requirements Estimation System - Power Platform



Sistema completo di gestione e stima requisiti per progetti Power Platform, costruito con **React**, **TypeScript**, **Vite**, e **Supabase**.Sistema di gestione e stima requisiti per progetti Power Platform, con calcolo automatico dei costi basato su attività, driver e analisi del rischio.



---## 🎯 Panoramica



## 🎯 PanoramicaSistema full-stack per la gestione di:

- **Lists**: Contenitori di progetto con configurazioni preset

Questo progetto fornisce un'interfaccia intuitiva per:- **Requirements**: Requisiti individuali con priorità, stato, owner

- **Gestione liste** di requisiti per progetti Power Platform- **Estimates**: Storico stime con audit trail completo

- **Stima dettagliata** con driver di complessità, ambienti, riuso e stakeholder- **Smart Defaults**: Sistema intelligente di default con preset e sticky preferences

- **Analisi rischi** e calcolo automatico contingenze

- **Dashboard analytics** con KPI, grafici e proiezioni timeline## 🛠 Stack Tecnologico

- **Export dati** in formato standardizzato

- **Frontend**: React 19 + TypeScript + Vite

---- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS)

- **Backend**: Supabase (PostgreSQL + Real-time)

## 🏗️ Architettura- **State Management**: React Hooks + Context

- **Forms**: react-hook-form + Zod validation

### Stack Tecnologico- **Styling**: Tailwind CSS con custom color coding



| Componente | Tecnologia |## 📁 Struttura Progetto

|------------|------------|

| **Frontend** | React 19 + TypeScript 5 |```

| **Build Tool** | Vite 5 |src/

| **UI Components** | shadcn/ui + Radix UI |├── components/        # Componenti business

| **Styling** | Tailwind CSS 3 |│   ├── EstimateEditor.tsx

| **Backend** | Supabase (PostgreSQL) |│   ├── RequirementsList.tsx

| **State Management** | React Hooks + TanStack Query |│   ├── RequirementsView.tsx

| **Charts** | Recharts 2 |│   ├── ListsView.tsx

| **Routing** | React Router 6 |│   └── ui/           # shadcn/ui components

├── lib/              # Business logic

### Struttura Progetto│   ├── calculations.ts   # Engine di calcolo stime

│   ├── defaults.ts       # Sistema smart defaults

```│   ├── storage.ts        # Layer CRUD Supabase

workspace/shadcn-ui/│   ├── supabase.ts       # Client Supabase

├── src/│   └── utils.ts

│   ├── components/          # Componenti React├── data/

│   │   ├── ui/             # Componenti UI base (shadcn)│   ├── catalog.ts        # Activities, drivers, risks

│   │   ├── DashboardView.tsx│   └── presets.ts        # Configurazioni preset

│   │   ├── EstimateEditor.tsx├── contexts/

│   │   ├── RequirementsList.tsx│   └── AuthContext.tsx   # Autenticazione

│   │   └── ...├── pages/

│   ├── contexts/           # React Context (Auth)│   ├── Index.tsx         # Dashboard principale

│   ├── data/               # Dati statici (catalog, presets)│   └── NotFound.tsx

│   ├── hooks/              # Custom hooks└── types.ts          # TypeScript definitions

│   ├── lib/                # Logica business

│   │   ├── calculations.ts    # Formule stime```

│   │   ├── storage.ts        # API Supabase

│   │   ├── defaults.ts       # Sistema defaults## 🚀 Setup

│   │   ├── validation.ts     # Validazioni

│   │   └── __tests__/        # Unit tests### 1. Installazione Dipendenze

│   ├── pages/              # Pagine principali

│   ├── types/              # TypeScript types```bash

│   └── main.tsx            # Entry pointpnpm install

├── public/```

├── package.json

├── vite.config.ts### 2. Configurazione Supabase

└── tailwind.config.ts

```Crea un file `.env` nella root del progetto:



---```env

VITE_SUPABASE_URL=your_supabase_url

## 📦 Entità PrincipaliVITE_SUPABASE_ANON_KEY=your_supabase_anon_key

```

### 1. **List** (Lista Progetti)

Container per requisiti con configurazioni preset.Usa `.env.example` come template.



```typescript### 3. Schema Database

interface List {

  list_id: string;Le tabelle Supabase sono prefissate con `app_5939507989_`:

  name: string;- `app_5939507989_lists`

  description?: string;- `app_5939507989_requirements`

  preset_key?: string;        // Preset applicato- `app_5939507989_estimates`

  created_on: string;- `app_5939507989_activities`

  created_by: string;- `app_5939507989_drivers`

  status: 'Active' | 'Archived';- `app_5939507989_risks`

  owner?: string;- `app_5939507989_contingency_bands`

  period?: string;- `app_5939507989_sticky_defaults`

}

```## 📜 Comandi Disponibili



### 2. **Requirement** (Requisito)```bash

Singola feature o user story.# Development server (porta 5173)

pnpm dev

```typescript

interface Requirement {# Build per produzione

  req_id: string;pnpm build

  list_id: string;

  title: string;# Lint con ESLint

  description: string;pnpm lint

  priority: 'High' | 'Med' | 'Low';

  state: 'Proposed' | 'Selected' | 'Scheduled' | 'Done';# Preview build

  business_owner: string;pnpm preview

  labels?: string;            // Tag CSV```

  created_on: string;

  last_estimated_on?: string;## 🎨 Pattern di Sviluppo

  estimator?: string;

}### Calcolo Stime

```

Il motore di calcolo (`src/lib/calculations.ts`) segue questa formula:

### 3. **Estimate** (Stima)

Stima dettagliata con audit trail completo.```

activities_base_days = Σ(selected_activities.base_days)

```typescriptdriver_multiplier = complexity × environments × reuse × stakeholders

interface Estimate {subtotal_days = activities_base_days × driver_multiplier

  estimate_id: string;risk_score = Σ(selected_risks.weight)

  req_id: string;contingency_pct = getContingencyPercentage(risk_score)  // 0-50%

  scenario: string;           // 'A', 'B', 'C'contingency_days = subtotal_days × contingency_pct

  total_days = subtotal_days + contingency_days

  // Driver```

  complexity: 'Low' | 'Medium' | 'High';

  environments: '1 env' | '2 env' | '3 env';### Smart Defaults

  reuse: 'High' | 'Medium' | 'Low';

  stakeholders: '1 team' | '2-3 team' | '4+ team';Gerarchia di precedenza per i default:

  1. **Sticky Defaults** (preferenze utente persistenti per lista)

  // Attività e rischi2. **Preset** (configurazione da template progetto)

  included_activities: string[];3. **Keyword Analysis** (inferenza da titolo/labels)

  selected_risks: string[];4. **System Defaults** (valori di fallback)

  

  // Calcoli### CRUD Operations

  activities_base_days: number;

  driver_multiplier: number;Tutte le operazioni CRUD passano attraverso `src/lib/storage.ts`:

  subtotal_days: number;- Gestione errori consistente con `handleSupabaseError`

  risk_score: number;- Logging operazioni con `logger` e `logCrud`

  contingency_pct: number;- Return type espliciti per error handling

  contingency_days: number;

  total_days: number;## 🎯 Convenzioni Codice

  

  // Tracking defaults- **TypeScript Strict**: Tutti i tipi espliciti in `src/types.ts`

  complexity_is_overridden: boolean;- **Component Props**: Interface esplicite per ogni componente

  complexity_default_source?: string;- **Error Handling**: Try-catch con logging e user feedback

  // ... altri campi tracking- **Color Coding**:

}  - Priority: High=red, Med=yellow, Low=green

```  - State: Proposed=blue, Selected=purple, Scheduled=orange, Done=green



---## 🔐 Sicurezza



## 🧮 Motore di Calcolo- ✅ Chiavi API in variabili d'ambiente (`.env`)

- ✅ `.env` in `.gitignore`

### Formula Base- ❌ **MAI** committare chiavi nel codice

- 🔄 Rotazione periodica delle chiavi Supabase

```

SUBTOTAL = Σ(base_days_attività) × driver_multiplier## 📚 Risorse

CONTINGENCY = SUBTOTAL × contingency_pct

TOTAL = SUBTOTAL + CONTINGENCY- [Documentazione shadcn/ui](https://ui.shadcn.com)

```- [Supabase Docs](https://supabase.com/docs)

- [Vite Guide](https://vitejs.dev/guide)

### Driver Multiplier- [React 19 Docs](https://react.dev)



```typescript## 🐛 Bug Report & Issues

driver_multiplier = 

  complexity_mult × Per segnalare bug o richiedere feature, consultare il project management interno.

  environments_mult × 

  reuse_mult × ## 📄 License

  stakeholders_mult

```Proprietario - Uso interno



**Esempio:**```

- Complexity: High (1.5x)

- Environments: 2 env (1.3x)**Add Dependencies**

- Reuse: Low (1.2x)

- Stakeholders: 2-3 team (1.2x)```shell

pnpm add some_new_dependency

**Risultato:** `1.5 × 1.3 × 1.2 × 1.2 = 2.808x`

**Start Preview**

### Sistema di Contingenza

```shell

| Risk Score | Band | Contingenza |pnpm run dev

|------------|------|-------------|```

| 0 | None | 0% |

| 1-10 | Low | 10% |**To build**

| 11-20 | Medium | 20% |

| 21+ | High | 35% |```shell

| Max cap | - | 50% |pnpm run build

```

---

## 🎨 Sistema Smart Defaults

Il sistema applica defaults intelligenti in ordine di priorità:

1. **Preset Lista** - Configurazioni predefinite per tipologia progetto
2. **Sticky Defaults** - Ultime scelte dell'utente per quella lista
3. **Catalog Defaults** - Valori di fallback dal catalogo

I campi sovrascritti dall'utente vengono tracciati con flag `is_overridden`.

---

## 📊 Dashboard & Analytics

### KPI Calcolati

- **Total Effort** - Somma giorni/uomo
- **Average Estimate** - Media per requisito
- **Median & P80** - Percentili distribuzione
- **Priority Mix** - Conteggi e percentuali per priorità
- **Effort by Priority** - Giorni totali per priorità
- **Difficulty Mix** - Distribuzione complessità
- **Top Tag by Effort** - Tag più oneroso

### Grafici

1. **Scatter Plot** - Effort vs Difficulty colorato per priorità
2. **Bar Chart** - Top 10 tag per effort (stacked per priorità)
3. **Timeline Projection** - Calcolo date completamento

### Modalità Proiezione

**Neutral:** Capacità distribuita uniformemente
```
workdays = ceil(total_days / n_developers)
```

**Priority-First:** Completa sequenzialmente High → Med → Low
```
finish_high = start + ceil(effort_high / n_devs)
finish_med = finish_high + ceil(effort_med / n_devs)
finish_low = finish_med + ceil(effort_low / n_devs)
```

---

## 🗄️ Database (Supabase)

### Tabelle Principali

```sql
-- Tutte le tabelle hanno prefisso app_5939507989_

app_5939507989_lists
app_5939507989_requirements
app_5939507989_estimates
app_5939507989_activities      -- Catalogo attività
app_5939507989_drivers         -- Moltiplicatori driver
app_5939507989_risks           -- Catalogo rischi
app_5939507989_contingency_bands
app_5939507989_sticky_defaults -- Preferenze utente
```

### Relazioni

```
List (1) ──< (N) Requirement (1) ──< (N) Estimate
```

### Row Level Security (RLS)

Configurare policy RLS su Supabase per autenticazione utente.

---

## 🚀 Setup & Installazione

### Prerequisiti

- Node.js 18+
- pnpm 8+
- Account Supabase

### 1. Clona e Installa

```bash
cd workspace/shadcn-ui
pnpm install
```

### 2. Configura Supabase

Crea file `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Importa Schema Database

Esegui le migrazioni SQL su Supabase per creare tabelle.

### 4. Avvia Dev Server

```bash
pnpm run dev
```

Apri http://localhost:5173

---

## 🧪 Testing

```bash
# Run unit tests
pnpm test

# Run with UI
pnpm test:ui

# Coverage report
pnpm test:coverage
```

Test implementati per:
- `calculations.ts` - Formule e calcoli
- `validation.ts` - Validazioni input

---

## 📁 File Chiave

### Business Logic

| File | Responsabilità |
|------|----------------|
| `lib/calculations.ts` | Formule stime, KPI, proiezioni |
| `lib/storage.ts` | CRUD operations Supabase |
| `lib/defaults.ts` | Sistema smart defaults |
| `lib/validation.ts` | Validazioni dati |
| `lib/utils.ts` | Utility e helper functions |

### UI Components

| File | Descrizione |
|------|-------------|
| `DashboardView.tsx` | Dashboard analytics con grafici |
| `EstimateEditor.tsx` | Form stima requisito |
| `RequirementsList.tsx` | Lista requisiti con filtri |
| `ListsView.tsx` | Gestione liste progetti |
| `ExportDialog.tsx` | Export dati |

### Data & Config

| File | Contenuto |
|------|-----------|
| `data/catalog.ts` | Activities, Drivers, Risks, Bands |
| `data/presets.ts` | Preset configurazioni liste |
| `types.ts` | TypeScript interfaces |

---

## 🎨 Styling & UI

### Tailwind Configuration

Custom color coding:
- **Priority:** Red (High), Yellow (Med), Green (Low)
- **State:** Blue (Proposed), Purple (Selected), Orange (Scheduled), Green (Done)
- **Charts:** Colori consistenti da utility `getPrioritySolidColor()`

### shadcn/ui Components

Componenti utilizzati:
- `card`, `badge`, `button`, `input`, `select`, `checkbox`
- `dialog`, `alert`, `tabs`, `tooltip`, `separator`
- `table`, `toast`, `accordion`, `popover`

---

## 🔧 Comandi Disponibili

```bash
pnpm run dev         # Dev server (hot reload)
pnpm run build       # Build produzione
pnpm run preview     # Preview build
pnpm run lint        # ESLint check
pnpm test            # Run tests
```

---

## 🐛 Bug Fix Recenti

### ✅ Fix Applicati (Novembre 2025)

1. **Scatter chart mapping** - Corretto da `{x, y}` a `{difficulty, estimationDays}`
2. **calculateEstimate signature** - Rimosso parametro `includeOptional` non esistente
3. **Campo estimator** - Popolato automaticamente al salvataggio stima
4. **ThemeProvider** - Aggiunto per supporto `next-themes`
5. **UI Holidays** - Implementato input gestione festività
6. **Metriche dashboard** - Visualizzati `topTagByEffort` e `priorityMixPct`
7. **Color utilities** - Refactoring con `getPrioritySolidColor/Class()`
8. **Dependency arrays** - Aggiunti comment eslint per useEffect
9. **Package cleanup** - Rimossi 20+ pacchetti non utilizzati:
   - `uuid`, `zod`, `@hookform/resolvers`, `react-hook-form`
   - `cmdk`, `vaul`, `embla-carousel-react`, `input-otp`
   - `react-dropzone`, `date-fns`, `react-day-picker`
   - Molti componenti Radix UI non utilizzati

---

## 📈 Performance

### Ottimizzazioni

- **useMemo** per calcoli pesanti (KPI, filtri, grafici)
- **Lazy loading** requisiti quando lista selezionata
- **Batch operations** Supabase
- **React Query** caching server state

### Best Practices

- Strict TypeScript typing
- Error boundaries per crash resilience
- Loading states consistenti
- Italian UX messages

---

## 🔐 Autenticazione

### Stato Attuale

`AuthContext` è un placeholder con:
- User hardcoded: `current.user@example.com`
- `isAuthenticated` sempre `true`

### TODO: Integrazione Supabase Auth

```typescript
// In AuthContext.tsx
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  setCurrentUser(user.email || 'unknown');
  setIsAuthenticated(true);
}
```

---

## 📊 Export Dati

Export CSV/Excel con struttura:

```
list_name, req_id, title, priority, scenario,
complexity, environments, reuse, stakeholders,
subtotal_days, contingency_pct, total_days,
estimator, last_estimated_on, state
```

---

## 🛠️ Manutenzione

### Aggiornare Catalog

Modificare `src/data/catalog.ts`:
- **Activities**: Nuove attività con base_days
- **Drivers**: Modificare moltiplicatori
- **Risks**: Aggiungere rischi con weight
- **Contingency Bands**: Adattare percentuali

### Aggiungere Preset

In `src/data/presets.ts`:

```typescript
{
  preset_key: 'my-preset',
  name: 'My Custom Preset',
  defaults: {
    complexity: 'Medium',
    environments: '2 env',
    // ...
  }
}
```

---

## 📝 Convenzioni Codice

### Naming

- **Components**: PascalCase (`EstimateEditor.tsx`)
- **Utils/Libs**: camelCase (`calculations.ts`)
- **Types**: PascalCase (`interface Requirement`)
- **Constants**: UPPER_SNAKE_CASE (`TABLES.LISTS`)

### Imports

Usa alias `@/` per import relativi:
```typescript
import { Button } from '@/components/ui/button';
import { calculateEstimate } from '@/lib/calculations';
```

### Error Handling

```typescript
try {
  const result = await operation();
  return result;
} catch (error) {
  logger.error('Context:', error);
  throw new Error('Messaggio utente friendly');
}
```

---

## 🤝 Contribuire

### Workflow

1. Crea feature branch
2. Implementa con test
3. Run `pnpm lint` e `pnpm test`
4. Pull request con descrizione dettagliata

### Code Review Checklist

- [ ] TypeScript strict typing
- [ ] Error handling implementato
- [ ] Loading states gestiti
- [ ] Mobile responsive
- [ ] Test coverage adeguata
- [ ] Documentazione aggiornata

---

## 📞 Supporto

Per problemi o domande:
1. Verifica errori console browser
2. Controlla log Supabase
3. Consulta `TESTING.md` per troubleshooting
4. Controlla `REFACTORING_SUMMARY.md` per cronologia modifiche

---

## 📄 Licenza

[Specificare licenza progetto]

---

## 🙏 Credits

- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Backend**: [Supabase](https://supabase.com/)

---

**Version:** 1.0.0  
**Last Updated:** November 2025  
**Maintainer:** [Nome Team/Progetto]
