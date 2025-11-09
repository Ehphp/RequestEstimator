# 📋 PR Proposals - Safety Audit

**Branch base:** `refactor/safety-audit`  
**Target:** `main` (dopo staging validation)  
**Strategia:** Incremental, backward-compatible changes

---

## 🚀 ONDA 1: Quick Wins (Priorità Immediata)

### PR-01: `refactor/remove-unused-vars`

**Titolo:** Remove unused component props and variables

**Descrizione:**
Removes 3 unused variables detected by TypeScript compiler:
- `DashboardView`: Props `list` and `onBack` declared but never used
- `defaults.ts`: Variable `scenarioSource` declared but never used

**Problema:**
- TypeScript warnings in build output
- Code smells suggesting incomplete refactoring
- Potential confusion for developers

**Soluzione:**
```typescript
// DashboardView.tsx
- export function DashboardView({ list, requirements, onBack, onSelectRequirement }: Props) {
+ export function DashboardView({ requirements, onSelectRequirement }: Props) {

// defaults.ts
- let scenarioSource = 'Default';
+ // Removed: unused variable
```

**Alternative scartate:**
- Prefix with `_` (antipattern, nasconde problema)
- Keep for future use (YAGNI violation)

**Rischi:** ❌ None - Props not accessed anywhere

**Test aggiunti:**
- ✅ Lint passes without warnings
- ✅ TypeScript build successful
- ✅ Component renders correctly

**Istruzioni di prova:**
```bash
git checkout refactor/remove-unused-vars
pnpm install
pnpm run lint  # Should pass without warnings
pnpm run build # Should complete successfully
pnpm run dev   # Test Dashboard view manually
```

**Tag:** `Low Risk` | `Low Effort` | `Code Quality`  
**Stima:** 30 minuti  
**Reviewer:** @tech-lead

---

### PR-02: `refactor/remove-deprecated`

**Titolo:** Remove deprecated handleSupabaseError function

**Descrizione:**
Removes `handleSupabaseError()` function from `supabase.ts`, already marked as `@deprecated` and replaced by `throwDbError()` from `dbErrors.ts`.

**Problema:**
- Dead code in codebase
- Function marked deprecated but not removed
- Potential confusion for new developers

**Soluzione:**
```typescript
// supabase.ts - REMOVE ENTIRE FUNCTION
/**
 * @deprecated Use throwDbError from dbErrors.ts instead
 */
export function handleSupabaseError(...) { ... }
```

**Verification:**
```bash
# Confirm no usages
grep -r "handleSupabaseError" src/
# Should return only the definition to be removed
```

**Alternative scartate:**
- Keep as fallback (not used anywhere)
- Refactor instead of remove (replacement already exists)

**Rischi:** ❌ None - Verified no imports via grep

**Test aggiunti:**
- ✅ Grep confirms no usages
- ✅ Build passes
- ✅ All error handling uses new `throwDbError()`

**Istruzioni di prova:**
```bash
git checkout refactor/remove-deprecated
pnpm install
pnpm run build
# Trigger some DB errors in UI - should still work
```

**Tag:** `Low Risk` | `Low Effort` | `Cleanup`  
**Stima:** 15 minuti  
**Reviewer:** @tech-lead

---

### PR-03: `docs/sourcemap-decision`

**Titolo:** Document sourcemap strategy for production builds

**Descrizione:**
Adds decision record for sourcemap configuration in Vite. Currently sourcemaps are disabled in production, but commented code suggests this was discussed.

**Problema:**
- Unclear decision rationale
- Comment at line 64 suggests unfinished decision
- Debugging production issues harder without sourcemaps

**Soluzione:**
Create ADR (Architecture Decision Record):

```markdown
# ADR-001: Sourcemap Strategy

## Status
Accepted

## Context
Vite allows sourcemaps in production for debugging, but exposes source code.

## Decision
Use 'hidden' sourcemaps in production:
- Sourcemaps generated but not referenced in bundle
- Can be uploaded to error tracking (Sentry, etc.)
- Source code not exposed to end users

## Consequences
- ✅ Debug production errors with stack traces
- ✅ Source code not exposed in browser
- ⚠️ Slightly larger build artifacts (+5-10%)
```

**Config change:**
```typescript
// vite.config.ts
sourcemap: mode === 'production' ? 'hidden' : true
```

**Alternative scartate:**
- `sourcemap: false` (current, hard to debug prod)
- `sourcemap: true` (exposes source code)
- External sourcemap server (overhead, complexity)

**Rischi:** ❌ None - Documentation only + safe config

**Test aggiunti:**
- ✅ Build with `pnpm run build`
- ✅ Verify `.map` files in `dist/` but not referenced
- ✅ Test error tracking integration (if applicable)

**Istruzioni di prova:**
```bash
git checkout docs/sourcemap-decision
pnpm run build
ls -la dist/assets/*.map  # Should exist
grep "sourceMappingURL" dist/assets/*.js  # Should NOT exist
```

**Tag:** `Low Risk` | `Low Effort` | `Documentation`  
**Stima:** 30 minuti  
**Reviewer:** @tech-lead

---

### PR-04: `refactor/auth-todo`

**Titolo:** Wire AuthContext to replace hardcoded user email

**Descrizione:**
Removes TODO comment and hardcoded `currentUser` in `Index.tsx`, replacing with actual `AuthContext` integration.

**Problema:**
```typescript
// Index.tsx:64
const currentUser = 'current.user@example.com'; // TODO: wire to auth
```
- Production code with TODO comment
- Hardcoded email breaks multi-user workflows
- Auth system exists but not used

**Soluzione:**
```typescript
// Index.tsx
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { currentUser, loading: authLoading } = useAuth();
  
  // Handle auth states
  if (authLoading) {
    return <LoadingSpinner />;
  }
  
  if (!currentUser) {
    return <AuthRequired />;
  }
  
  // Rest of component...
}
```

**Alternative scartate:**
- Keep TODO (tech debt accumulation)
- Use localStorage directly (AuthContext already exists)
- Feature flag (unnecessary complexity for core feature)

**Rischi:** ⚠️ Medium - Auth flow affects all users

**Mitigation:**
- Fallback to dev user in development mode
- Comprehensive E2E tests
- Staged rollout (staging → canary → prod)

**Test aggiunti:**
- ✅ Unit: AuthContext provides user
- ✅ Integration: Index renders with authenticated user
- ✅ E2E: Login → Create list → Logout flow
- ✅ Edge case: Expired session handling

**Checklist regressione:**
- [ ] Login with Supabase Auth works
- [ ] Fallback to localStorage in dev works
- [ ] Sign out clears session
- [ ] All CRUD operations use `currentUser`
- [ ] RLS policies enforce user isolation

**Istruzioni di prova:**
```bash
git checkout refactor/auth-todo
pnpm install

# Test dev fallback
pnpm run dev
# Should auto-login as dev user

# Test Supabase auth (if configured)
# 1. Login via UI
# 2. Create a list (should be owned by logged-in user)
# 3. Logout
# 4. Verify list not visible to other users
```

**Tag:** `Medium Risk` | `Medium Effort` | `Feature`  
**Stima:** 1.5 ore  
**Reviewer:** @tech-lead + @security

---

## 🔧 ONDA 2: Sprint (Dopo Onda 1 completata)

### PR-05: `feat/utility-helpers`

**Titolo:** Extract common utility helpers for data transformation

**Descrizione:**
Centralizes 3 frequently duplicated patterns:
1. `parseCSV(str)` - Parse comma-separated values
2. `extractIds<T>(items, key)` - Extract ID array from objects
3. `toggleArrayItem<T>(arr, item)` - Toggle item in array

**Problema:**
Codice duplicato in 15+ locations:
```typescript
// Pattern 1 (8 occorrenze)
.split(',').map(s => s.trim()).filter(Boolean)

// Pattern 2 (12 occorrenze)
requirements.map(r => r.req_id)

// Pattern 3 (6 occorrenze)
array.includes(value) ? array.filter(item => item !== value) : [...array, value]
```

**Soluzione:**
Create `src/lib/arrays.ts`:
```typescript
/**
 * Parse comma-separated string into array
 */
export function parseCSV(csv: string | undefined | null): string[] {
  if (!csv) return [];
  return csv.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Extract property values as array
 */
export function extractIds<T, K extends keyof T>(
  items: T[],
  key: K
): T[K][] {
  return items.map(item => item[key]);
}

/**
 * Toggle item in array (immutable)
 */
export function toggleArrayItem<T>(array: T[], item: T): T[] {
  return array.includes(item)
    ? array.filter(i => i !== item)
    : [...array, item];
}
```

**Refactor locations:**
- `RequirementsList.tsx`: 4 occurrences
- `DashboardView.tsx`: 3 occurrences
- `ExportDialog.tsx`: 2 occurrences
- `storage.ts`: 1 occurrence

**Alternative scartate:**
- Use lodash (bundle size overhead)
- Keep duplicated (maintenance burden)

**Rischi:** ⚠️ Low - Pure functions, easy to test

**Test aggiunti:**
See `Patch 2` in main audit report for full test suite.

**Tag:** `Low Risk` | `Medium Effort` | `Refactor`  
**Stima:** 4 ore (refactor + tests + review)

---

### PR-06: `refactor/use-selection-hook`

**Titolo:** Extract selection logic into reusable useSelection hook

**Descrizione:**
Creates `useSelection<T>()` hook for managing multi-select state with toggle, select-all, and filter capabilities.

**Problema:**
Selection logic duplicated in:
- `RequirementsList.tsx` (filter selection)
- `EstimateEditor.tsx` (activity selection)
- `DashboardView.tsx` (priority filter)

**Soluzione:**
```typescript
// hooks/useSelection.ts
export function useSelection<T>(
  allItems: T[],
  keyExtractor: (item: T) => string | number = item => item
) {
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  
  const toggle = (item: T) => {
    const key = keyExtractor(item);
    const newSelected = new Set(selected);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelected(newSelected);
  };
  
  const selectAll = () => {
    setSelected(new Set(allItems.map(keyExtractor)));
  };
  
  const deselectAll = () => {
    setSelected(new Set());
  };
  
  const isSelected = (item: T) => selected.has(keyExtractor(item));
  
  return {
    selected: Array.from(selected),
    toggle,
    selectAll,
    deselectAll,
    isSelected,
    selectedCount: selected.size,
  };
}
```

**Usage:**
```typescript
// Before
const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
// 20 lines of toggle/selectAll logic...

// After
const activitySelection = useSelection(
  activities,
  activity => activity.activity_code
);
```

**Alternative scartate:**
- Keep duplicated (DRY violation)
- Use external library (unnecessary dependency)

**Rischi:** ⚠️ Medium - Affects multiple components

**Test aggiunti:**
```typescript
describe('useSelection', () => {
  it('toggles selection', () => { ... });
  it('selects all items', () => { ... });
  it('deselects all items', () => { ... });
  it('tracks selection count', () => { ... });
});
```

**Tag:** `Medium Risk` | `Medium Effort` | `Refactor`  
**Stima:** 6 ore

---

### PR-07: `test/calculation-coverage`

**Titolo:** Add comprehensive unit tests for calculation engine

**Descrizione:**
Adds 90% test coverage for `src/lib/calculations.ts` - the most critical business logic module.

**Problema:**
- ❌ **CRITICO:** Zero test coverage per formule di calcolo
- Bug potenziali non rilevati (es: contingency calculation)
- Refactor futuro rischioso senza safety net

**Soluzione:**
Full test suite per tutte le funzioni:
```typescript
// calculations.test.ts
- calculateDriverMultiplier() - 5 test cases
- calculateRiskScore() - 4 test cases
- getContingencyPercentage() - 6 test cases + edge cases
- calculateEstimate() - 8 integration tests
- Dashboard KPIs - 10 tests
```

See `Patch 3` in main audit report for complete test implementation.

**Coverage target:**
```bash
File                   | % Stmts | % Branch | % Funcs | % Lines
-----------------------|---------|----------|---------|--------
calculations.ts        |   92.5  |   88.3   |   100   |  92.5
```

**Alternative scartate:**
- Manual testing (non scalable, error-prone)
- Integration tests only (too slow, hard to debug)

**Rischi:** ❌ None - Tests don't change behavior

**Test aggiunti:**
- ✅ 30+ unit tests
- ✅ Edge cases (empty arrays, nulls, zero values)
- ✅ Property-based tests for mathematical invariants

**Tag:** `Low Risk` | `High Effort` | `Testing`  
**Stima:** 8 ore

---

### PR-08: `refactor/estimate-editor-logic`

**Titolo:** Separate business logic from EstimateEditor UI component

**Descrizione:**
Extracts calculation and state management logic from 700-line `EstimateEditor.tsx` into dedicated hooks and services.

**Problema:**
- 700 LOC component mixing UI + business logic
- Hard to test calculation logic
- Difficult to reuse logic elsewhere

**Soluzione:**
```typescript
// hooks/useEstimateCalculation.ts
export function useEstimateCalculation(requirement: Requirement) {
  // State management
  // Calculation logic
  // Defaults handling
  return { estimate, calculate, save, errors };
}

// EstimateEditor.tsx (now 300 LOC)
export function EstimateEditor({ requirement, onSave }: Props) {
  const { estimate, calculate, save, errors } = useEstimateCalculation(requirement);
  
  // Only UI rendering
  return (...)
}
```

**Separation layers:**
1. **Presentation** (EstimateEditor.tsx) - UI only
2. **Business Logic** (useEstimateCalculation hook)
3. **Data Access** (storage.ts) - Already separated ✅

**Alternative scartate:**
- Keep monolithic (maintenance nightmare)
- Split into multiple components (over-engineering)

**Rischi:** ⚠️ Medium - Core feature refactor

**Test aggiunti:**
- ✅ Hook tests (calculation logic)
- ✅ Component tests (UI rendering)
- ✅ Integration tests (full flow)

**Tag:** `Medium Risk` | `High Effort` | `Refactor`  
**Stima:** 8 ore

---

### PR-09: `feat/error-toast-hook`

**Titolo:** Centralize error toast pattern with useErrorToast hook

**Descrizione:**
Creates `useErrorToast()` hook to standardize error display across the app.

**Problema:**
Duplicated error handling pattern in 8+ components:
```typescript
try {
  await storage.save(data);
} catch (error) {
  toast.error(error instanceof Error ? error.message : 'Errore');
}
```

**Soluzione:**
```typescript
// hooks/useErrorToast.ts
export function useErrorToast() {
  return useCallback((error: unknown, fallback = 'Operazione fallita') => {
    const message = error instanceof Error ? error.message : fallback;
    toast.error(message);
    logger.error('User-facing error:', error);
  }, []);
}

// Usage
const showError = useErrorToast();

try {
  await storage.save(data);
} catch (error) {
  showError(error, 'Impossibile salvare');
}
```

**Benefits:**
- Consistent error formatting
- Centralized logging
- Easier to add error tracking (Sentry, etc.)

**Alternative scartate:**
- Keep duplicated (maintenance burden)
- Error boundary only (doesn't handle async errors)

**Rischi:** ⚠️ Low - Additive change

**Test aggiunti:**
- ✅ Hook displays error messages
- ✅ Logs to logger
- ✅ Handles different error types

**Tag:** `Low Risk` | `Low Effort` | `Feature`  
**Stima:** 3 ore

---

### PR-10: `feat/auth-complete`

**Titolo:** Complete Supabase Auth integration with RLS testing

**Descrizione:**
Completes authentication system:
1. Remove localStorage fallback (dev-only)
2. Implement proper login/signup UI
3. Test RLS policies with real sessions
4. Add session refresh logic

**Problema:**
- Auth system partially implemented
- localStorage fallback security risk if leaked to prod
- RLS policies not tested with real auth

**Soluzione:**
```typescript
// pages/Login.tsx (new)
export function Login() {
  const { signIn } = useAuth();
  
  const handleLogin = async (email: string, password: string) => {
    const { error } = await signIn(email, password);
    if (error) showError(error);
  };
  
  return <LoginForm onSubmit={handleLogin} />;
}

// AuthContext.tsx (updated)
- Remove localStorage fallback
- Add session refresh
- Add proper error handling
```

**Checklist:**
- [ ] Login/Signup UI
- [ ] Email verification flow
- [ ] Password reset
- [ ] Session persistence
- [ ] Auto-refresh tokens
- [ ] RLS policy testing
- [ ] Multi-user isolation tests

**Alternative scartate:**
- Keep TODO (tech debt)
- Custom auth (reinvent wheel)
- Firebase Auth (vendor lock-in)

**Rischi:** 🔴 High - Core security feature

**Mitigation:**
- Feature flag for gradual rollout
- Extensive E2E tests
- Staging environment validation
- Rollback plan

**Test aggiunti:**
- ✅ E2E: Full auth flows
- ✅ Security: RLS isolation
- ✅ Performance: Session refresh
- ✅ Accessibility: Keyboard nav

**Tag:** `High Risk` | `High Effort` | `Security`  
**Stima:** 12 ore

---

## 🏗️ ONDA 3: Hardening (Roadmap 1-2 mesi)

### PR-11: `feat/schema-validation`

**Schema Validation con Zod**

**Scope:**
- Form validation
- API request/response validation
- Type-safe schemas

**Effort:** 12 ore

---

### PR-12: `refactor/requirements-list`

**Extract RequirementsList filter logic**

**Scope:**
- Hook `useRequirementFilters()`
- Reduce component to 150 LOC
- Full test coverage

**Effort:** 16 ore

---

### PR-13: `test/e2e-cypress`

**E2E Test Suite con Cypress**

**Scope:**
- Critical user paths
- Visual regression tests
- Performance benchmarks

**Effort:** 24 ore

---

### PR-14: `feat/i18n-extraction`

**Internationalization Setup**

**Scope:**
- Extract all Italian strings
- i18next configuration
- English translation

**Effort:** 20 ore

---

### PR-15: `perf/memoization`

**Performance Optimization**

**Scope:**
- React.memo for expensive components
- useMemo for calculations
- useCallback for handlers
- Bundle size optimization

**Effort:** 8 ore

---

### PR-16: `a11y/audit-fix`

**Accessibility Improvements**

**Scope:**
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- Color contrast fixes

**Effort:** 12 ore

---

## 📊 PR Metrics Dashboard

| Onda | # PRs | Tot Ore | Rischio Medio | Ready Date |
|------|-------|---------|---------------|------------|
| 1    | 4     | 3h      | Low           | +1 giorno  |
| 2    | 6     | 41h     | Medium        | +2 sett    |
| 3    | 6     | 92h     | Medium        | +4 sett    |
| **Tot** | **16** | **136h** | - | **~8 settimane** |

---

## ✅ Review Checklist (Template per ogni PR)

### Pre-Review
- [ ] Self-review del codice
- [ ] Tutti i test passano
- [ ] Lint warnings risolti
- [ ] Build completa senza errori
- [ ] Performance non degradata
- [ ] Bundle size non aumentato >10%
- [ ] Documentazione aggiornata

### Code Review
- [ ] Business logic corretta
- [ ] Error handling adeguato
- [ ] Type safety mantenuta
- [ ] No security issues
- [ ] Backward compatibility preservata
- [ ] Naming conventions rispettate
- [ ] Comments su codice complesso

### Testing
- [ ] Unit tests coprono edge cases
- [ ] Integration tests passano
- [ ] Manual testing completato
- [ ] Regression tests passano
- [ ] Accessibility verificata (se UI change)

### Deployment
- [ ] Staging validation
- [ ] Rollback plan documentato
- [ ] Monitoring setup (se applicabile)
- [ ] Release notes preparate

---

## 🚀 Deployment Strategy

### Staging First
```bash
# Deploy to staging
git push origin refactor/BRANCH_NAME
# CI/CD auto-deploys to staging.example.com

# Smoke test
npm run test:e2e:staging

# Approval gate
# → Tech Lead approves
```

### Canary Release (Onda 2-3)
```bash
# Deploy to 10% users
kubectl set image deployment/app app=v2.0.0-canary

# Monitor metrics for 24h
# - Error rate
# - Response time
# - User feedback

# If OK → Full rollout
kubectl set image deployment/app app=v2.0.0
```

### Rollback Procedure
```bash
# Immediate rollback if critical issue
kubectl rollout undo deployment/app

# Or point-in-time
git revert <commit-hash>
git push origin main
```

---

## 📞 Support & Questions

**Per domande su questo piano:**
- Slack: #eng-refactoring
- Email: tech-lead@company.com
- Office Hours: Martedì 15:00-16:00

**Per emergenze in produzione:**
- PagerDuty: On-call rotation
- Slack: #incidents
- Runbook: `docs/RUNBOOK.md`

---

**Creato:** 9 Novembre 2025  
**Versione:** 1.0  
**Prossimo Review:** Dopo Onda 1 completata
