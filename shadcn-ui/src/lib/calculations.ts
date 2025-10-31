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
  console.log('calculateRiskScore - selectedRiskIds:', selectedRiskIds);
  
  const totalScore = selectedRiskIds.reduce((total, riskId) => {
    const risk = risks.find(r => r.risk_id === riskId);
    console.log('Risk found:', risk);
    return total + (risk?.weight || 0);
  }, 0);
  
  console.log('Total risk score:', totalScore);
  return totalScore;
}

export function getContingencyPercentage(riskScore: number): number {
  console.log('getContingencyPercentage - riskScore:', riskScore);
  
  // Base contingency is 5% (0.05)
  // Add risk score as additional percentage (risk score is already in decimal form)
  const contingencyPct = 0.05 + riskScore;
  
  // Cap at maximum 50% contingency
  const finalPct = Math.min(contingencyPct, 0.50);
  
  console.log('Contingency percentage:', finalPct);
  return finalPct;
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
  console.log('calculateEstimate called with:');
  console.log('- selectedActivities:', selectedActivities.length);
  console.log('- selectedRiskIds:', selectedRiskIds);
  
  // Calcola moltiplicatore driver
  const driverMultiplier = calculateDriverMultiplier(complexity, environments, reuse, stakeholders);
  console.log('Driver multiplier:', driverMultiplier);
  
  // Calcola giorni base attività
  const activitiesBaseDays = selectedActivities.reduce((total, activity) => {
    return total + activity.base_days;
  }, 0);
  console.log('Activities base days:', activitiesBaseDays);
  
  // Calcola subtotal con moltiplicatore
  const subtotalDays = roundHalfUp(activitiesBaseDays * driverMultiplier, 3);
  console.log('Subtotal days:', subtotalDays);
  
  // Calcola rischio e contingenza
  const riskScore = calculateRiskScore(selectedRiskIds);
  const contingencyPct = getContingencyPercentage(riskScore);
  const contingencyDays = roundHalfUp(subtotalDays * contingencyPct, 3);
  
  console.log('Final contingency days:', contingencyDays);
  
  // Calcola totale
  const totalDays = subtotalDays + contingencyDays;
  
  const result = {
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
  
  console.log('Final calculation result:', result);
  return result;
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