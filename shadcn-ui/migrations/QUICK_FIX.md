# 🚨 QUICK FIX - Errore Salvataggio Requisito

## Problema
Errore 400 quando si salva un requisito: **"query has no destination for result data"**

## Soluzione Rapida (5 minuti)

### 1️⃣ Apri Supabase SQL Editor
- Vai su: https://pdestnwyumcntpgqstii.supabase.co
- Clicca su **SQL Editor** nel menu laterale

### 2️⃣ Copia e Incolla questo Codice

```sql
-- STEP 1: Vedi quali trigger ci sono
SELECT tgname 
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'app_5939507989_requirements'
AND tgname NOT LIKE 'RI_%';

-- STEP 2: Elimina i trigger problematici
DROP TRIGGER IF EXISTS trg_audit_requirements ON app_5939507989_requirements;
DROP TRIGGER IF EXISTS trg_update_requirement_timestamp ON app_5939507989_requirements;

-- STEP 3: Verifica (dovrebbe essere vuoto)
SELECT tgname 
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'app_5939507989_requirements'
AND tgname NOT LIKE 'RI_%';
```

### 3️⃣ Testa
- Torna all'app
- Riprova a creare un requisito
- ✅ Dovrebbe funzionare!

---

## Documentazione Completa
Vedi: [FIX_42601_ERROR.md](./FIX_42601_ERROR.md) per dettagli e troubleshooting avanzato.

## Script Diagnostico Completo
Vedi: [999_diagnose_and_fix.sql](./999_diagnose_and_fix.sql) per lo script SQL completo.
