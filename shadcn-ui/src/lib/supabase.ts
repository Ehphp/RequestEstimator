import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

// Load Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate required environment variables
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Mancano le variabili d\'ambiente Supabase. ' +
    'Assicurati di avere VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY in .env'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// App-specific table names
export const TABLES = {
  LISTS: 'app_5939507989_lists',
  REQUIREMENTS: 'app_5939507989_requirements',
  ESTIMATES: 'app_5939507989_estimates',
  ACTIVITIES: 'app_5939507989_activities',
  DRIVERS: 'app_5939507989_drivers',
  RISKS: 'app_5939507989_risks',
  CONTINGENCY_BANDS: 'app_5939507989_contingency_bands',
  STICKY_DEFAULTS: 'app_5939507989_sticky_defaults'
} as const

/**
 * Helper per gestire errori Supabase in modo consistente
 * @param error - Errore da Supabase
 * @param operation - Operazione che ha generato l'errore
 * @param throwError - Se true, rilancia l'errore dopo il log
 * @deprecated Use throwDbError from dbErrors.ts instead
 */
export function handleSupabaseError(
  error: unknown,
  operation: string,
  throwError: boolean = true
): void {
  logger.error(`Supabase error in ${operation}:`, error);

  if (throwError) {
    throw new Error(`Errore database durante ${operation}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
  }
}

/**
 * Tipo per risultati delle operazioni CRUD
 */
export type DbResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

/**
 * Wrapper per operazioni di lettura con error handling consistente
 */
export async function safeDbRead<T>(
  operation: () => Promise<T>,
  operationName: string,
  fallbackValue: T,
  onError?: (error: unknown) => void
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(`Error in ${operationName}:`, error);
    onError?.(error);
    return fallbackValue;
  }
}

/**
 * Wrapper per operazioni di scrittura con error handling consistente
 */
export async function safeDbWrite(
  operation: () => Promise<void>,
  operationName: string
): Promise<DbResult<void>> {
  try {
    await operation();
    return { success: true, data: undefined };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Errore sconosciuto';
    logger.error(`Error in ${operationName}:`, error);
    return { success: false, error: errorMsg };
  }
}
