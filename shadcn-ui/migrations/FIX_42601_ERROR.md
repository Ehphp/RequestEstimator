# FIX PER ERRORE "query has no destination for result data"

## 🔴 Problema

Quando si tenta di salvare un requisito, si riceve l'errore:
```
POST .../app_5939507989_requirements?on_conflict=req_id 400 (Bad Request)
Database error: {type: 'unknown', code: '42601', originalMessage: 'query has no destination for result data'}
```

## 🔍 Causa

L'errore PostgreSQL `42601` con il messaggio "query has no destination for result data" si verifica quando:
- Esiste un **trigger** o una **funzione** sulla tabella `app_5939507989_requirements`
- Questo trigger/funzione contiene una query `SELECT` senza destinazione (senza `INTO` o `RETURN`)

Esempio di codice problematico:
```sql
CREATE FUNCTION bad_function() RETURNS TRIGGER AS $$
BEGIN
    SELECT column FROM table;  -- ❌ Errore: nessuna destinazione per il risultato
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## ✅ Soluzione

### Opzione 1: Via Supabase SQL Editor (CONSIGLIATO)

1. **Vai al Supabase Dashboard**
   - Apri: https://pdestnwyumcntpgqstii.supabase.co
   - Vai a: **SQL Editor**

2. **Esegui lo script diagnostico**
   
   Copia e incolla questa query per vedere i trigger attivi:
   ```sql
   SELECT 
       tgname AS trigger_name,
       tgtype AS trigger_type,
       tgenabled AS enabled,
       proname AS function_name
   FROM pg_trigger t
   JOIN pg_class c ON t.tgrelid = c.oid
   JOIN pg_proc p ON t.tgfoid = p.oid
   WHERE c.relname = 'app_5939507989_requirements'
   AND tgname NOT LIKE 'RI_%'
   ORDER BY tgname;
   ```

3. **Elimina i trigger problematici**
   
   Se vedi dei trigger (diversi da `RI_*` che sono per le foreign key), eliminali con:
   ```sql
   -- Sostituisci <nome_trigger> con il nome effettivo
   DROP TRIGGER IF EXISTS <nome_trigger> ON app_5939507989_requirements;
   ```

   Oppure esegui direttamente questo cleanup generale:
   ```sql
   -- Drop comuni trigger da migration 003 (se applicati per errore)
   DROP TRIGGER IF EXISTS trg_audit_requirements ON app_5939507989_requirements;
   DROP TRIGGER IF EXISTS trg_update_requirement_timestamp ON app_5939507989_requirements;
   ```

4. **Verifica la rimozione**
   ```sql
   -- Dovrebbe restituire nessun risultato (o solo RI_*)
   SELECT tgname FROM pg_trigger t
   JOIN pg_class c ON t.tgrelid = c.oid
   WHERE c.relname = 'app_5939507989_requirements'
   AND tgname NOT LIKE 'RI_%';
   ```

5. **Testa l'app**
   - Torna all'applicazione
   - Riprova a creare un requisito
   - Dovrebbe funzionare senza errori

### Opzione 2: Script Completo (All-in-One)

Esegui tutto lo script `999_diagnose_and_fix.sql` nel SQL Editor di Supabase:

```sql
-- File: migrations/999_diagnose_and_fix.sql
-- (Aprilo e copialo nel SQL Editor)
```

## 🔍 Debugging Avanzato

Se dopo aver rimosso i trigger l'errore persiste:

### 1. Controlla le funzioni che referenziano requirements

```sql
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
WHERE pg_get_functiondef(p.oid) LIKE '%app_5939507989_requirements%'
ORDER BY p.proname;
```

### 2. Cerca SELECT senza destinazione

Nelle funzioni trovate, cerca pattern come:
```sql
-- ❌ PROBLEMATICO:
SELECT something FROM table;

-- ✅ CORRETTO:
SELECT something INTO variable FROM table;
-- oppure
RETURN (SELECT something FROM table);
```

### 3. Controlla anche la tabella estimates

L'errore potrebbe essere anche su `app_5939507989_estimates` se ci sono trigger collegati:

```sql
SELECT tgname, proname
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'app_5939507989_estimates'
AND tgname NOT LIKE 'RI_%';
```

## 📋 Checklist Post-Fix

Dopo aver applicato la soluzione, verifica:

- [ ] Nessun trigger attivo su `app_5939507989_requirements` (tranne RI_*)
- [ ] Puoi creare un nuovo requisito dall'app
- [ ] Puoi modificare un requisito esistente
- [ ] Puoi eliminare un requisito
- [ ] Nessun errore 42601 nei log del browser

## ⚠️ Prevenzione Futura

Per evitare che questo errore si ripeta:

1. **Non applicare `migrations/003_triggers.sql`** senza testing approfondito
   - Quei trigger sono commentati per un motivo
   - Richiedono validazione accurata del codice PL/pgSQL

2. **Se vuoi audit log**, usa invece:
   - Supabase Realtime per il tracking
   - Application-level logging
   - Supabase Functions con webhook

3. **Prima di applicare trigger custom**:
   - Testa in ambiente di sviluppo
   - Usa RAISE NOTICE per debug
   - Verifica che ogni SELECT abbia destinazione

## 🆘 Se il Problema Persiste

Se dopo aver seguito questi passi l'errore continua:

1. **Esporta il risultato delle query diagnostiche**:
   ```sql
   -- Query 1: Tutti i trigger
   SELECT * FROM pg_trigger WHERE tgrelid = 'app_5939507989_requirements'::regclass;
   
   -- Query 2: Definizione funzioni
   SELECT proname, pg_get_functiondef(oid) FROM pg_proc 
   WHERE proname LIKE '%requirement%' OR proname LIKE '%audit%';
   ```

2. **Condividi:**
   - Screenshot dell'errore completo dal browser console
   - Output delle query diagnostiche
   - Qualsiasi migration SQL che hai eseguito manualmente

3. **Workaround temporaneo**:
   - Disabilita temporaneamente tutti i trigger sulla tabella:
   ```sql
   ALTER TABLE app_5939507989_requirements DISABLE TRIGGER ALL;
   ```
   - ⚠️ Attenzione: questo disabilita anche le foreign key constraints!
   - Riabilita dopo aver identificato il problema:
   ```sql
   ALTER TABLE app_5939507989_requirements ENABLE TRIGGER ALL;
   ```

## 📚 Riferimenti

- **PostgreSQL Error 42601**: https://www.postgresql.org/docs/current/errcodes-appendix.html
- **PL/pgSQL Trigger Functions**: https://www.postgresql.org/docs/current/plpgsql-trigger.html
- **Supabase Database Functions**: https://supabase.com/docs/guides/database/functions

---

**Ultima modifica:** 2025-11-10  
**Priorità:** 🔴 CRITICA  
**Impatto:** Blocca creazione/modifica requisiti
