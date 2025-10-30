import { List, Requirement, Estimate, ExportRow } from '../types';

const STORAGE_KEYS = {
  LISTS: 'requirement_lists',
  REQUIREMENTS: 'requirements',
  ESTIMATES: 'estimates'
};

// Lists
export function getLists(): List[] {
  const data = localStorage.getItem(STORAGE_KEYS.LISTS);
  return data ? JSON.parse(data) : [];
}

export function saveList(list: List): void {
  const lists = getLists();
  const existingIndex = lists.findIndex(l => l.list_id === list.list_id);
  
  if (existingIndex >= 0) {
    lists[existingIndex] = list;
  } else {
    lists.push(list);
  }
  
  localStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify(lists));
}

export function deleteList(listId: string): void {
  const lists = getLists();
  const filtered = lists.filter(l => l.list_id !== listId);
  localStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify(filtered));
  
  // Delete related requirements and estimates
  const requirements = getRequirements().filter(r => r.list_id !== listId);
  localStorage.setItem(STORAGE_KEYS.REQUIREMENTS, JSON.stringify(requirements));
  
  const estimates = getEstimates();
  const requirementIds = getRequirements().filter(r => r.list_id === listId).map(r => r.req_id);
  const filteredEstimates = estimates.filter(e => !requirementIds.includes(e.req_id));
  localStorage.setItem(STORAGE_KEYS.ESTIMATES, JSON.stringify(filteredEstimates));
}

// Requirements
export function getRequirements(): Requirement[] {
  const data = localStorage.getItem(STORAGE_KEYS.REQUIREMENTS);
  return data ? JSON.parse(data) : [];
}

export function getRequirementsByListId(listId: string): Requirement[] {
  return getRequirements().filter(r => r.list_id === listId);
}

export function saveRequirement(requirement: Requirement): void {
  const requirements = getRequirements();
  const existingIndex = requirements.findIndex(r => r.req_id === requirement.req_id);
  
  if (existingIndex >= 0) {
    requirements[existingIndex] = requirement;
  } else {
    requirements.push(requirement);
  }
  
  localStorage.setItem(STORAGE_KEYS.REQUIREMENTS, JSON.stringify(requirements));
}

export function deleteRequirement(reqId: string): void {
  const requirements = getRequirements();
  const filtered = requirements.filter(r => r.req_id !== reqId);
  localStorage.setItem(STORAGE_KEYS.REQUIREMENTS, JSON.stringify(filtered));
  
  // Delete related estimates
  const estimates = getEstimates().filter(e => e.req_id !== reqId);
  localStorage.setItem(STORAGE_KEYS.ESTIMATES, JSON.stringify(estimates));
}

// Estimates
export function getEstimates(): Estimate[] {
  const data = localStorage.getItem(STORAGE_KEYS.ESTIMATES);
  return data ? JSON.parse(data) : [];
}

export function getEstimatesByReqId(reqId: string): Estimate[] {
  return getEstimates().filter(e => e.req_id === reqId).sort((a, b) => 
    new Date(b.created_on).getTime() - new Date(a.created_on).getTime()
  );
}

export function getLatestEstimate(reqId: string): Estimate | undefined {
  const estimates = getEstimatesByReqId(reqId);
  return estimates.length > 0 ? estimates[0] : undefined;
}

export function saveEstimate(estimate: Estimate): void {
  const estimates = getEstimates();
  const existingIndex = estimates.findIndex(e => e.estimate_id === estimate.estimate_id);
  
  if (existingIndex >= 0) {
    estimates[existingIndex] = estimate;
  } else {
    estimates.push(estimate);
  }
  
  localStorage.setItem(STORAGE_KEYS.ESTIMATES, JSON.stringify(estimates));
  
  // Update requirement's last_estimated_on
  const requirement = getRequirements().find(r => r.req_id === estimate.req_id);
  if (requirement) {
    requirement.last_estimated_on = estimate.created_on;
    saveRequirement(requirement);
  }
}

// Export utilities
export function generateExportData(listId: string, selectedReqIds?: string[]): ExportRow[] {
  const list = getLists().find(l => l.list_id === listId);
  if (!list) return [];
  
  const requirements = getRequirementsByListId(listId);
  const filteredRequirements = selectedReqIds 
    ? requirements.filter(r => selectedReqIds.includes(r.req_id))
    : requirements;
  
  return filteredRequirements.map(req => {
    const latestEstimate = getLatestEstimate(req.req_id);
    
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
      contingency_pct: latestEstimate ? Math.round(latestEstimate.contingency_pct * 100) : 0,
      total_days: latestEstimate?.total_days || 0,
      estimator: req.estimator,
      last_estimated_on: req.last_estimated_on || '',
      state: req.state
    };
  });
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