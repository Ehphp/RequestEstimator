import { Activity, Driver, Risk } from '../types';

export function calculateEstimate(
  selectedActivities: Activity[],
  complexity: string,
  environments: string,
  reuse: string,
  stakeholders: string,
  selectedRisks: string[],
  includeOptional: boolean = false
) {
  // Calculate base days from selected activities
  const activitiesBaseDays = selectedActivities.reduce((total, activity) => {
    return total + activity.base_days;
  }, 0);

  // Get driver multipliers (these should be imported from catalog or passed as parameters)
  const drivers = [
    // Complexity drivers
    { driver: 'complexity', option: 'Low', multiplier: 0.8, explanation: 'Bassa complessità' },
    { driver: 'complexity', option: 'Medium', multiplier: 1.0, explanation: 'Media complessità' },
    { driver: 'complexity', option: 'High', multiplier: 1.3, explanation: 'Alta complessità' },
    { driver: 'complexity', option: 'Very High', multiplier: 1.6, explanation: 'Complessità molto alta' },
    
    // Environment drivers
    { driver: 'environments', option: '1', multiplier: 1.0, explanation: 'Un ambiente' },
    { driver: 'environments', option: '2-3', multiplier: 1.2, explanation: 'Due o tre ambienti' },
    { driver: 'environments', option: '4+', multiplier: 1.4, explanation: 'Quattro o più ambienti' },
    
    // Reuse drivers
    { driver: 'reuse', option: 'High', multiplier: 0.7, explanation: 'Alto riutilizzo' },
    { driver: 'reuse', option: 'Medium', multiplier: 0.9, explanation: 'Medio riutilizzo' },
    { driver: 'reuse', option: 'Low', multiplier: 1.1, explanation: 'Basso riutilizzo' },
    { driver: 'reuse', option: 'None', multiplier: 1.3, explanation: 'Nessun riutilizzo' },
    
    // Stakeholder drivers
    { driver: 'stakeholders', option: 'Few', multiplier: 0.9, explanation: 'Pochi stakeholder' },
    { driver: 'stakeholders', option: 'Some', multiplier: 1.0, explanation: 'Alcuni stakeholder' },
    { driver: 'stakeholders', option: 'Many', multiplier: 1.2, explanation: 'Molti stakeholder' },
    { driver: 'stakeholders', option: 'Very Many', multiplier: 1.4, explanation: 'Moltissimi stakeholder' }
  ];

  // Get multipliers for each driver
  const complexityMultiplier = drivers.find(d => d.driver === 'complexity' && d.option === complexity)?.multiplier || 1.0;
  const environmentsMultiplier = drivers.find(d => d.driver === 'environments' && d.option === environments)?.multiplier || 1.0;
  const reuseMultiplier = drivers.find(d => d.driver === 'reuse' && d.option === reuse)?.multiplier || 1.0;
  const stakeholdersMultiplier = drivers.find(d => d.driver === 'stakeholders' && d.option === stakeholders)?.multiplier || 1.0;

  // Calculate combined driver multiplier
  const driverMultiplier = complexityMultiplier * environmentsMultiplier * reuseMultiplier * stakeholdersMultiplier;

  // Calculate subtotal
  const subtotalDays = Math.round(activitiesBaseDays * driverMultiplier);

  // Calculate contingency based on selected risks
  const risks = [
    { risk_id: 'TECH_COMPLEXITY', risk_item: 'Complessità tecnica non prevista', weight: 0.15, guidance: 'Rischio di sottostimare la complessità tecnica' },
    { risk_id: 'REQUIREMENTS_CHANGE', risk_item: 'Cambiamenti nei requisiti', weight: 0.20, guidance: 'Possibili modifiche durante lo sviluppo' },
    { risk_id: 'INTEGRATION_ISSUES', risk_item: 'Problemi di integrazione', weight: 0.12, guidance: 'Difficoltà nell\'integrazione con sistemi esistenti' },
    { risk_id: 'RESOURCE_AVAILABILITY', risk_item: 'Disponibilità risorse', weight: 0.10, guidance: 'Risorse chiave non disponibili quando necessario' },
    { risk_id: 'EXTERNAL_DEPENDENCIES', risk_item: 'Dipendenze esterne', weight: 0.08, guidance: 'Ritardi causati da fornitori o sistemi esterni' },
    { risk_id: 'TESTING_COMPLEXITY', risk_item: 'Complessità del testing', weight: 0.10, guidance: 'Test più complessi del previsto' },
    { risk_id: 'PERFORMANCE_REQUIREMENTS', risk_item: 'Requisiti di performance', weight: 0.12, guidance: 'Ottimizzazioni non previste per raggiungere le performance' },
    { risk_id: 'SECURITY_REQUIREMENTS', risk_item: 'Requisiti di sicurezza', weight: 0.08, guidance: 'Implementazione di misure di sicurezza aggiuntive' }
  ];

  // Calculate contingency percentage based on selected risks
  let contingencyPct = 0.05; // Base contingency of 5%
  
  if (selectedRisks && selectedRisks.length > 0) {
    const selectedRiskObjects = risks.filter(risk => selectedRisks.includes(risk.risk_id));
    const riskWeight = selectedRiskObjects.reduce((total, risk) => total + risk.weight, 0);
    contingencyPct = Math.min(0.05 + riskWeight, 0.50); // Cap at 50% contingency
  }

  const contingencyDays = Math.round(subtotalDays * contingencyPct);
  const totalDays = subtotalDays + contingencyDays;

  return {
    activities_base_days: activitiesBaseDays,
    driver_multiplier: Number(driverMultiplier.toFixed(2)),
    subtotal_days: subtotalDays,
    contingency_pct: Number(contingencyPct.toFixed(3)),
    contingency_days: contingencyDays,
    total_days: totalDays,
    // Add breakdown for transparency
    complexity_multiplier: complexityMultiplier,
    environments_multiplier: environmentsMultiplier,
    reuse_multiplier: reuseMultiplier,
    stakeholders_multiplier: stakeholdersMultiplier,
    selected_risks_count: selectedRisks ? selectedRisks.length : 0,
    selected_risks_weight: selectedRisks && selectedRisks.length > 0 
      ? risks.filter(risk => selectedRisks.includes(risk.risk_id)).reduce((total, risk) => total + risk.weight, 0)
      : 0
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

  if (!complexity) {
    errors.push('Seleziona la complessità');
  }

  if (!environments) {
    errors.push('Seleziona il numero di ambienti');
  }

  if (!reuse) {
    errors.push('Seleziona il livello di riutilizzo');
  }

  if (!stakeholders) {
    errors.push('Seleziona il numero di stakeholder');
  }

  if (selectedActivities.length === 0) {
    errors.push('Seleziona almeno una attività');
  }

  return errors;
}