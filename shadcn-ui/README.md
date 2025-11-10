# Power Platform Requirements Estimation System

Full-stack suite to manage requirements and automatic estimations for Power Platform projects, built with React, TypeScript, Vite, and Supabase.

## Key capabilities
- **List management** with sticky defaults, presets, and owner-level control.
- **Requirements lifecycle** that tracks priorities, states, estimation history, and audit metadata.
- **Automated estimating engine** that combines activities, drivers, contingencies, environments, and reuse.
- **Smart defaults cascade** that inherits values from lists, keyword analysis, or system presets (see `docs/REQUIREMENT_DEFAULTS_SYSTEM.md`).
- **Analytics and exports** including dashboards, KPI tiles, treemaps, and CSV/Excel dumps (`EXPORT` section).

## Technology stack
| Layer | Technology |
| --- | --- |
| Frontend | React 19 + TypeScript 5, Vite 5, Tailwind CSS with shadcn/ui components |
| Backend | Supabase (PostgreSQL + Edge Functions/Realtime) |
| Forms & Validation | react-hook-form + Zod |
| Charts | Recharts, Treemap custom implementations |
| State & Utils | React Context + custom hooks, shared libraries under `src/lib` |

## Project layout
- `src/` – application entrypoints, pages, shared components, hooks and lib (calculations, defaults, storage, validation, etc.).
- `src/components` – business UI (estimate editor, requirement lists, treemaps, dashboards, modals, etc.).
- `src/components/ui` – shadcn/ui primitives and styling utilities.
- `docs/` – feature rationale, defaults system, database validation, and migration notes.
- `migrations/` – Supabase schema migrations, diagnostic scripts, and rollback helpers.
- `public/` and configuration (`pnpm`, `tailwind`, `vite`, `eslint`) mirror a standard Vite + React setup.

## Getting started
1. Install prerequisites: Node 20, pnpm.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Create an `.env` file at the project root (copy `.env.example` if provided) with:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Ensure Supabase tables exist (prefix `app_5939507989_`) before running migrations:
   - `app_5939507989_lists`
   - `app_5939507989_requirements`
   - `app_5939507989_estimates`
   - `app_5939507989_activities`, `_drivers`, `_risks`, `_contingency_bands`, `_sticky_defaults`
   These names are referenced in the migration scripts under `migrations/`.

## Development commands
- `pnpm dev` – run the Vite dev server on port 5173.
- `pnpm build` – production build.
- `pnpm preview` – preview the production build locally.
- `pnpm lint` – run ESLint across the workspace.
- `pnpm test` – run Vitest suites defined under `src/lib/__tests__/`.

## Key documentation references
- `docs/REQUIREMENT_DEFAULTS_SYSTEM.md` – explains the defaults cascade and UX changes for list/requisite creation.
- `docs/DATABASE_VALIDATION.md` – outlines Supabase database expectations and integrity checks.
- `docs/VERIFICATION_REPORT.md` and `docs/UX_UI_AUDIT_REPORT.md` – describe verification steps and UX/QA findings.
- `docs/TREEMAP_*` – cover treemap design, implementation options, multi-series behavior, and changelog.
- `DEEP_CLEANUP_REPORT.md`, `CLEANUP_SUMMARY.md`, `FILTER_BAR_SUMMARY.md` – summarize cleanup waves, refactor decisions, and filter bar manual tests.
- `QUICK_TEST_GUIDE.md` and `TESTING.md` – troubleshooting, testing flow, and recommended checks before release.

## Standards & contribution
- Follow PascalCase for components and camelCase for helpers; keep TypeScript interfaces strict (see `src/types.ts`).
- Run lint/test before submitting code.
- Use feature branches and describe the purpose of each PR; include screenshots or recordings when UI changes are involved.
- Update documentation files (above) whenever features, migrations, or workflows change.

## Support & contact
1. Check browser console errors and Supabase logs for runtime issues.
2. Review `QUICK_TEST_GUIDE.md` and `docs/DATABASE_VALIDATION.md` for known pitfalls.
3. Ask reviewers to confirm UX tweaks against `docs/UX_UI_AUDIT_REPORT.md` when relevant.

## License
Specify the project license here (e.g., MIT, Proprietary) once determined.
