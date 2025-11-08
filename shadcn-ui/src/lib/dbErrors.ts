/**
 * Database Error Handling Utilities
 * 
 * Gestione centralizzata degli errori Supabase/PostgreSQL con messaggi
 * user-friendly in italiano e distinzione tra errori RLS, constraint violations,
 * e altri errori database.
 */

import { PostgrestError } from '@supabase/supabase-js';
import { logger } from './logger';

/**
 * PostgreSQL Error Codes
 * Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PG_ERROR_CODES = {
    // Integrity Constraint Violations (23xxx)
    UNIQUE_VIOLATION: '23505',
    FOREIGN_KEY_VIOLATION: '23503',
    CHECK_VIOLATION: '23514',
    NOT_NULL_VIOLATION: '23502',

    // Insufficient Privilege (42xxx)
    INSUFFICIENT_PRIVILEGE: '42501', // RLS policy denial

    // Not Found
    NO_DATA_FOUND: 'PGRST116', // Supabase specific (404)

    // Data Exception (22xxx)
    INVALID_TEXT_REPRESENTATION: '22P02',
    NUMERIC_VALUE_OUT_OF_RANGE: '22003',
    STRING_DATA_RIGHT_TRUNCATION: '22001',
} as const;

/**
 * Tipo per errori database strutturati
 */
export interface DbErrorInfo {
    type: 'rls' | 'constraint' | 'not_found' | 'validation' | 'unknown';
    code: string;
    message: string; // Messaggio user-friendly in italiano
    originalMessage: string; // Messaggio tecnico originale
    constraintName?: string;
    tableName?: string;
    columnName?: string;
    details?: string;
}

/**
 * Analizza un errore Supabase/PostgreSQL e restituisce info strutturate
 */
export function parseDbError(error: unknown): DbErrorInfo {
    // Gestione errori non-PostgrestError
    if (!error || typeof error !== 'object') {
        return {
            type: 'unknown',
            code: 'UNKNOWN',
            message: 'Si è verificato un errore imprevisto',
            originalMessage: String(error),
        };
    }

    const pgError = error as PostgrestError;
    const code = pgError.code || '';
    const originalMessage = pgError.message || '';
    const details = pgError.details || '';
    const hint = pgError.hint || '';

    logger.debug('Parsing DB error:', { code, originalMessage, details, hint });

    // 1. RLS Policy Denial
    if (code === PG_ERROR_CODES.INSUFFICIENT_PRIVILEGE) {
        return {
            type: 'rls',
            code,
            message: 'Non hai i permessi necessari per eseguire questa operazione',
            originalMessage,
            details: details || hint,
        };
    }

    // 2. Not Found
    if (code === PG_ERROR_CODES.NO_DATA_FOUND || originalMessage.includes('not found')) {
        return {
            type: 'not_found',
            code,
            message: 'Elemento non trovato',
            originalMessage,
        };
    }

    // 3. CHECK Constraint Violation
    if (code === PG_ERROR_CODES.CHECK_VIOLATION) {
        const constraintName = extractConstraintName(details) || extractConstraintName(originalMessage);
        const message = getCheckConstraintMessage(constraintName, details);

        return {
            type: 'constraint',
            code,
            message,
            originalMessage,
            constraintName,
            details,
        };
    }

    // 4. Foreign Key Violation
    if (code === PG_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
        const constraintName = extractConstraintName(details) || extractConstraintName(originalMessage);
        const tableName = extractTableName(details) || extractTableName(originalMessage);

        return {
            type: 'constraint',
            code,
            message: getForeignKeyMessage(constraintName, tableName),
            originalMessage,
            constraintName,
            tableName,
            details,
        };
    }

    // 5. NOT NULL Violation
    if (code === PG_ERROR_CODES.NOT_NULL_VIOLATION) {
        const columnName = extractColumnName(details) || extractColumnName(originalMessage);

        return {
            type: 'constraint',
            code,
            message: `Il campo "${columnName || 'obbligatorio'}" non può essere vuoto`,
            originalMessage,
            columnName,
            details,
        };
    }

    // 6. Unique Violation
    if (code === PG_ERROR_CODES.UNIQUE_VIOLATION) {
        const constraintName = extractConstraintName(details) || extractConstraintName(originalMessage);

        return {
            type: 'constraint',
            code,
            message: getUniqueViolationMessage(constraintName),
            originalMessage,
            constraintName,
            details,
        };
    }

    // 7. Validation Errors (data type, range, etc.)
    if (code.startsWith('22')) {
        return {
            type: 'validation',
            code,
            message: getValidationMessage(code, details),
            originalMessage,
            details,
        };
    }

    // 8. Unknown/Generic Error
    return {
        type: 'unknown',
        code,
        message: 'Si è verificato un errore imprevisto',
        originalMessage,
        details,
    };
}

/**
 * Estrae il nome del constraint dal messaggio di errore
 */
function extractConstraintName(message: string): string | undefined {
    // Pattern: constraint "constraint_name"
    const match = message.match(/constraint\s+"?([^"]+)"?/i);
    return match?.[1];
}

/**
 * Estrae il nome della tabella dal messaggio di errore
 */
function extractTableName(message: string): string | undefined {
    // Pattern: table "table_name" o on table "table_name"
    const match = message.match(/table\s+"?([^"]+)"?/i);
    return match?.[1];
}

/**
 * Estrae il nome della colonna dal messaggio di errore
 */
function extractColumnName(message: string): string | undefined {
    // Pattern: column "column_name" o null value in column "column_name"
    const match = message.match(/column\s+"?([^"]+)"?/i);
    return match?.[1];
}

/**
 * Genera messaggio user-friendly per violazioni CHECK constraint
 */
function getCheckConstraintMessage(constraintName?: string, details?: string): string {
    if (!constraintName) {
        return 'Il valore inserito non è valido';
    }

    // Check constraints comuni (da migrations/001_add_validations.sql)
    const constraintMessages: Record<string, string> = {
        // Priority checks
        chk_lists_priority: 'Priorità non valida. Valori ammessi: High, Med, Low',
        chk_requirements_priority: 'Priorità non valida. Valori ammessi: High, Med, Low',

        // State checks
        chk_requirements_state: 'Stato non valido. Valori ammessi: Proposed, Selected, Scheduled, Done',

        // Complexity checks
        chk_estimates_complexity: 'Complessità non valida. Valori ammessi: Low, Medium, High',

        // Environments checks
        chk_estimates_environments: 'Numero ambienti non valido. Valori ammessi: 1 env, 2 env, 3+ env',

        // Reuse checks
        chk_estimates_reuse: 'Riutilizzo non valido. Valori ammessi: High, Medium, Low',

        // Stakeholders checks
        chk_estimates_stakeholders: 'Stakeholder non validi. Valori ammessi: 1 person, 2-3 team, 4+ team',

        // Scenario checks
        chk_estimates_scenario: 'Scenario non valido. Valori ammessi: A, B, C',

        // Positive values checks
        chk_estimates_positive_days: 'I giorni stimati devono essere maggiori di zero',
        chk_activities_positive_days: 'I giorni base devono essere maggiori di zero',
        chk_estimates_positive_multiplier: 'Il moltiplicatore deve essere maggiore di zero',

        // Percentage checks
        chk_estimates_contingency_range: 'La percentuale di contingenza deve essere tra 0% e 50%',
        chk_contingency_bands_percentage: 'La percentuale deve essere tra 0% e 100%',
        chk_drivers_multiplier_range: 'Il moltiplicatore deve essere tra 0 e 10',
        chk_risks_weight_range: 'Il peso del rischio deve essere tra 0 e 10',

        // Status checks
        chk_lists_status: 'Status non valido. Valori ammessi: Active, Archived',
        chk_activities_status: 'Status non valido. Valori ammessi: Active, Inactive',
    };

    const message = constraintMessages[constraintName];
    if (message) {
        return message;
    }

    // Generic message con dettagli
    if (details && details.length < 200) {
        return `Validazione fallita: ${details}`;
    }

    return 'Il valore inserito non rispetta i vincoli di validazione';
}

/**
 * Genera messaggio user-friendly per violazioni Foreign Key
 */
function getForeignKeyMessage(constraintName?: string, tableName?: string): string {
    if (!constraintName) {
        return 'Riferimento non valido ad elemento collegato';
    }

    // Foreign key constraints comuni (da migrations/001_add_validations.sql)
    const fkMessages: Record<string, string> = {
        fk_requirements_list_id: 'La lista specificata non esiste',
        fk_estimates_req_id: 'Il requisito specificato non esiste',
        fk_sticky_defaults_list_id: 'La lista specificata non esiste',
    };

    const message = fkMessages[constraintName];
    if (message) {
        return message;
    }

    if (tableName) {
        return `Riferimento non valido nella tabella ${tableName}`;
    }

    return 'Riferimento non valido ad elemento collegato';
}

/**
 * Genera messaggio user-friendly per violazioni UNIQUE
 */
function getUniqueViolationMessage(constraintName?: string): string {
    if (!constraintName) {
        return 'Questo valore esiste già';
    }

    // Unique constraints comuni
    if (constraintName.includes('pkey') || constraintName.includes('_id')) {
        return 'Elemento con questo ID esiste già';
    }

    if (constraintName.includes('name')) {
        return 'Questo nome è già utilizzato';
    }

    return 'Questo valore esiste già nel sistema';
}

/**
 * Genera messaggio user-friendly per errori di validazione
 */
function getValidationMessage(code: string, details?: string): string {
    switch (code) {
        case PG_ERROR_CODES.INVALID_TEXT_REPRESENTATION:
            return 'Formato del dato non valido';
        case PG_ERROR_CODES.NUMERIC_VALUE_OUT_OF_RANGE:
            return 'Valore numerico fuori dal range consentito';
        case PG_ERROR_CODES.STRING_DATA_RIGHT_TRUNCATION:
            return 'Testo troppo lungo';
        default:
            if (details && details.length < 200) {
                return `Validazione fallita: ${details}`;
            }
            return 'Valore non valido';
    }
}

/**
 * Utility per lanciare errore con messaggio user-friendly
 * Usa questa funzione nelle operazioni storage invece di throw new Error(error.message)
 */
export function throwDbError(error: unknown, fallbackMessage: string): never {
    const errorInfo = parseDbError(error);

    // Log dettagli tecnici per debugging
    logger.error('Database error:', {
        type: errorInfo.type,
        code: errorInfo.code,
        originalMessage: errorInfo.originalMessage,
        details: errorInfo.details,
    });

    // Lancia errore con messaggio user-friendly
    throw new Error(errorInfo.message || fallbackMessage);
}

/**
 * Verifica se un errore è un RLS policy denial
 */
export function isRlsError(error: unknown): boolean {
    const errorInfo = parseDbError(error);
    return errorInfo.type === 'rls';
}

/**
 * Verifica se un errore è una violazione constraint
 */
export function isConstraintError(error: unknown): boolean {
    const errorInfo = parseDbError(error);
    return errorInfo.type === 'constraint';
}

/**
 * Verifica se un errore è "not found"
 */
export function isNotFoundError(error: unknown): boolean {
    const errorInfo = parseDbError(error);
    return errorInfo.type === 'not_found';
}
