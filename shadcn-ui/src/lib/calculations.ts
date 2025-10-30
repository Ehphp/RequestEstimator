import { drivers, risks, contingencyBands } from '../data/catalog';
import { Estimate, Activity } from '../types';

export function roundHalfUp(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export function calculateDriverMultiplier(
  complexity: string,
  environments: string,
  reuse: string,
  stakeholders: string
): number {
  const complexityDriver = drivers.find(d => d.driver === 'complexity' && d.option === complexity);
  const environmentsDriver = drivers.find(d => d.driver === 'environments' && d.option === environments);
  const reuseDriver = drivers.find(d => d.driver === 'reuse' && d.option === reuse);
  const stakeholdersDriver = drivers.find(d => d.driver === 'stakeholders' && d.option === stakeholders);

  if (!complexityDriver || !environmentsDriver || !reuseDriver || !stakeholdersDriver) {
    throw new Error('Driver mancanti per il calcolo');
  }

  return complexityDriver.multiplier * 
         environmentsDriver.multiplier * 
         reuseDriver.multiplier * 
         stakeholdersDriver.multiplier;
}

export function calculateRiskScore(selectedRiskIds: string[]): number {
  return selectedRiskIds.reduce((total, riskId) => {
    const risk = risks.find(r => r.risk_id === riskId);
    return total + (risk?.weight || 0);
  }, 0);
}

export function getContingencyPercentage(riskScore: number): number {
  if (riskScore <= 10) return 0.10;
  if (riskScore <= 20) return 0.20;
  return 0.35;
}

export function calculateEstimate(
  selectedActivities: Activity[],
  complexity: string,
  environments: string,
  reuse: string,
  stakeholders: string,
  selectedRiskIds: string[],
  includeOptional: boolean = false
): Partial<Estimate> {
  // Calcola moltiplicatore driver
  const driverMultiplier = calculateDriverMultiplier(complexity, environments, reuse, stakeholders);
  
  // Calcola giorni base attività
  const activitiesBaseDays = selectedActivities.reduce((total, activity) => {
    return total + activity.base_days;
  }, 0);
  
  // Calcola subtotal con moltiplicatore
  const subtotalDays = roundHalfUp(activitiesBaseDays * driverMultiplier, 3);
  
  // Calcola rischio e contingenza
  const riskScore = calculateRiskScore(selectedRiskIds);
  const contingencyPct = getContingencyPercentage(riskScore);
  const contingencyDays = roundHalfUp(subtotalDays * contingencyPct, 3);
  
  // Calcola totale
  const totalDays = subtotalDays + contingencyDays;
  
  return {
    activities_base_days: roundHalfUp(activitiesBaseDays, 3),
    driver_multiplier: roundHalfUp(driverMultiplier, 3),
    subtotal_days: subtotalDays,
    risk_score: riskScore,
    contingency_pct: contingencyPct,
    contingency_days: contingencyDays,
    total_days: roundHalfUp(totalDays, 3),
    catalog_version: 'v1.0',
    drivers_version: 'v1.0',
    riskmap_version: 'v1.0'
  };
}

export function validateEstimateInputs(
  complexity: string,
  environments: string,
  reuse: string,
  stakeholders: string,
  selectedActivities: Activity[]
): string[] {
  const errors: string[] = [];
  
  if (!complexity) errors.push('Seleziona complessità');
  if (!environments) errors.push('Seleziona ambienti');
  if (!reuse) errors.push('Seleziona livello di riutilizzo');
  if (!stakeholders) errors.push('Seleziona numero stakeholder');
  if (selectedActivities.length === 0) errors.push('Seleziona almeno un\'attività');
  
  return errors;
}