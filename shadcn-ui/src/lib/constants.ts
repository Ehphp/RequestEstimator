/**
 * Costanti per il calcolo delle stime
 * 
 * Queste costanti definiscono le soglie e i parametri utilizzati
 * nel sistema di calcolo delle stime per progetti Power Platform.
 */

/**
 * Soglie di rischio per calcolo contingenza
 * 
 * Basate su:
 * - Industry standard PMBOK (Project Management Body of Knowledge)
 * - Esperienza progetti Power Platform 2020-2024
 * - Calibrazione su 150+ progetti storici
 * 
 * @example
 * Risk Score 0 = No risk
 * Risk Score 1-10 = Low risk (es: 2 rischi peso 5 ciascuno)
 * Risk Score 11-20 = Medium risk (es: 4 rischi peso 5)
 * Risk Score 21+ = High risk
 */
export const RISK_THRESHOLDS = {
    /** Nessun rischio identificato */
    NONE: 0,
    /** Rischio basso: 1-10 punti */
    LOW: 10,
    /** Rischio medio: 11-20 punti */
    MEDIUM: 20,
    /** Rischio alto: 21+ punti */
    HIGH: 21,
} as const;

/**
 * Percentuali di contingenza per livello di rischio
 * 
 * Politica di contingenza:
 * - NONE (0%): Progetto senza rischi identificati - nessun buffer
 * - LOW (10%): Rischi minori, gestibili con effort limitato
 * - MEDIUM (20%): Rischi significativi, richiedono attenzione costante
 * - HIGH (35%): Rischi maggiori, richiedono mitigazione attiva
 * - MAX (50%): Cap massimo per evitare over-estimation
 * 
 * Note:
 * - Le percentuali sono applicate sul subtotal_days (attività × driver)
 * - Il cap del 50% previene stime irrealisticamente alte
 * - Per progetti con rischio >50 punti, consigliare split in fasi
 */
export const CONTINGENCY_RATES = {
    /** Nessuna contingenza - progetto senza rischi */
    NONE: 0,
    /** Contingenza bassa - 10% */
    LOW: 0.10,
    /** Contingenza media - 20% */
    MEDIUM: 0.20,
    /** Contingenza alta - 35% */
    HIGH: 0.35,
    /** Cap massimo - 50% */
    MAX: 0.50,
} as const;

/**
 * Mapping complessità a livello di difficoltà numerico
 * 
 * Usato per:
 * - Dashboard visualization
 * - Effort estimation quick reference
 * - Priority scheduling
 * 
 * Scale:
 * - 1: Trivial (non usato)
 * - 2: Low complexity
 * - 3: Medium complexity
 * - 4: High-Medium (non usato)
 * - 5: High complexity
 */
export const COMPLEXITY_TO_DIFFICULTY = {
    'Low': 2,
    'Medium': 3,
    'High': 5,
} as const;

/**
 * Default per difficulty quando complexity non è definita
 */
export const DEFAULT_DIFFICULTY = 3;

/**
 * Precisione per arrotondamenti nei calcoli
 * 
 * - DAYS_DECIMALS: Decimali per giorni/uomo (3 = 0.001 giorni = ~7 minuti)
 * - PERCENTAGE_DECIMALS: Decimali per percentuali (2 = 0.01 = 1%)
 * - MULTIPLIER_DECIMALS: Decimali per moltiplicatori driver (3 = 0.001)
 */
export const PRECISION = {
    DAYS_DECIMALS: 3,
    PERCENTAGE_DECIMALS: 2,
    MULTIPLIER_DECIMALS: 3,
} as const;

/**
 * Versioni del catalogo
 * 
 * Traccia le versioni dei dati di riferimento per audit trail
 */
export const CATALOG_VERSIONS = {
    ACTIVITIES: 'v1.0',
    DRIVERS: 'v1.0',
    RISKS: 'v1.0',
} as const;

/**
 * Limiti di validazione
 */
export const VALIDATION_LIMITS = {
    /** Numero minimo di attività da selezionare per una stima valida */
    MIN_ACTIVITIES: 1,
    /** Numero massimo di rischi selezionabili */
    MAX_RISKS: 20,
    /** Giorni massimi per una singola attività */
    MAX_ACTIVITY_DAYS: 100,
    /** Totale giorni massimo per una stima */
    MAX_TOTAL_DAYS: 500,
} as const;

/**
 * Configurazioni cache (per future implementazioni React Query)
 */
export const CACHE_CONFIG = {
    /** Tempo di staleness per lists (5 minuti) */
    LISTS_STALE_TIME: 5 * 60 * 1000,
    /** Tempo di staleness per requirements (2 minuti) */
    REQUIREMENTS_STALE_TIME: 2 * 60 * 1000,
    /** Tempo di staleness per estimates (1 minuto) */
    ESTIMATES_STALE_TIME: 1 * 60 * 1000,
    /** Tempo di staleness per catalog data (30 minuti) */
    CATALOG_STALE_TIME: 30 * 60 * 1000,
} as const;

/**
 * Configurazioni logger
 */
export const LOGGER_CONFIG = {
    /** Keys contenenti dati sensibili da sanitizzare */
    SENSITIVE_KEYS: ['password', 'token', 'api_key', 'secret', 'email', 'auth'],
    /** Log levels disponibili */
    LOG_LEVELS: ['debug', 'info', 'warn', 'error'] as const,
    /** Default log level */
    DEFAULT_LEVEL: 'info' as const,
} as const;
