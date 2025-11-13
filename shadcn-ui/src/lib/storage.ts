import { List, Requirement, Estimate, Activity, Driver, Risk, ContingencyBand, ExportRow, StickyDefaults, ListActivityCatalog } from '../types';
import { supabase, TABLES, safeDbRead } from './supabase';
import { logger, logCrud } from './logger';
import { throwDbError, isNotFoundError } from './dbErrors';

// Utility functions
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface DeleteEntityOptions {
  id: string;
  table: string;
  column: string;
  validationMessage: string;
  notFoundMessage: string;
  verifyErrorMessage: string;
  deleteErrorMessage: string;
  logLabel: string;
  successLogMessage?: (id: string) => string;
}

async function deleteEntityWithCascade({
  id,
  table,
  column,
  validationMessage,
  notFoundMessage,
  verifyErrorMessage,
  deleteErrorMessage,
  logLabel,
  successLogMessage
}: DeleteEntityOptions): Promise<void> {
  if (!id || typeof id !== 'string') {
    throw new Error(validationMessage);
  }

  const { error: checkError } = await supabase
    .from(table)
    .select(column)
    .eq(column, id)
    .single();

  if (checkError) {
    if (isNotFoundError(checkError)) {
      throw new Error(notFoundMessage);
    }
    throwDbError(checkError, verifyErrorMessage);
  }

  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq(column, id);

  if (deleteError) {
    throwDbError(deleteError, deleteErrorMessage);
  }

  logCrud.delete(logLabel, id);
  if (successLogMessage) {
    logger.info(successLogMessage(id));
  }
}

// Lists Management
export async function getLists(
  statusFilter: List['status'][] = ['Active'],
  onError?: (error: unknown) => void
): Promise<List[]> {
  return safeDbRead(
    async () => {
      let query = supabase
        .from(TABLES.LISTS)
        .select('*')
        .order('created_on', { ascending: false });

      if (statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      logCrud.read('Lists', data?.length);
      return data || [];
    },
    'getLists',
    [],
    onError
  );
}

export async function getListById(listId: string): Promise<List | null> {
  if (!listId) {
    return null;
  }

  return safeDbRead(async () => {
    const { data, error } = await supabase
      .from(TABLES.LISTS)
      .select('*')
      .eq('list_id', listId)
      .single();

    if (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }

    return data ?? null;
  }, 'getListById', null);
}

export async function saveList(list: List): Promise<void> {
  const { error } = await supabase
    .from(TABLES.LISTS)
    .upsert(list, { onConflict: 'list_id' });

  if (error) {
    throwDbError(error, 'Impossibile salvare la lista');
  }

  logCrud.create('List', list.list_id);
}

export async function deleteList(listId: string): Promise<void> {
  await deleteEntityWithCascade({
    id: listId,
    table: TABLES.LISTS,
    column: 'list_id',
    validationMessage: 'ID lista non valido',
    notFoundMessage: 'Lista non trovata',
    verifyErrorMessage: 'Errore verifica lista',
    deleteErrorMessage: 'Impossibile eliminare la lista',
    logLabel: 'List',
    successLogMessage: (id) => `Successfully deleted list ${id} (cascade handled by database)`
  });
}

// Requirements Management
export async function getRequirementsByListId(
  listId: string,
  onError?: (error: unknown) => void
): Promise<Requirement[]> {
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
  }, 'getRequirementsByListId', [], onError);
}

export async function saveRequirement(requirement: Requirement): Promise<void> {
  // Enhanced logging to diagnose 42601 error
  logger.info('Attempting to save requirement:', {
    req_id: requirement.req_id,
    list_id: requirement.list_id,
    title: requirement.title
  });

  const { data, error } = await supabase
    .from(TABLES.REQUIREMENTS)
    .upsert(requirement, { onConflict: 'req_id' })
    .select();

  if (error) {
    logger.error('Supabase upsert error details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
    throwDbError(error, 'Impossibile salvare il requisito');
  }

  logger.info('Requirement saved successfully:', { req_id: requirement.req_id, data });
}

export async function deleteRequirement(reqId: string): Promise<void> {
  await deleteEntityWithCascade({
    id: reqId,
    table: TABLES.REQUIREMENTS,
    column: 'req_id',
    validationMessage: 'ID requisito non valido',
    notFoundMessage: 'Requisito non trovato',
    verifyErrorMessage: 'Errore verifica requisito',
    deleteErrorMessage: 'Impossibile eliminare il requisito',
    logLabel: 'Requirement',
    successLogMessage: (id) => `Successfully deleted requirement ${id} (cascade handled by database)`
  });
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
  if (!reqId) {
    return undefined;
  }

  return safeDbRead<Estimate | undefined>(async () => {
    const { data, error } = await supabase
      .from(TABLES.ESTIMATES)
      .select('*')
      .eq('req_id', reqId)
      .order('created_on', { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    return data && data.length > 0 ? data[0] : undefined;
  }, 'getLatestEstimate', undefined);
}

export async function getLatestEstimates(
  reqIds: string[],
  onError?: (error: unknown) => void
): Promise<Record<string, Estimate | undefined>> {
  const uniqueReqIds = Array.from(new Set(reqIds)).filter(Boolean) as string[];

  if (uniqueReqIds.length === 0) {
    return {};
  }

  type EstimateMap = Record<string, Estimate | undefined>;

  return safeDbRead<EstimateMap>(async () => {
    const { data, error } = await supabase
      .from(TABLES.ESTIMATES)
      .select('*')
      .in('req_id', uniqueReqIds)
      .order('req_id', { ascending: true })
      .order('created_on', { ascending: false });

    if (error) {
      throw error;
    }

    const latestMap: EstimateMap = {};
    (data || []).forEach((estimate) => {
      if (!latestMap[estimate.req_id]) {
        latestMap[estimate.req_id] = estimate;
      }
    });

    return latestMap;
  }, 'getLatestEstimates', {} as EstimateMap, onError);
}

/**
 * Salva una stima nel database.
 * 
 * NOTA: L'aggiornamento del campo last_estimated_on sul requirement
 * è gestito automaticamente dal trigger database trg_update_requirement_timestamp
 * (vedi migrations/003_triggers.sql). Non è necessario aggiornarlo manualmente
 * per evitare race conditions.
 * 
 * @param estimate - La stima da salvare
 * @returns Object con success flag
 * @throws Se il salvataggio della stima fallisce
 */
export async function saveEstimate(estimate: Estimate): Promise<{ success: true }> {
  // Salva l'estimate - il trigger database aggiorna automaticamente il requirement
  const { error: estimateError } = await supabase
    .from(TABLES.ESTIMATES)
    .upsert(estimate, { onConflict: 'estimate_id' });

  if (estimateError) {
    throwDbError(estimateError, 'Impossibile salvare la stima');
  }

  if (import.meta.env.VITE_REQUIRE_DB_TRIGGERS !== 'true') {
    const { error: timestampError } = await supabase
      .from(TABLES.REQUIREMENTS)
      .update({ last_estimated_on: estimate.created_on })
      .eq('req_id', estimate.req_id);

    if (timestampError && !isNotFoundError(timestampError)) {
      logger.warn('Aggiornamento last_estimated_on fallito', {
        reqId: estimate.req_id,
        error: timestampError
      });
    }
  }

  logCrud.create('Estimate', estimate.estimate_id);
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

// Per-list Activity Catalog Management
export async function getListActivityCatalog(
  listId: string,
  technology: string | null = null
): Promise<ListActivityCatalog | null> {
  if (!listId) return null;

  return safeDbRead(async () => {
    const query = supabase
      .from(TABLES.LIST_ACTIVITY_CATALOGS)
      .select('*')
      .eq('list_id', listId);

    // technology can be null; when provided filter by technology
    if (technology !== undefined && technology !== null) {
      query.eq('technology', technology);
    } else {
      query.is('technology', null);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) return null;

    // Supabase returns created_on/updated_on fields as strings if present
    return data[0] as ListActivityCatalog;
  }, 'getListActivityCatalog', null);
}

export async function upsertListActivityCatalog(
  listId: string,
  technology: string | null,
  catalog: ListActivityCatalog['catalog'],
  createdBy?: string
): Promise<void> {
  if (!listId) throw new Error('Invalid listId');

  const payload = {
    list_id: listId,
    technology: technology,
    catalog: catalog,
    created_by: createdBy || null,
    updated_on: new Date().toISOString()
  } as any;

  const { error } = await supabase
    .from(TABLES.LIST_ACTIVITY_CATALOGS)
    .upsert(payload, { onConflict: 'list_id,technology' });

  if (error) {
    throwDbError(error, 'Impossibile salvare il catalogo attività per la lista');
  }

  logCrud.create('ListActivityCatalog', listId);
}

// Sticky Defaults Management
export async function getStickyDefaults(
  userId: string,
  listId: string,
  onError?: (error: unknown) => void
): Promise<StickyDefaults | null> {
  return safeDbRead(async () => {
    const { data, error } = await supabase
      .from(TABLES.STICKY_DEFAULTS)
      .select('*')
      .eq('user_id', userId)
      .eq('list_id', listId)
      .single();

    if (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throwDbError(error, 'Impossibile recuperare i defaults');
    }

    return data;
  }, 'getStickyDefaults', null, onError);
}

export async function saveStickyDefaults(defaults: StickyDefaults): Promise<void> {
  const { error } = await supabase
    .from(TABLES.STICKY_DEFAULTS)
    .upsert(defaults, {
      onConflict: 'user_id,list_id',
      ignoreDuplicates: false
    });

  if (error) {
    throwDbError(error, 'Impossibile salvare i defaults');
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

  const list = await getListById(listId);

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
    throwDbError(estimatesError, 'Impossibile recuperare le stime');
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
 * Handles quotes, newlines, tabs, commas, and leading/trailing whitespace
 * 
 * CSV Standard (RFC 4180):
 * - Fields containing comma, newline, or double-quote must be quoted
 * - Double-quotes within fields must be escaped by doubling them
 * - Tabs and leading/trailing spaces should also be quoted
 * 
 * @param value - String, number, or null/undefined value to escape
 * @returns Safely escaped CSV value
 */
function escapeCsvField(value: string | number | undefined | null): string {
  // Convert to string and handle null/undefined
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // Check for any character that needs escaping:
  // - Double quotes (")
  // - Commas (,) - main CSV separator
  // - Newlines (\n, \r)
  // - Tabs (\t) - can break Excel parsing
  // - Leading/trailing whitespace (can cause parsing issues)
  const needsQuotes = /[",\n\r\t]/.test(stringValue) ||
    stringValue.startsWith(' ') ||
    stringValue.endsWith(' ');

  if (needsQuotes) {
    // Escape double quotes by doubling them (CSV standard RFC 4180)
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
