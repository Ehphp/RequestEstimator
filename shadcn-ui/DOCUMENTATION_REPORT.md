# Documentazione Audit e Priorità

Questo report ordina e verifica la documentazione presente in `workspace/shadcn-ui`, evidenziando aree strategiche, di progettazione e operative che meritano aggiornamenti coerenti.

## 1. Strategia e reporting
- `EXECUTIVE_SUMMARY.md` / `IMPLEMENTATION_SUMMARY.md` / `DEEP_ANALYSIS_REPORT.md`: raccontano lo stato di avanzamento complessivo e i trade-off principali; mantengono una narrazione utile per stakeholder non tecnici.
- `DARK_MODE_AUDIT_REPORT.md`, `SAFETY_AUDIT_REPORT.md`, `VERIFICATION_REPORT.md`: registrano i controlli di qualità eseguiti lato UX, accessibilità e compliance.

## 2. Decisioni UX e funzionali
- `ESTIMATE_EDITOR_UX_OPTIMIZATION.md`, `REQUIREMENT_DETAIL_UX_OPTIMIZATION.md`, `INLINE_LIST_NAME_EDITING.md`: spiegano le logiche UX adottate, indispensabili quando si modificano moduli come `EstimateEditor` o `RequirementDetailView`.
- `FILTER_BAR_SUMMARY.md` / `FILTER_BAR_REFACTORING.md` / `FILTER_BAR_MANUAL_TESTS.js`: dettagliano il comportamento del filtraggio, utile prima di intervenire su `components/requirements` e `lib/filterUtils.ts`.
- `CARD_LAYOUT_CLEANUP.md` / `CARD_RESPONSIVE_LAYOUTS.md`: documentano la revisione dei layout per le card principali, valori importanti per responsive e temi scuri.

## 3. Implementazione e refactor
- `TREEMAP_*` (ARCHI, MULTIPLE_SERIES_IMPLEMENTATION, DYNAMIC_HEIGHT, CHANGELOG): descrivono i passi per costruire la visualizzazione ad albero e garantiscono che le modifiche future mantengano la compatibilità con `TreemapApex` e `TreemapApexMultiSeries`.
- `CLEANUP_*` / `DEEP_CLEANUP_REPORT.md` / `CLEANUP_AND_BUGFIX_REPORT.md` / `CLEANUP_PHASE_1_COMPLETE.md`: tracciano la refactorizzazione e i bug fix su componenti core.
- `PR_PROPOSALS.md`: raccoglie idee per future PR e aiuta a mantenere la roadmap allineata.

## 4. Operazioni, testing e supporto
- `TESTING.md`, `QUICK_TEST_GUIDE.md`, `FIXES_APPLIED.md`: forniscono i passi replicabili per validare release e bug fix.
- `QUICK_FIX.md` (ref in migrations) e `MASTER_RESOLUTION_PLAN.md`: spiegano interventi urgenti su Supabase.
- `OVERLAP_BUG_FIX.md`: dettaglia la risoluzione di casi limite visivi o di sovrapposizione.

## 5. Riferimenti tecnici e database
- `docs/` (ad es. `REQUIREMENT_DEFAULTS_SYSTEM.md`, `DATABASE_VALIDATION.md`): spiegano la logica dei defaults, la validazione del database e gli attuali vincoli Supabase; servono da manuale di consultazione per `lib/defaults.ts`, `validation.ts`, `storage.ts`.
- `migrations/`: migrano l’istanza Supabase con le tabelle `app_5939507989_*` (liste, requisiti, stime, attività, driver, rischi, bande di contingenza, sticky defaults); i nomi e i campi sono stati letti dai file `.sql` esistenti per garantire coerenza da README e documentazione.

## Priorità consigliate (ordine)
1. **README e guida iniziale** – già ripulita per garantire onboarding chiaro su stack/feature/stack; aggiornarla ogni volta che cambia un tool o l’architettura.
2. **docs/** – mantenere sincronizzati defaults, validazioni e funzionalità di dataset con il codice (`src/lib`, `src/constants`, `migrations`).
3. **UX/feature narrative** – aggiornare `ESTIMATE_EDITOR_UX_OPTIMIZATION.md`, `INLINE_LIST_NAME_EDITING.md`, `CARD_LAYOUT_*` dopo ogni revisione UI o responsive.
4. **Audit/Report** – garantire che `VERIFICATION_REPORT.md`, `SAFETY_AUDIT_REPORT.md` riflettano test e bug fix reali (linkare i ticket o PR quando disponibili).
5. **Testing & Support** – tenere `TESTING.md`, `QUICK_TEST_GUIDE.md`, `FIXES_APPLIED.md` allineati con gli script `pnpm lint/test/dev`.

## Verifiche completate
- Le tabelle Supabase citate in README sono state verificate contro i file `migrations/*.sql`.
- Gli script `pnpm dev/build/preview/lint/test` sono già esposti nei documenti operativi e vengono richiamati in `QUICK_TEST_GUIDE.md`.
- Le descrizioni delle sezioni UX sono coerenti con i componenti `EstimateEditor`, `RequirementDetailView`, `RequirementsList` e `TreemapApex*`, a giudicare da `src/components` e `docs/` correlati.

## Prossimi passi suggeriti
1. Scrivere versioni aggiornate di `OVERLAP_BUG_FIX.md` e `FIXES_APPLIED.md` ogni volta che si pubblica un hotfix visivo o di logica.
2. Centralizzare nel report (questo file) i link ai documenti condivisi nelle PR per mantenere traccia dello stato di ogni sezione.
3. Considerare una tabella `docs/README` per spiegare la struttura di questa cartella e il flusso di aggiornamento (per facilitare il contributo futuro).
