# Requirements Estimation System - Power Platform

Sistema di gestione e stima requisiti per progetti Power Platform, con calcolo automatico dei costi basato su attività, driver e analisi del rischio.

## 🎯 Panoramica

Sistema full-stack per la gestione di:
- **Lists**: Contenitori di progetto con configurazioni preset
- **Requirements**: Requisiti individuali con priorità, stato, owner
- **Estimates**: Storico stime con audit trail completo
- **Smart Defaults**: Sistema intelligente di default con preset e sticky preferences

## 🛠 Stack Tecnologico

- **Frontend**: React 19 + TypeScript + Vite
- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS)
- **Backend**: Supabase (PostgreSQL + Real-time)
- **State Management**: React Hooks + Context
- **Forms**: react-hook-form + Zod validation
- **Styling**: Tailwind CSS con custom color coding

## 📁 Struttura Progetto

```
src/
├── components/        # Componenti business
│   ├── EstimateEditor.tsx
│   ├── RequirementsList.tsx
│   ├── RequirementsView.tsx
│   ├── ListsView.tsx
│   └── ui/           # shadcn/ui components
├── lib/              # Business logic
│   ├── calculations.ts   # Engine di calcolo stime
│   ├── defaults.ts       # Sistema smart defaults
│   ├── storage.ts        # Layer CRUD Supabase
│   ├── supabase.ts       # Client Supabase
│   └── utils.ts
├── data/
│   ├── catalog.ts        # Activities, drivers, risks
│   └── presets.ts        # Configurazioni preset
├── contexts/
│   └── AuthContext.tsx   # Autenticazione
├── pages/
│   ├── Index.tsx         # Dashboard principale
│   └── NotFound.tsx
└── types.ts          # TypeScript definitions

```

## 🚀 Setup

### 1. Installazione Dipendenze

```bash
pnpm install
```

### 2. Configurazione Supabase

Crea un file `.env` nella root del progetto:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Usa `.env.example` come template.

### 3. Schema Database

Le tabelle Supabase sono prefissate con `app_5939507989_`:
- `app_5939507989_lists`
- `app_5939507989_requirements`
- `app_5939507989_estimates`
- `app_5939507989_activities`
- `app_5939507989_drivers`
- `app_5939507989_risks`
- `app_5939507989_contingency_bands`
- `app_5939507989_sticky_defaults`

## 📜 Comandi Disponibili

```bash
# Development server (porta 5173)
pnpm dev

# Build per produzione
pnpm build

# Lint con ESLint
pnpm lint

# Preview build
pnpm preview
```

## 🎨 Pattern di Sviluppo

### Calcolo Stime

Il motore di calcolo (`src/lib/calculations.ts`) segue questa formula:

```
activities_base_days = Σ(selected_activities.base_days)
driver_multiplier = complexity × environments × reuse × stakeholders
subtotal_days = activities_base_days × driver_multiplier
risk_score = Σ(selected_risks.weight)
contingency_pct = getContingencyPercentage(risk_score)  // 0-50%
contingency_days = subtotal_days × contingency_pct
total_days = subtotal_days + contingency_days
```

### Smart Defaults

Gerarchia di precedenza per i default:
1. **Sticky Defaults** (preferenze utente persistenti per lista)
2. **Preset** (configurazione da template progetto)
3. **Keyword Analysis** (inferenza da titolo/labels)
4. **System Defaults** (valori di fallback)

### CRUD Operations

Tutte le operazioni CRUD passano attraverso `src/lib/storage.ts`:
- Gestione errori consistente con `handleSupabaseError`
- Logging operazioni con `logger` e `logCrud`
- Return type espliciti per error handling

## 🎯 Convenzioni Codice

- **TypeScript Strict**: Tutti i tipi espliciti in `src/types.ts`
- **Component Props**: Interface esplicite per ogni componente
- **Error Handling**: Try-catch con logging e user feedback
- **Color Coding**:
  - Priority: High=red, Med=yellow, Low=green
  - State: Proposed=blue, Selected=purple, Scheduled=orange, Done=green

## 🔐 Sicurezza

- ✅ Chiavi API in variabili d'ambiente (`.env`)
- ✅ `.env` in `.gitignore`
- ❌ **MAI** committare chiavi nel codice
- 🔄 Rotazione periodica delle chiavi Supabase

## 📚 Risorse

- [Documentazione shadcn/ui](https://ui.shadcn.com)
- [Supabase Docs](https://supabase.com/docs)
- [Vite Guide](https://vitejs.dev/guide)
- [React 19 Docs](https://react.dev)

## 🐛 Bug Report & Issues

Per segnalare bug o richiedere feature, consultare il project management interno.

## 📄 License

Proprietario - Uso interno

```

**Add Dependencies**

```shell
pnpm add some_new_dependency

**Start Preview**

```shell
pnpm run dev
```

**To build**

```shell
pnpm run build
```
