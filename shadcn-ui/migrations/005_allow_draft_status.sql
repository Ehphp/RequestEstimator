/*
  Migration 005: Allow Draft status on lists
  -----------------------------------------
  Scopo: allineare il dominio applicativo (Draft/Active/Archived) con i vincoli
  database, reintroducendo lo stato "Draft" precedentemente bloccato dal check.

  NOTE OPERATIVE:
  - Eseguire prima in staging: BEGIN; ... ROLLBACK per dry-run.
  - Applicare poi in produzione durante una finestra sicura.
  - Il check viene ricreato in place per evitare lock prolungati.
  - Rollback: reimpostare il constraint con soli ('Active','Archived').
*/

BEGIN;

-- Rimuovi il check precedente se esiste
ALTER TABLE app_5939507989_lists
  DROP CONSTRAINT IF EXISTS chk_lists_status;

-- Nuovo vincolo con supporto a Draft
ALTER TABLE app_5939507989_lists
  ADD CONSTRAINT chk_lists_status
  CHECK (status IN ('Draft', 'Active', 'Archived'));

COMMIT;
