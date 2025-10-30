import { PresetConfig } from '../types';

export const presets: PresetConfig[] = [
  {
    preset_key: 'HR_NOTIFY',
    name: 'HR-Notifiche',
    description_template: 'Implementare notifica {evento} con template standard e routing HR/SLM/PM',
    complexity: 'Medium',
    environments: '3 env',
    reuse: 'High',
    stakeholders: '2-3 team',
    activities: ['ANL_ALIGN', 'PA_FLOW', 'PA_CHILD', 'MAIL_TEMP', 'RECIP_CONF', 'E2E_TEST', 'UAT_RUN', 'DOC_HAND', 'DEPLOY'],
    risks: []
  },
  {
    preset_key: 'DV_EXT',
    name: 'Dataverse-Estensioni',
    description_template: 'Aggiunta campi e UX su form con validazioni BR/JS',
    complexity: 'Medium',
    environments: '2 env',
    reuse: 'Medium',
    stakeholders: '1 team',
    activities: ['DV_FIELD', 'DV_FORM', 'E2E_TEST', 'UAT_RUN', 'DOC_HAND', 'DEPLOY'],
    risks: []
  },
  {
    preset_key: 'AUDIT_STATE',
    name: 'Audit/Storico',
    description_template: 'Determinare stato precedente e azioni conseguenti (Audit/Storico)',
    complexity: 'High',
    environments: '3 env',
    reuse: 'Low',
    stakeholders: '2-3 team',
    activities: ['DV_FIELD', 'PA_FLOW', 'E2E_TEST', 'UAT_RUN', 'DOC_HAND', 'DEPLOY'],
    risks: ['R001', 'R002'] // R_AUDIT, R_EDGE equivalent
  }
];

export const labelDictionary: Record<string, string[]> = {
  'HR': ['lettera', 'accettazione', 'candidatura', 'onboarding', 'notifica', 'dipendente'],
  'IT': ['sistema', 'integrazione', 'server', 'database', 'sicurezza'],
  'Finance': ['budget', 'costo', 'fattura', 'pagamento', 'contabilità'],
  'Notifiche': ['email', 'alert', 'comunicazione', 'avviso', 'template'],
  'Compliance': ['audit', 'controllo', 'normativa', 'regolamento', 'policy'],
  'Critical': ['critico', 'blocco', 'produzione', 'emergenza', 'urgente']
};

export function getCurrentQuarter(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  if (month <= 3) return `Q1/${year}`;
  if (month <= 6) return `Q2/${year}`;
  if (month <= 9) return `Q3/${year}`;
  return `Q4/${year}`;
}

export function inferPriorityFromTitle(title: string): string {
  const titleLower = title.toLowerCase();
  
  const highKeywords = ['critico', 'compliance', 'blocco', 'produzione', 'onboarding'];
  const lowKeywords = ['miglioria', 'refactor', 'cosmetico'];
  
  if (highKeywords.some(keyword => titleLower.includes(keyword))) {
    return 'High';
  }
  
  if (lowKeywords.some(keyword => titleLower.includes(keyword))) {
    return 'Low';
  }
  
  return 'Med';
}

export function inferLabelsFromTitle(title: string): string[] {
  const titleLower = title.toLowerCase();
  const inferredLabels: string[] = [];
  
  Object.entries(labelDictionary).forEach(([label, keywords]) => {
    if (keywords.some(keyword => titleLower.includes(keyword))) {
      inferredLabels.push(label);
    }
  });
  
  return inferredLabels;
}

export function inferStakeholdersFromLabels(labels: string[]): string {
  if (labels.length <= 1) return '1 team';
  if (labels.length >= 4) return '4+ team';
  return '2-3 team';
}

export function shouldIncludeOptionalActivities(title: string): boolean {
  const titleLower = title.toLowerCase();
  const stateChangeKeywords = ['annulla', 'ripensamento', 'chiudi', 'revoca'];
  return stateChangeKeywords.some(keyword => titleLower.includes(keyword));
}

export function inferRisksFromTitle(title: string): string[] {
  const titleLower = title.toLowerCase();
  const risks: string[] = [];
  
  // R_EDGE equivalent - toggle verbs
  const toggleKeywords = ['accetta', 'ritira', 'attiva', 'disattiva', 'si/no'];
  if (toggleKeywords.some(keyword => titleLower.includes(keyword))) {
    risks.push('R002'); // Using existing risk as R_EDGE equivalent
  }
  
  // R_AUDIT equivalent - audit/state keywords
  const auditKeywords = ['stato precedente', 'audit', 'storico'];
  if (auditKeywords.some(keyword => titleLower.includes(keyword))) {
    risks.push('R001'); // Using existing risk as R_AUDIT equivalent
  }
  
  return risks;
}