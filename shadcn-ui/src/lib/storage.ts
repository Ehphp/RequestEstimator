import { List, Requirement, Estimate, Activity, Driver, Risk, ContingencyBand, ExportRow, StickyDefaults } from '../types';
import { supabase, TABLES, isNotFoundError, safeDbRead } from './supabase';
import { logger, logCrud } from './logger';

// Utility functions
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Lists Management
export async function getLists(): Promise<List[]> {
  return safeDbRead(async () => {
    const { data, error } = await supabase
      .from(TABLES.LISTS)
      .select('*')
      .eq('status', 'Active')
      .order('created_on', { ascending: false });

    if (error) {
      throw error;
    }

    logCrud.read('Lists', data?.length);
    return data || [];
  }, 'getLists', []);
}

export async function saveList(list: List): Promise<void> {
  const { error } = await supabase
    .from(TABLES.LISTS)
    .upsert(list, { onConflict: 'list_id' });

  if (error) {
    logger.error('Error saving list:', error);
    throw new Error(`Impossibile salvare la lista: ${error.message}`);
  }

  logCrud.create('List', list.list_id);
}

export async function deleteList(listId: string): Promise<void> {
  // Validazione input
  if (!listId || typeof listId !== 'string') {
    throw new Error('ID lista non valido');
  }

  // Supabase non supporta transazioni multi-tabella direttamente,
  // ma possiamo usare cascading delete configurato a livello DB
  // oppure implementare una pseudo-transazione con rollback manuale

  // Step 1: Verifica che la lista esista
  const { error: checkError } = await supabase
    .from(TABLES.LISTS)
    .select('list_id')
    .eq('list_id', listId)
    .single();

  if (checkError) {
    if (isNotFoundError(checkError)) {
      throw new Error('Lista non trovata');
    }
    logger.error('Error checking list existence:', checkError);
    throw new Error(`Errore verifica lista: ${checkError.message}`);
  }

  // Step 2: Recupera IDs requisiti per eliminazione stime
  const { data: requirements, error: reqFetchError } = await supabase
    .from(TABLES.REQUIREMENTS)
    .select('req_id')
    .eq('list_id', listId);

  if (reqFetchError) {
    logger.error('Error fetching requirements for deletion:', reqFetchError);
    throw new Error(`Impossibile recuperare i requisiti: ${reqFetchError.message}`);
  }

  const requirementIds = (requirements || []).map(req => req.req_id);
  logger.info(`Found ${requirementIds.length} requirements to delete`);

  // Step 3: Elimina stime (se esistono requisiti)
  if (requirementIds.length > 0) {
    const { error: estimatesError } = await supabase
      .from(TABLES.ESTIMATES)
      .delete()
      .in('req_id', requirementIds);

    if (estimatesError) {
      logger.error('Error deleting estimates:', estimatesError);
      throw new Error(`Impossibile eliminare le stime: ${estimatesError.message}`);
    }
    logger.info(`Deleted estimates for ${requirementIds.length} requirements`);
  }

  // Step 4: Elimina requisiti
  if (requirementIds.length > 0) {
    const { error: requirementsError } = await supabase
      .from(TABLES.REQUIREMENTS)
      .delete()
      .eq('list_id', listId);

    if (requirementsError) {
      logger.error('Error deleting requirements:', requirementsError);
      throw new Error(`Impossibile eliminare i requisiti: ${requirementsError.message}`);
    }
    logger.info(`Deleted ${requirementIds.length} requirements`);
  }

  // Step 5: Elimina lista
  const { error: deleteError } = await supabase
    .from(TABLES.LISTS)
    .delete()
    .eq('list_id', listId);

  if (deleteError) {
    logger.error('Error deleting list:', deleteError);
    throw new Error(`Impossibile eliminare la lista: ${deleteError.message}`);
  }

  logCrud.delete('List', listId);
  logger.info(`Successfully deleted list ${listId} with ${requirementIds.length} requirements`);
}

// Requirements Management
export async function getRequirementsByListId(listId: string): Promise<Requirement[]> {
  return safeDbRead(async () => {
    const { data, error } = await supabase
      .from(TABLES.REQUIREMENTS)
      .select('*')
      .eq('list_id', listId)
      .order('created_on', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }, 'getRequirementsByListId', []);
}

export async function saveRequirement(requirement: Requirement): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLES.REQUIREMENTS)
      .upsert(requirement, { onConflict: 'req_id' });

    if (error) {
      logger.error('Error saving requirement:', error);
      throw error;
    }
  } catch (error) {
    logger.error('Error in saveRequirement:', error);
    throw error;
  }
}

export async function deleteRequirement(reqId: string): Promise<void> {
  // Validazione input
  if (!reqId || typeof reqId !== 'string') {
    throw new Error('ID requisito non valido');
  }

  // Step 1: Verifica che il requisito esista
  const { error: checkError } = await supabase
    .from(TABLES.REQUIREMENTS)
    .select('req_id')
    .eq('req_id', reqId)
    .single();

  if (checkError) {
    if (isNotFoundError(checkError)) {
      throw new Error('Requisito non trovato');
    }
    logger.error('Error checking requirement existence:', checkError);
    throw new Error(`Errore verifica requisito: ${checkError.message}`);
  }

  // Step 2: Elimina stime associate
  const { error: estimatesError } = await supabase
    .from(TABLES.ESTIMATES)
    .delete()
    .eq('req_id', reqId);

  if (estimatesError) {
    logger.error('Error deleting estimates:', estimatesError);
    throw new Error(`Impossibile eliminare le stime: ${estimatesError.message}`);
  }

  // Step 3: Elimina requisito
  const { error: deleteError } = await supabase
    .from(TABLES.REQUIREMENTS)
    .delete()
    .eq('req_id', reqId);

  if (deleteError) {
    logger.error('Error deleting requirement:', deleteError);
    throw new Error(`Impossibile eliminare il requisito: ${deleteError.message}`);
  }

  logCrud.delete('Requirement', reqId);
  logger.info(`Successfully deleted requirement ${reqId}`);
}

// Estimates Management
export async function getEstimatesByReqId(reqId: string): Promise<Estimate[]> {
  return safeDbRead(async () => {
    const { data, error } = await supabase
      .from(TABLES.ESTIMATES)
      .select('*')
      .eq('req_id', reqId)
      .order('created_on', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }, 'getEstimatesByReqId', []);
}

export async function getLatestEstimate(reqId: string): Promise<Estimate | undefined> {
  const estimates = await getEstimatesByReqId(reqId);
  return estimates.length > 0 ? estimates[0] : undefined;
}

/**
 * Salva una stima nel database e aggiorna il timestamp del requisito.
 * 
 * @param estimate - La stima da salvare
 * @returns Object con success flag e eventuale messaggio di warning
 * @throws Se il salvataggio della stima fallisce completamente
 */
export async function saveEstimate(estimate: Estimate): Promise<{ success: true; warning?: string }> {
  // Step 1: Salva l'estimate (operazione critica)
  const { error: estimateError } = await supabase
    .from(TABLES.ESTIMATES)
    .upsert(estimate, { onConflict: 'estimate_id' });

  if (estimateError) {
    logger.error('Error saving estimate:', estimateError);
    throw new Error(`Impossibile salvare la stima: ${estimateError.message}`);
  }

  logCrud.create('Estimate', estimate.estimate_id);

  // Step 2: Aggiorna timestamp requirement (non critico)
  const { error: updateError } = await supabase
    .from(TABLES.REQUIREMENTS)
    .update({ last_estimated_on: new Date().toISOString() })
    .eq('req_id', estimate.req_id);

  if (updateError) {
    // L'estimate è salvata, ma timestamp non aggiornato
    logger.error('Warning: Could not update last_estimated_on (estimate was saved):', updateError);
    return {
      success: true,
      warning: 'Stima salvata ma timestamp requisito non aggiornato'
    };
  }

  return { success: true };
}

// Catalog Data Management
export async function getActivities(): Promise<Activity[]> {
  return safeDbRead(async () => {
    const { data, error } = await supabase
      .from(TABLES.ACTIVITIES)
      .select('*')
      .eq('status', 'Active')
      .order('driver_group', { ascending: true });

    if (error) {
      throw error;
    }
    return data || [];
  }, 'getActivities', []);
}

export async function getDrivers(): Promise<Driver[]> {
  return safeDbRead(async () => {
    const { data, error } = await supabase
      .from(TABLES.DRIVERS)
      .select('*')
      .order('driver', { ascending: true });

    if (error) {
      throw error;
    }
    return data || [];
  }, 'getDrivers', []);
}

export async function getRisks(): Promise<Risk[]> {
  return safeDbRead(async () => {
    const { data, error } = await supabase
      .from(TABLES.RISKS)
      .select('*')
      .order('risk_id', { ascending: true });

    if (error) {
      throw error;
    }
    return data || [];
  }, 'getRisks', []);
}

export async function getContingencyBands(): Promise<ContingencyBand[]> {
  return safeDbRead(async () => {
    const { data, error } = await supabase
      .from(TABLES.CONTINGENCY_BANDS)
      .select('*')
      .order('band_id', { ascending: true });

    if (error) {
      throw error;
    }
    return data || [];
  }, 'getContingencyBands', []);
}

// Sticky Defaults Management
export async function getStickyDefaults(userId: string, listId: string): Promise<StickyDefaults | null> {
  const { data, error } = await supabase
    .from(TABLES.STICKY_DEFAULTS)
    .select('*')
    .eq('user_id', userId)
    .eq('list_id', listId)
    .single();

  if (error) {
    // Not found is OK - significa nessun default salvato ancora
    if (isNotFoundError(error)) {
      return null;
    }
    logger.error('Error getting sticky defaults:', error);
    throw new Error(`Impossibile recuperare i defaults: ${error.message}`);
  }

  return data;
}

export async function saveStickyDefaults(defaults: StickyDefaults): Promise<void> {
  const { error } = await supabase
    .from(TABLES.STICKY_DEFAULTS)
    .upsert(defaults, {
      onConflict: 'user_id,list_id',
      ignoreDuplicates: false
    });

  if (error) {
    logger.error('Error saving sticky defaults:', error);
    throw new Error(`Impossibile salvare i defaults: ${error.message}`);
  }
}

// Export utilities
export async function generateExportData(listId: string, selectedReqIds?: string[]): Promise<ExportRow[]> {
  // Validazione input
  if (!listId || typeof listId !== 'string') {
    logger.error('Invalid listId provided to generateExportData:', listId);
    throw new Error('ID lista non valido');
  }

  if (selectedReqIds && !Array.isArray(selectedReqIds)) {
    logger.error('Invalid selectedReqIds provided:', selectedReqIds);
    throw new Error('Lista requisiti non valida');
  }

  const lists = await getLists();
  const list = lists.find(l => l.list_id === listId);

  if (!list) {
    logger.error('List not found for export:', listId);
    throw new Error('Lista non trovata');
  }

  const requirements = await getRequirementsByListId(listId);

  // Filtra requisiti se specificati IDs
  const filteredRequirements = selectedReqIds && selectedReqIds.length > 0
    ? requirements.filter(r => selectedReqIds.includes(r.req_id))
    : requirements;

  // Verifica che tutti gli ID selezionati esistano
  if (selectedReqIds && selectedReqIds.length > 0) {
    const foundIds = filteredRequirements.map(r => r.req_id);
    const missingIds = selectedReqIds.filter(id => !foundIds.includes(id));
    if (missingIds.length > 0) {
      logger.warn('Some selected requirement IDs not found:', missingIds);
    }
  }

  if (filteredRequirements.length === 0) {
    return [];
  }

  // OTTIMIZZAZIONE: Fetch tutte le stime in una query batch invece di N queries
  const reqIds = filteredRequirements.map(r => r.req_id);
  const { data: allEstimates, error: estimatesError } = await supabase
    .from(TABLES.ESTIMATES)
    .select('*')
    .in('req_id', reqIds)
    .order('created_on', { ascending: false });

  if (estimatesError) {
    logger.error('Error fetching estimates for export:', estimatesError);
    throw new Error(`Impossibile recuperare le stime: ${estimatesError.message}`);
  }

  // Crea mappa req_id -> latest estimate
  const estimatesMap = new Map<string, Estimate>();
  (allEstimates || []).forEach(estimate => {
    if (!estimatesMap.has(estimate.req_id)) {
      estimatesMap.set(estimate.req_id, estimate);
    }
  });

  // Genera export data
  const exportData: ExportRow[] = filteredRequirements.map(req => {
    const latestEstimate = estimatesMap.get(req.req_id);
    const requirementWithEstimator = req as Requirement & { estimator?: string };

    return {
      list_name: list.name,
      req_id: req.req_id,
      title: req.title,
      priority: req.priority,
      scenario: latestEstimate?.scenario || '',
      complexity: latestEstimate?.complexity || '',
      environments: latestEstimate?.environments || '',
      reuse: latestEstimate?.reuse || '',
      stakeholders: latestEstimate?.stakeholders || '',
      subtotal_days: latestEstimate?.subtotal_days || 0,
      contingency_pct: latestEstimate ? Math.round((latestEstimate.contingency_pct || 0) * 100) : 0,
      total_days: latestEstimate?.total_days || 0,
      estimator: requirementWithEstimator.estimator || '',
      last_estimated_on: req.last_estimated_on || '',
      state: req.state
    };
  });

  return exportData;
}/**
 * Escapes special characters in CSV fields to prevent corruption
 * Handles quotes, newlines, commas, and other special characters
 * @param value - String value to escape
 * @returns Safely escaped CSV value
 */
function escapeCsvField(value: string | number | undefined | null): string {
  // Convert to string and handle null/undefined
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If field contains quotes, double them (CSV standard)
  // If field contains comma, newline, or quotes, wrap in quotes
  const needsQuotes = /[",\n\r]/.test(stringValue);

  if (needsQuotes) {
    // Double any existing quotes and wrap the whole thing in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function exportToCSV(data: ExportRow[]): string {
  const headers = [
    'List', 'Req ID', 'Title', 'Priority', 'Scenario', 'Complexity',
    'Environments', 'Reuse', 'Stakeholders', 'Subtotal (days)',
    'Contingency %', 'Total (days)', 'Estimator', 'Last Estimated On', 'State'
  ];

  const csvContent = [
    headers.join(','),
    ...data.map(row => [
      escapeCsvField(row.list_name),
      escapeCsvField(row.req_id),
      escapeCsvField(row.title),
      escapeCsvField(row.priority),
      escapeCsvField(row.scenario),
      escapeCsvField(row.complexity),
      escapeCsvField(row.environments),
      escapeCsvField(row.reuse),
      escapeCsvField(row.stakeholders),
      escapeCsvField(row.subtotal_days),
      escapeCsvField(row.contingency_pct),
      escapeCsvField(row.total_days),
      escapeCsvField(row.estimator),
      escapeCsvField(row.last_estimated_on),
      escapeCsvField(row.state)
    ].join(','))
  ].join('\n');

  return csvContent;
}

export function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
