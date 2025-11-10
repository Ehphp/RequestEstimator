import { drivers, risks, contingencyBands } from '../data/catalog';
import { Estimate, Activity, RequirementWithEstimate, DashboardKPI, Requirement } from '../types';
import { getLatestEstimates } from './storage';
import { parseLabels } from './utils';
import {
  RISK_THRESHOLDS,
  CONTINGENCY_RATES,
  COMPLEXITY_TO_DIFFICULTY,
  DEFAULT_DIFFICULTY,
  PRECISION,
  CATALOG_VERSIONS
} from './constants';
import {
  buildRequirementTree,
  calculateCriticalPathLength
} from './requirementsHierarchy';

export function roundHalfUp(num: number, decimals: number = PRECISION.DAYS_DECIMALS): number {
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
 * Utilizza le soglie definite in constants.ts per consistenza.
 * 
 * Logica:
 * - Risk score 0: Nessuna contingenza (0%)
 * - Risk score 1-10: Low band (10%)
 * - Risk score 11-20: Medium band (20%)
 * - Risk score 21+: High band (35%)
 * - Cap massimo: 50%
 * 
 * @param riskScore - Peso totale dei rischi selezionati
 * @returns Percentuale di contingenza (0-0.50)
 */
export function getContingencyPercentage(riskScore: number): number {
  let contingencyPct: number = CONTINGENCY_RATES.NONE;

  if (riskScore === RISK_THRESHOLDS.NONE) {
    contingencyPct = CONTINGENCY_RATES.NONE;
  } else if (riskScore <= RISK_THRESHOLDS.LOW) {
    // Low risk band
    const lowBand = contingencyBands.find(b => b.band === 'Low');
    contingencyPct = lowBand?.contingency_pct || CONTINGENCY_RATES.LOW;
  } else if (riskScore <= RISK_THRESHOLDS.MEDIUM) {
    // Medium risk band
    const mediumBand = contingencyBands.find(b => b.band === 'Medium');
    contingencyPct = mediumBand?.contingency_pct || CONTINGENCY_RATES.MEDIUM;
  } else {
    // High risk band (21+)
    const highBand = contingencyBands.find(b => b.band === 'High');
    contingencyPct = highBand?.contingency_pct || CONTINGENCY_RATES.HIGH;
  }

  // Cap at maximum contingency
  return Math.min(contingencyPct, CONTINGENCY_RATES.MAX);
}

export function calculateEstimate(
  selectedActivities: Activity[],
  complexity: string,
  environments: string,
  reuse: string,
  stakeholders: string,
  selectedRiskIds: string[]
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
    activities_base_days: roundHalfUp(activitiesBaseDays, PRECISION.DAYS_DECIMALS),
    driver_multiplier: roundHalfUp(driverMultiplier, PRECISION.MULTIPLIER_DECIMALS),
    subtotal_days: subtotalDays,
    risk_score: riskScore,
    contingency_pct: contingencyPct,
    contingency_days: contingencyDays,
    total_days: roundHalfUp(totalDays, PRECISION.DAYS_DECIMALS),
    catalog_version: CATALOG_VERSIONS.ACTIVITIES,
    drivers_version: CATALOG_VERSIONS.DRIVERS,
    riskmap_version: CATALOG_VERSIONS.RISKS
  };

  return result;
}

// ============================================================================
// DASHBOARD KPI CALCULATIONS
// ============================================================================

/**
 * Mappa complexity in difficulty numerica usando le costanti definite
 */
export function mapComplexityToDifficulty(complexity: string): 1 | 2 | 3 | 4 | 5 {
  const mapping = COMPLEXITY_TO_DIFFICULTY[complexity as keyof typeof COMPLEXITY_TO_DIFFICULTY];
  return (mapping || DEFAULT_DIFFICULTY) as 1 | 2 | 3 | 4 | 5;
}

/**
 * Prepara i dati combinando requirements e loro estimates
 */
export async function prepareRequirementsWithEstimates(requirements: Requirement[]): Promise<RequirementWithEstimate[]> {
  if (requirements.length === 0) {
    return [];
  }

  const latestEstimates = await getLatestEstimates(requirements.map(req => req.req_id));

  return requirements.map((req) => {
    const estimate = latestEstimates[req.req_id] || null;
    const estimationDays = estimate?.total_days || 0;
    const difficulty = estimate?.complexity ? mapComplexityToDifficulty(estimate.complexity) : 3;
    const tags = parseLabels(req.labels);

    return {
      requirement: req,
      estimate,
      estimationDays,
      difficulty,
      tags
    };
  });
}

/**
 * Calculates the critical path (longest dependent chain) considering parent-child relationships.
 * Each requirement contributes with its own estimation days, allowing parents and children to have independent effort.
 */
export function calculateRequirementCriticalPath(
  requirements: RequirementWithEstimate[]
): number {
  if (requirements.length === 0) {
    return 0;
  }

  const tree = buildRequirementTree<RequirementWithEstimate>(requirements, {
    getId: (item) => item.requirement.req_id,
    getParentId: (item) => item.requirement.parent_req_id ?? null
  });

  return calculateCriticalPathLength(tree, (item) => item.estimationDays || 0);
}

/**
 * Calcola la mediana di un array di numeri
 */
function calculateMedian(values: number[], alreadySorted: boolean = false): number {
  if (values.length === 0) return 0;

  const sorted = alreadySorted ? values : [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calcola il percentile P di un array di numeri
 */
function calculatePercentile(values: number[], p: number, alreadySorted: boolean = false): number {
  if (values.length === 0) return 0;

  const sorted = alreadySorted ? values : [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calcola tutti i KPI della dashboard
 */
export function calculateDashboardKPIs(reqsWithEstimates: RequirementWithEstimate[]): DashboardKPI {
  const initial = {
    estimatedDays: [] as number[],
    estimatedCount: 0,
    totalDays: 0,
    difficultyMix: {
      low: 0,
      medium: 0,
      high: 0
    },
    priorityMix: {
      High: 0,
      Med: 0,
      Low: 0
    },
    effortByPriority: {
      High: 0,
      Med: 0,
      Low: 0
    },
    tagEfforts: new Map<string, number>()
  };

  const aggregates = reqsWithEstimates.reduce((acc, entry) => {
    const { estimationDays, difficulty, requirement, tags } = entry;
    const priority = requirement.priority;

    if (difficulty <= 2) {
      acc.difficultyMix.low += 1;
    } else if (difficulty >= 4) {
      acc.difficultyMix.high += 1;
    } else {
      acc.difficultyMix.medium += 1;
    }

    acc.priorityMix[priority] += 1;

    if (estimationDays > 0) {
      acc.estimatedDays.push(estimationDays);
      acc.estimatedCount += 1;
      acc.totalDays += estimationDays;
      acc.effortByPriority[priority] += estimationDays;

      tags.forEach(tag => {
        if (!tag) {
          return;
        }
        const current = acc.tagEfforts.get(tag) || 0;
        acc.tagEfforts.set(tag, current + estimationDays);
      });
    }

    return acc;
  }, initial);

  const totalReqs = reqsWithEstimates.length;
  const avgDays = aggregates.estimatedCount > 0 ? aggregates.totalDays / aggregates.estimatedCount : 0;
  const sortedEstimatedDays = [...aggregates.estimatedDays].sort((a, b) => a - b);
  const medianDays = calculateMedian(sortedEstimatedDays, true);
  const p80Days = calculatePercentile(sortedEstimatedDays, 80, true);

  const priorityMixPct = {
    High: totalReqs > 0 ? (aggregates.priorityMix.High / totalReqs) * 100 : 0,
    Med: totalReqs > 0 ? (aggregates.priorityMix.Med / totalReqs) * 100 : 0,
    Low: totalReqs > 0 ? (aggregates.priorityMix.Low / totalReqs) * 100 : 0
  };

  const effortByPriorityPct = {
    High: aggregates.totalDays > 0 ? (aggregates.effortByPriority.High / aggregates.totalDays) * 100 : 0,
    Med: aggregates.totalDays > 0 ? (aggregates.effortByPriority.Med / aggregates.totalDays) * 100 : 0,
    Low: aggregates.totalDays > 0 ? (aggregates.effortByPriority.Low / aggregates.totalDays) * 100 : 0
  };

  let topTagByEffort: { tag: string; effort: number } | null = null;
  let maxEffort = 0;
  aggregates.tagEfforts.forEach((effort, tag) => {
    if (effort > maxEffort) {
      maxEffort = effort;
      topTagByEffort = { tag, effort };
    }
  });

  return {
    totalDays: roundHalfUp(aggregates.totalDays, 1),
    avgDays: roundHalfUp(avgDays, 1),
    medianDays: roundHalfUp(medianDays, 1),
    p80Days: roundHalfUp(p80Days, 1),
    difficultyMix: aggregates.difficultyMix,
    priorityMix: aggregates.priorityMix,
    priorityMixPct: {
      High: roundHalfUp(priorityMixPct.High, 1),
      Med: roundHalfUp(priorityMixPct.Med, 1),
      Low: roundHalfUp(priorityMixPct.Low, 1)
    },
    effortByPriority: {
      High: roundHalfUp(aggregates.effortByPriority.High, 1),
      Med: roundHalfUp(aggregates.effortByPriority.Med, 1),
      Low: roundHalfUp(aggregates.effortByPriority.Low, 1)
    },
    effortByPriorityPct: {
      High: roundHalfUp(effortByPriorityPct.High, 1),
      Med: roundHalfUp(effortByPriorityPct.Med, 1),
      Low: roundHalfUp(effortByPriorityPct.Low, 1)
    },
    topTagByEffort
  };
}

/**
 * Calcola il Confidence Score (0-100) della dashboard basato su:
 * - Completezza stime (40 punti max)
 * - Consistenza stime (30 punti max)
 * - Volume dati (20 punti max)
 * - Categorizzazione (10 punti max)
 */
export function calculateConfidenceScore(kpis: DashboardKPI, totalReqs: number): {
  score: number;
  level: 'low' | 'medium' | 'high';
  breakdown: {
    completeness: number;
    consistency: number;
    volume: number;
    categorization: number;
  };
} {
  // 1. Completezza: % requisiti stimati (max 40 punti)
  const estimatedCount = kpis.priorityMix.High + kpis.priorityMix.Med + kpis.priorityMix.Low;
  const completeness = totalReqs > 0 ? (estimatedCount / totalReqs) * 40 : 0;

  // 2. Consistenza: quanto sono uniformi le stime (max 30 punti)
  // Più p80 è vicino alla media, più sono consistenti
  const consistency = kpis.avgDays > 0
    ? Math.max(0, (1 - Math.abs(kpis.p80Days - kpis.avgDays) / kpis.p80Days) * 30)
    : 0;

  // 3. Volume dati: più requisiti = più affidabile (max 20 punti)
  const volume = Math.min(20, (totalReqs / 5) * 20); // 5+ requisiti = 20 punti

  // 4. Categorizzazione: presenza di tag (max 10 punti)
  const categorization = kpis.topTagByEffort ? 10 : 0;

  const score = Math.round(completeness + consistency + volume + categorization);

  let level: 'low' | 'medium' | 'high';
  if (score >= 80) level = 'high';
  else if (score >= 50) level = 'medium';
  else level = 'low';

  return {
    score,
    level,
    breakdown: {
      completeness: Math.round(completeness),
      consistency: Math.round(consistency),
      volume: Math.round(volume),
      categorization: Math.round(categorization)
    }
  };
}

/**
 * Identifica deviation alerts basati su soglie critiche dei KPI
 */
export function calculateDeviationAlerts(
  kpis: DashboardKPI,
  totalWorkdays: number,
  totalDays: number
): Array<{
  type: 'warning' | 'info' | 'critical';
  icon: string;
  message: string;
  tooltip: string;
}> {
  const alerts: Array<{
    type: 'warning' | 'info' | 'critical';
    icon: string;
    message: string;
    tooltip: string;
  }> = [];

  // Alert 1: Requisiti medi complessi
  if (kpis.avgDays > 10) {
    alerts.push({
      type: 'warning',
      icon: '⚠️',
      message: 'Req medi complessi',
      tooltip: `Media ${kpis.avgDays}gg/req - considerare breakdown in task più piccoli`
    });
  }

  // Alert 2: Alta varianza nelle stime
  if (kpis.p80Days > kpis.avgDays * 2) {
    alerts.push({
      type: 'info',
      icon: '📊',
      message: 'Alta varianza stime',
      tooltip: `P80 (${kpis.p80Days}gg) è ${Math.round((kpis.p80Days / kpis.avgDays - 1) * 100)}% sopra la media - alcune stime molto più alte`
    });
  }

  // Alert 3: Concentrazione su High priority
  if (kpis.effortByPriorityPct.High > 60) {
    alerts.push({
      type: 'critical',
      icon: '🔴',
      message: 'Concentrazione High',
      tooltip: `${kpis.effortByPriorityPct.High}% effort su priorità High - rischio bottleneck`
    });
  }

  // Alert 4: Progetto high-complexity
  const totalDifficulty = kpis.difficultyMix.low + kpis.difficultyMix.medium + kpis.difficultyMix.high;
  const highPct = totalDifficulty > 0 ? (kpis.difficultyMix.high / totalDifficulty) * 100 : 0;
  if (highPct > 50) {
    alerts.push({
      type: 'warning',
      icon: '🏔️',
      message: 'High-complexity',
      tooltip: `${Math.round(highPct)}% requisiti ad alta difficoltà - allocare senior developers`
    });
  }

  // Alert 5: Timeline stretched
  if (totalWorkdays > totalDays * 1.5) {
    alerts.push({
      type: 'info',
      icon: '⏱️',
      message: 'Timeline stretched',
      tooltip: `${totalWorkdays} giorni lavorativi per ${totalDays} gg/uomo - considerare più risorse`
    });
  }

  // Alert 6: Progetto grande
  if (kpis.totalDays > 200) {
    alerts.push({
      type: 'critical',
      icon: '🚀',
      message: 'Progetto XL',
      tooltip: `${kpis.totalDays} gg/uomo - considerare milestone e deliverable incrementali`
    });
  } else if (kpis.totalDays > 100) {
    alerts.push({
      type: 'warning',
      icon: '📦',
      message: 'Progetto Large',
      tooltip: `${kpis.totalDays} gg/uomo - monitorare progress settimanalmente`
    });
  }

  return alerts.slice(0, 4); // Mostra max 4 alert per non sovraccaricare UI
}

// ============================================================================
// CALENDAR FUNCTIONS
// ============================================================================

/**
 * Verifica se una data è un weekend
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Domenica o Sabato
}

/**
 * Verifica se una data è una festività
 */
function isHoliday(date: Date, holidays: string[]): boolean {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return holidays.includes(dateStr);
}

/**
 * Verifica se una data è un giorno lavorativo
 */
function isWorkday(date: Date, excludeWeekends: boolean, holidays: string[]): boolean {
  if (excludeWeekends && isWeekend(date)) return false;
  if (isHoliday(date, holidays)) return false;
  return true;
}

/**
 * Aggiunge N giorni lavorativi a una data
 */
export function addWorkdays(
  startDate: string,
  workdays: number,
  excludeWeekends: boolean,
  holidays: string[]
): string {
  const date = new Date(startDate);
  let remainingDays = workdays;

  while (remainingDays > 0) {
    date.setDate(date.getDate() + 1);
    if (isWorkday(date, excludeWeekends, holidays)) {
      remainingDays--;
    }
  }

  return date.toISOString().split('T')[0];
}

/**
 * Conta i giorni lavorativi tra due date
 */
export function countWorkdays(
  startDate: string,
  endDate: string,
  excludeWeekends: boolean,
  holidays: string[]
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;

  const current = new Date(start);
  while (current <= end) {
    if (isWorkday(current, excludeWeekends, holidays)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// ============================================================================
// PROJECTION CALCULATIONS
// ============================================================================

/**
 * Calcola proiezione Neutral: capacità distribuita uniformemente
 */
export function calculateNeutralProjection(
  totalDays: number,
  nDevelopers: number,
  startDate: string,
  excludeWeekends: boolean,
  holidays: string[]
): { finishDate: string; totalWorkdays: number } {
  const capacityPerDay = nDevelopers; // gg/uomo per giorno
  const workdays = Math.ceil(totalDays / capacityPerDay);
  const finishDate = addWorkdays(startDate, workdays, excludeWeekends, holidays);

  return {
    finishDate,
    totalWorkdays: workdays
  };
}

/**
 * Calcola proiezione Priority-First: completa prima High, poi Med, poi Low
 */
export function calculatePriorityFirstProjection(
  effortByPriority: { High: number; Med: number; Low: number },
  nDevelopers: number,
  startDate: string,
  excludeWeekends: boolean,
  holidays: string[]
): {
  finishDate: string;
  totalWorkdays: number;
  milestones: {
    finishHigh: string;
    finishMed: string;
    finishLow: string;
  };
} {
  const capacityPerDay = nDevelopers;

  // Calcola workdays per ogni priorità
  const workdaysHigh = Math.ceil(effortByPriority.High / capacityPerDay);
  const workdaysMed = Math.ceil(effortByPriority.Med / capacityPerDay);
  const workdaysLow = Math.ceil(effortByPriority.Low / capacityPerDay);

  // Calcola milestone dates sequenziali
  const finishHigh = addWorkdays(startDate, workdaysHigh, excludeWeekends, holidays);
  const finishMed = addWorkdays(finishHigh, workdaysMed, excludeWeekends, holidays);
  const finishLow = addWorkdays(finishMed, workdaysLow, excludeWeekends, holidays);

  return {
    finishDate: finishLow,
    totalWorkdays: workdaysHigh + workdaysMed + workdaysLow,
    milestones: {
      finishHigh,
      finishMed,
      finishLow
    }
  };
}
