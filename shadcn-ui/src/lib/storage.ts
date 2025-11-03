import { List, Requirement, Estimate, Activity, Driver, Risk, ContingencyBand, ExportRow } from '../types';
import { supabase, TABLES } from './supabase';

// Utility functions
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Lists Management
export async function getLists(): Promise<List[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.LISTS)
      .select('*')
      .eq('status', 'Active')
      .order('created_on', { ascending: false });
    
    if (error) {
      console.error('Error fetching lists:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getLists:', error);
    return [];
  }
}

export async function saveList(list: List): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLES.LISTS)
      .upsert(list, { onConflict: 'list_id' });
    
    if (error) {
      console.error('Error saving list:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveList:', error);
    throw error;
  }
}

export async function deleteList(listId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLES.LISTS)
      .update({ status: 'Deleted' })
      .eq('list_id', listId);
    
    if (error) {
      console.error('Error deleting list:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteList:', error);
    throw error;
  }
}

// Requirements Management
export async function getRequirements(): Promise<Requirement[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.REQUIREMENTS)
      .select('*')
      .eq('status', 'Active')
      .order('created_on', { ascending: false });
    
    if (error) {
      console.error('Error fetching requirements:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getRequirements:', error);
    return [];
  }
}

export async function getRequirementsByListId(listId: string): Promise<Requirement[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.REQUIREMENTS)
      .select('*')
      .eq('list_id', listId)
      .eq('status', 'Active')
      .order('created_on', { ascending: false });
    
    if (error) {
      console.error('Error fetching requirements:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getRequirementsByListId:', error);
    return [];
  }
}

export async function saveRequirement(requirement: Requirement): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLES.REQUIREMENTS)
      .upsert(requirement, { onConflict: 'req_id' });
    
    if (error) {
      console.error('Error saving requirement:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveRequirement:', error);
    throw error;
  }
}

export async function deleteRequirement(reqId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLES.REQUIREMENTS)
      .update({ status: 'Deleted' })
      .eq('req_id', reqId);
    
    if (error) {
      console.error('Error deleting requirement:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteRequirement:', error);
    throw error;
  }
}

// Estimates Management
export async function getEstimates(): Promise<Estimate[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.ESTIMATES)
      .select('*')
      .order('created_on', { ascending: false });
    
    if (error) {
      console.error('Error fetching estimates:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getEstimates:', error);
    return [];
  }
}

export async function getEstimatesByReqId(reqId: string): Promise<Estimate[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.ESTIMATES)
      .select('*')
      .eq('req_id', reqId)
      .order('created_on', { ascending: false });
    
    if (error) {
      console.error('Error fetching estimates:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getEstimatesByReqId:', error);
    return [];
  }
}

export async function getLatestEstimate(reqId: string): Promise<Estimate | undefined> {
  const estimates = await getEstimatesByReqId(reqId);
  return estimates.length > 0 ? estimates[0] : undefined;
}

export async function saveEstimate(estimate: Estimate): Promise<void> {
  try {
    // Update the requirement's last_estimated_on field
    await supabase
      .from(TABLES.REQUIREMENTS)
      .update({ last_estimated_on: new Date().toISOString() })
      .eq('req_id', estimate.req_id);

    const { error } = await supabase
      .from(TABLES.ESTIMATES)
      .upsert(estimate, { onConflict: 'estimate_id' });
    
    if (error) {
      console.error('Error saving estimate:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveEstimate:', error);
    throw error;
  }
}

// Catalog Data Management
export async function getActivities(): Promise<Activity[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.ACTIVITIES)
      .select('*')
      .eq('status', 'Active')
      .order('driver_group', { ascending: true });
    
    if (error) {
      console.error('Error fetching activities:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getActivities:', error);
    return [];
  }
}

export async function getDrivers(): Promise<Driver[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.DRIVERS)
      .select('*')
      .order('driver', { ascending: true });
    
    if (error) {
      console.error('Error fetching drivers:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getDrivers:', error);
    return [];
  }
}

export async function getRisks(): Promise<Risk[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.RISKS)
      .select('*')
      .order('risk_id', { ascending: true });
    
    if (error) {
      console.error('Error fetching risks:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getRisks:', error);
    return [];
  }
}

export async function getContingencyBands(): Promise<ContingencyBand[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.CONTINGENCY_BANDS)
      .select('*')
      .order('band_id', { ascending: true });
    
    if (error) {
      console.error('Error fetching contingency bands:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getContingencyBands:', error);
    return [];
  }
}

// Export utilities
export async function generateExportData(listId: string, selectedReqIds?: string[]): Promise<ExportRow[]> {
  try {
    const lists = await getLists();
    const list = lists.find(l => l.list_id === listId);
    if (!list) return [];
    
    const requirements = await getRequirementsByListId(listId);
    const filteredRequirements = selectedReqIds 
      ? requirements.filter(r => selectedReqIds.includes(r.req_id))
      : requirements;
    
    const exportData: ExportRow[] = [];
    
    for (const req of filteredRequirements) {
      const latestEstimate = await getLatestEstimate(req.req_id);
      
      exportData.push({
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
        estimator: (req as any).estimator || '',
        last_estimated_on: req.last_estimated_on || '',
        state: req.state
      });
    }
    
    return exportData;
  } catch (error) {
    console.error('Error generating export data:', error);
    return [];
  }
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
      `"${row.list_name}"`,
      `"${row.req_id}"`,
      `"${row.title}"`,
      `"${row.priority}"`,
      `"${row.scenario}"`,
      `"${row.complexity}"`,
      `"${row.environments}"`,
      `"${row.reuse}"`,
      `"${row.stakeholders}"`,
      row.subtotal_days,
      row.contingency_pct,
      row.total_days,
      `"${row.estimator}"`,
      `"${row.last_estimated_on}"`,
      `"${row.state}"`
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

// Migration function to help transition from localStorage (if needed)
export async function migrateFromLocalStorage(): Promise<void> {
  try {
    // Check if there's any localStorage data to migrate
    const localLists = localStorage.getItem('requirement_lists');
    const localRequirements = localStorage.getItem('requirements');
    const localEstimates = localStorage.getItem('estimates');
    
    if (localLists) {
      const lists: List[] = JSON.parse(localLists);
      for (const list of lists) {
        await saveList(list);
      }
      console.log(`Migrated ${lists.length} lists from localStorage`);
    }
    
    if (localRequirements) {
      const requirements: Requirement[] = JSON.parse(localRequirements);
      for (const requirement of requirements) {
        await saveRequirement(requirement);
      }
      console.log(`Migrated ${requirements.length} requirements from localStorage`);
    }
    
    if (localEstimates) {
      const estimates: Estimate[] = JSON.parse(localEstimates);
      for (const estimate of estimates) {
        await saveEstimate(estimate);
      }
      console.log(`Migrated ${estimates.length} estimates from localStorage`);
    }
    
    console.log('Migration from localStorage completed successfully');
  } catch (error) {
    console.error('Error during migration:', error);
  }
}