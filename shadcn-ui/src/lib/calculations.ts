import { drivers, risks, contingencyBands } from '../data/catalog';
import { Estimate, Activity } from '../types';
import { logger } from './logger';

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
  const totalScore = selectedRiskIds.reduce((total, riskId) => {
    const risk = risks.find(r => r.risk_id === riskId);
    return total + (risk?.weight || 0);
  }, 0);

  return totalScore;
}

/**
 * Calcola la percentuale di contingenza basata sul risk score.
 * Utilizza i contingency bands definiti nel catalog per consistenza.
 * 
 * Logica:
 * - Risk score 0: Nessuna contingenza (0%)
 * - Risk score 1-10: Low band (default 10%)
 * - Risk score 11-20: Medium band (default 20%)
 * - Risk score 21+: High band (default 35%)
 * - Cap massimo: 50%
 * 
 * @param riskScore - Peso totale dei rischi selezionati
 * @returns Percentuale di contingenza (0-0.50)
 */
export function getContingencyPercentage(riskScore: number): number {
  let contingencyPct = 0;

  if (riskScore === 0) {
    // BUG FIX: Zero rischi = 0% contingenza (non 5%)
    contingencyPct = 0;
  } else if (riskScore <= 10) {
    // Low risk band
    const lowBand = contingencyBands.find(b => b.band === 'Low');
    contingencyPct = lowBand?.contingency_pct || 0.10;
  } else if (riskScore <= 20) {
    // Medium risk band
    const mediumBand = contingencyBands.find(b => b.band === 'Medium');
    contingencyPct = mediumBand?.contingency_pct || 0.20;
  } else {
    // High risk band (21+)
    const highBand = contingencyBands.find(b => b.band === 'High');
    contingencyPct = highBand?.contingency_pct || 0.35;
  }

  // Cap at maximum 50% contingency
  const finalPct = Math.min(contingencyPct, 0.50);

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

  return result;
}