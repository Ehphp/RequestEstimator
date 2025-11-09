import { Activity, Driver, Risk, ContingencyBand } from '../types';

export const activities: Activity[] = [
  // ANALYSIS
  {
    activity_code: 'ANL_ALIGN',
    display_name: 'Analysis Alignment',
    driver_group: 'Analysis',
    base_days: 0.5,
    helper_short: 'Allinea obiettivo e regole con gli stakeholder. Usalo all\'avvio o quando cambiano stati/ruoli. Output: note, edge case, criteri UAT.',
    helper_long: `**Cosa è:** mini-analisi per chiarire obiettivi, attori, regole.

**Quando serve:** quasi sempre all'inizio; obbligatoria per HR/Finance.

**Input:** richiesta di business, flow attuale.

**Output:** decision log, edge case, criteri UAT.

**Pitfall:** requisiti impliciti; destinatari incompleti.

**DoD:** obiettivo, happy path, 3 edge case approvati.`,
    status: 'Active'
  },
  // DATAVERSE
  {
    activity_code: 'DV_FIELD',
    display_name: 'Dataverse Field Creation',
    driver_group: 'Dataverse',
    base_days: 0.25,
    helper_short: 'Crea/aggiorna campi (flag, lookup, date). Serve per nuovi dati/logic. Output: campo + audit/ruoli.',
    helper_long: `**Cosa è:** creazione/aggiornamento campi Dataverse.

**Quando serve:** per nuovi dati o logiche.

**Input:** tipo campo, default, visibilità.

**Output:** metadata, security.

**Pitfall:** type errato, no audit.

**DoD:** campo funzionante con audit e security.`,
    status: 'Active'
  },
  {
    activity_code: 'DV_FORM',
    display_name: 'Dataverse Form Design',
    driver_group: 'Dataverse',
    base_days: 0.5,
    helper_short: 'Aggiorna form (visibilità, validazioni, BR/JS). Serve quando aggiungi campi o cambi UX. Output: form salvabile, regole attive.',
    helper_long: `**Cosa è:** design e configurazione form Dataverse.

**Quando serve:** aggiunta campi o cambio UX.

**Input:** layout requirements, business rules.

**Output:** form configurato con validazioni.

**Pitfall:** performance, localizzazione.

**DoD:** form funzionante con BR/JS attivi.`,
    status: 'Active'
  },
  {
    activity_code: 'WF_HOOK',
    display_name: 'Workflow Hook',
    driver_group: 'Dataverse',
    base_days: 0.5,
    helper_short: 'Transizione di stato/hook di processo. Usalo se l\'evento cambia fase. Output: stato aggiornato, KPI coerenti.',
    helper_long: `**Cosa è:** gestione transizioni di stato e hook di processo.

**Quando serve:** quando eventi cambiano fasi.

**Input:** stati e transizioni richieste.

**Output:** stati aggiornati, KPI coerenti.

**Pitfall:** condizioni complesse, idempotenza.

**DoD:** transizioni funzionanti con KPI.`,
    status: 'Active'
  },
  // AUTOMATION
  {
    activity_code: 'PA_FLOW',
    display_name: 'Power Automate Flow',
    driver_group: 'Automation',
    base_days: 0.5,
    helper_short: 'Nuovo flow con trigger Dataverse/HTTP. Per notifiche e sync deterministici. Output: flow attivo, 3 run ok.',
    helper_long: `**Cosa è:** creazione flow Power Automate.

**Quando serve:** per notifiche e sincronizzazioni.

**Input:** trigger e azioni richieste.

**Output:** flow attivo e testato.

**Pitfall:** trigger filtrato, idempotenza, retry.

**DoD:** flow con 3 run successful.`,
    status: 'Active'
  },
  {
    activity_code: 'PA_CHILD',
    display_name: 'Power Automate Child Flow',
    driver_group: 'Automation',
    base_days: 0.25,
    helper_short: 'Flow riusabile per email/azioni comuni. Output: interfaccia stabile.',
    helper_long: `**Cosa è:** flow riusabile per azioni comuni.

**Quando serve:** per standardizzare azioni ricorrenti.

**Input:** parametri e schema interfaccia.

**Output:** child flow riusabile.

**Pitfall:** schema parametri, versioning.

**DoD:** interfaccia stabile e compatibile.`,
    status: 'Active'
  },
  // COMMS
  {
    activity_code: 'MAIL_TEMP',
    display_name: 'Email Template',
    driver_group: 'Comms',
    base_days: 0.25,
    helper_short: 'Template email (placeholders/oggetto). Output: rendering ok, destinatari corretti.',
    helper_long: `**Cosa è:** creazione template email.

**Quando serve:** per comunicazioni standardizzate.

**Input:** copy e placeholders.

**Output:** template funzionante.

**Pitfall:** routing, localizzazione.

**DoD:** rendering corretto con destinatari.`,
    status: 'Active'
  },
  {
    activity_code: 'RECIP_CONF',
    display_name: 'Recipient Configuration',
    driver_group: 'Comms',
    base_days: 0.25,
    helper_short: 'Regole destinatari/CC (lookup/liste). Output: nessun duplicato, 3 casi coperti.',
    helper_long: `**Cosa è:** configurazione regole destinatari.

**Quando serve:** per routing email complesso.

**Input:** tabelle routing e owners.

**Output:** regole senza duplicati.

**Pitfall:** eccezioni, owners multipli.

**DoD:** 3 casi di routing testati.`,
    status: 'Active'
  },
  // QUALITY
  {
    activity_code: 'E2E_TEST',
    display_name: 'End-to-End Testing',
    driver_group: 'Quality',
    base_days: 0.5,
    helper_short: 'Test completo dal trigger al risultato. Output: report esiti + fix.',
    helper_long: `**Cosa è:** test completo end-to-end.

**Quando serve:** per validare flussi completi.

**Input:** script e dati seme.

**Output:** report con esiti.

**Pitfall:** edge cases, log.

**DoD:** test passati con report.`,
    status: 'Active'
  },
  {
    activity_code: 'UAT_RUN',
    display_name: 'User Acceptance Testing',
    driver_group: 'Quality',
    base_days: 0.5,
    helper_short: 'Sessione con utenti; approvazione o backlog.',
    helper_long: `**Cosa è:** sessione UAT con utenti finali.

**Quando serve:** per approvazione finale.

**Input:** criteri, agenda, dati.

**Output:** approvazione o backlog.

**Pitfall:** aspettative non allineate.

**DoD:** sessione completata con esiti.`,
    status: 'Active'
  },
  // GOVERNANCE
  {
    activity_code: 'DOC_HAND',
    display_name: 'Documentation & Handover',
    driver_group: 'Governance',
    base_days: 0.25,
    helper_short: 'Doc tecnica + runbook. Output: README/changelog.',
    helper_long: `**Cosa è:** documentazione tecnica e handover.

**Quando serve:** per trasferimento conoscenza.

**Input:** trigger, parametri, ownership.

**Output:** README e changelog.

**Pitfall:** documentazione obsoleta.

**DoD:** doc completa e aggiornata.`,
    status: 'Active'
  },
  {
    activity_code: 'DEPLOY',
    display_name: 'Deploy DEV→TEST→PROD',
    driver_group: 'Governance',
    base_days: 0.25,
    helper_short: 'Import soluzione + smoke test. Output: flow ON, log puliti.',
    helper_long: `**Cosa è:** deployment attraverso ambienti.

**Quando serve:** per rilascio in produzione.

**Input:** variabili ambiente, connessioni.

**Output:** deployment successful.

**Pitfall:** post-deploy checks.

**DoD:** flow attivi con log puliti.`,
    status: 'Active'
  },
  // ANALYTICS
  {
    activity_code: 'KPI_RPT',
    display_name: 'Reporting/KPI Adjustment',
    driver_group: 'Analytics',
    base_days: 0.5,
    helper_short: 'Allinea KPI/report a nuovi stati/campi. Output: dashboard coerenti.',
    helper_long: `**Cosa è:** allineamento KPI e report.

**Quando serve:** per nuovi stati/campi.

**Input:** modello, misure.

**Output:** dashboard coerenti.

**Pitfall:** metriche inconsistenti.

**DoD:** dashboard funzionanti e testati.`,
    status: 'Active'
  }
];

export const drivers: Driver[] = [
  // Complexity
  { driver: 'complexity', option: 'Low', multiplier: 0.8, explanation: 'Requisito semplice, logica lineare' },
  { driver: 'complexity', option: 'Medium', multiplier: 1.0, explanation: 'Complessità standard, alcune condizioni' },
  { driver: 'complexity', option: 'High', multiplier: 1.5, explanation: 'Logica complessa, molte condizioni e eccezioni' },

  // Environments
  { driver: 'environments', option: '1 env', multiplier: 0.7, explanation: 'Solo ambiente di sviluppo' },
  { driver: 'environments', option: '2 env', multiplier: 1.0, explanation: 'Dev + Test o Dev + Prod' },
  { driver: 'environments', option: '3 env', multiplier: 1.3, explanation: 'Dev + Test + Prod completi' },

  // Reuse
  { driver: 'reuse', option: 'High', multiplier: 0.6, explanation: 'Riutilizzo elevato di componenti esistenti' },
  { driver: 'reuse', option: 'Medium', multiplier: 1.0, explanation: 'Parziale riutilizzo di componenti' },
  { driver: 'reuse', option: 'Low', multiplier: 1.4, explanation: 'Sviluppo prevalentemente ex-novo' },

  // Stakeholders
  { driver: 'stakeholders', option: '1 team', multiplier: 0.8, explanation: 'Singolo team coinvolto' },
  { driver: 'stakeholders', option: '2-3 team', multiplier: 1.0, explanation: 'Coordinamento tra pochi team' },
  { driver: 'stakeholders', option: '4+ team', multiplier: 1.4, explanation: 'Coordinamento complesso multi-team' }
];

export const risks: Risk[] = [
  // TECHNICAL RISKS (Power Platform specific)
  {
    risk_id: 'T001',
    risk_item: 'Connettori Premium non testati',
    category: 'Technical',
    weight: 4,
    guidance: 'Connettori premium (SAP, Salesforce) non validati in ambiente. Mitiga: PoC su connettore, test licenze.',
    mitigation: 'Creare ambiente test con licenze premium, validare API limits e throttling'
  },
  {
    risk_id: 'T002',
    risk_item: 'Limiti API/throttling',
    category: 'Technical',
    weight: 5,
    guidance: 'Volumi elevati possono superare limiti Dataverse/Power Automate (24h limits, 5min window). Mitiga: batch, retry exponential.',
    mitigation: 'Implementare batching, exponential backoff, monitoring dei limiti API'
  },
  {
    risk_id: 'T003',
    risk_item: 'Performance su dataset grandi',
    category: 'Technical',
    weight: 5,
    guidance: 'Canvas app lenta su tabelle >5K record, form complessi. Mitiga: delegation, indexing, data virtualization.',
    mitigation: 'Verificare delegation patterns, ottimizzare query, usare views con filtri'
  },
  {
    risk_id: 'T004',
    risk_item: 'Plugin C# complessi',
    category: 'Technical',
    weight: 6,
    guidance: 'Business logic complessa richiede custom plugin oltre le capacità low-code. Mitiga: spike tecnico, sandbox test.',
    mitigation: 'Spike di 1-2gg per validare fattibilità, setup ambiente debug plugin'
  },

  // BUSINESS RISKS
  {
    risk_id: 'B001',
    risk_item: 'Requisiti instabili/scope creep',
    category: 'Business',
    weight: 5,
    guidance: 'Requisiti cambiano frequentemente durante sviluppo. Mitiga: demo iterative, sign-off incrementali.',
    mitigation: 'Demo bisettimanali, documentare change requests, freeze scope per sprint'
  },
  {
    risk_id: 'B002',
    risk_item: 'Stakeholder non disponibili',
    category: 'Business',
    weight: 4,
    guidance: 'Business owner/SME non disponibili per chiarimenti. Mitiga: pre-book slot, decision log documentato.',
    mitigation: 'Bloccare slot ricorrenti, escalation path chiaro, decision log condiviso'
  },
  {
    risk_id: 'B003',
    risk_item: 'Competenze team limitate',
    category: 'Business',
    weight: 5,
    guidance: 'Team poco esperto su Power Platform o dominio business. Mitiga: pairing, training, spike tecnici.',
    mitigation: 'Pair programming, workshop interni, allocare tempo per spike e learning'
  },

  // GOVERNANCE RISKS
  {
    risk_id: 'G001',
    risk_item: 'Licensing non chiaro',
    category: 'Governance',
    weight: 4,
    guidance: 'Incertezza su licenze richieste (per-app, per-user, premium). Mitiga: validation licensing upfront.',
    mitigation: 'Validare licensing requirements con Microsoft, ottenere approvazione procurement'
  },
  {
    risk_id: 'G002',
    risk_item: 'ALM/pipeline non configurati',
    category: 'Governance',
    weight: 5,
    guidance: 'Ambiente DEV/TEST/PROD non configurati, nessuna pipeline CI/CD. Mitiga: setup upfront environments.',
    mitigation: 'Setup ambienti prima dello sviluppo, configurare Azure DevOps/GitHub Actions'
  },
  {
    risk_id: 'G003',
    risk_item: 'Security/DLP policies blocchi',
    category: 'Governance',
    weight: 6,
    guidance: 'DLP policy aziendali bloccano connettori richiesti. Mitiga: validation policy upfront, richiesta eccezioni.',
    mitigation: 'Verificare DLP policies prima dello sviluppo, aprire ticket eccezioni con governance'
  },

  // INTEGRATION RISKS
  {
    risk_id: 'I001',
    risk_item: 'Sistemi legacy non documentati',
    category: 'Integration',
    weight: 5,
    guidance: 'Integrazione con sistemi legacy senza API/documentazione. Mitiga: reverse engineering, interfaccia adapter.',
    mitigation: 'Allocare tempo per analisi sistema target, creare layer adapter se necessario'
  },
  {
    risk_id: 'I002',
    risk_item: 'Dipendenze team esterni',
    category: 'Integration',
    weight: 4,
    guidance: 'Dipendenza da altri team IT per API/accessi. Mitiga: early engagement, mock per sviluppo parallelo.',
    mitigation: 'Coinvolgere team esterni da subito, creare mock API per sviluppo indipendente'
  },
  {
    risk_id: 'I003',
    risk_item: 'Network/firewall restrictions',
    category: 'Integration',
    weight: 4,
    guidance: 'Firewall aziendali bloccano chiamate API cloud. Mitiga: validation infrastruttura, on-premise gateway.',
    mitigation: 'Test connectivity upfront, configurare on-premise data gateway se necessario'
  }
];

export const contingencyBands: ContingencyBand[] = [
  { band: 'Low', level: '0-10 punti rischio', contingency_pct: 0.10 },
  { band: 'Medium', level: '11-20 punti rischio', contingency_pct: 0.20 },
  { band: 'High', level: '21+ punti rischio', contingency_pct: 0.35 }
];