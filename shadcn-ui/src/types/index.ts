export interface List {
  list_id: string;
  name: string;
  owner: string;
  period: string;
  notes: string;
  status: 'Draft' | 'In Review' | 'Approved' | 'Archived';
  preset_key?: 'HR_NOTIFY' | 'DV_EXT' | 'AUDIT_STATE';
  created_on: string;
}

export interface Requirement {
  req_id: string;
  list_id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Med' | 'High';
  business_owner: string;
  labels: string;
  state: 'Proposed' | 'Selected' | 'Scheduled' | 'Done';
  estimator: string;
  created_on: string;
  last_estimated_on?: string;
  // Default tracking
  priority_default_source?: string;
  priority_is_overridden?: boolean;
  labels_default_source?: string;
  labels_is_overridden?: boolean;
  description_default_source?: string;
  description_is_overridden?: boolean;
}

export interface Estimate {
  estimate_id: string;
  req_id: string;
  scenario: string;
  // Driver selezionati
  complexity: 'Low' | 'Medium' | 'High';
  environments: '1 env' | '2 env' | '3 env';
  reuse: 'Low' | 'Medium' | 'High';
  stakeholders: '1 team' | '2-3 team' | '4+ team';
  // Attività
  included_activities: string[];
  optional_activities: string[];
  include_optional: boolean;
  // Rischi
  selected_risks: string[];
  risk_score: number;
  contingency_pct: number;
  // Valori calcolati
  activities_base_days: number;
  driver_multiplier: number;
  subtotal_days: number;
  contingency_days: number;
  total_days: number;
  // Versioni cataloghi
  catalog_version: string;
  drivers_version: string;
  riskmap_version: string;
  created_on: string;
  // Default tracking
  complexity_default_source?: string;
  complexity_is_overridden?: boolean;
  environments_default_source?: string;
  environments_is_overridden?: boolean;
  reuse_default_source?: string;
  reuse_is_overridden?: boolean;
  stakeholders_default_source?: string;
  stakeholders_is_overridden?: boolean;
  activities_default_source?: string;
  activities_is_overridden?: boolean;
  risks_default_source?: string;
  risks_is_overridden?: boolean;
  default_json?: string;
}

export interface Activity {
  activity_code: string;
  display_name: string;
  driver_group: 'Analysis' | 'Dataverse' | 'Automation' | 'Comms' | 'Quality' | 'Governance' | 'Analytics';
  base_days: number;
  helper_short: string;
  helper_long: string;
  status: 'Active' | 'Deprecated';
}

export interface Driver {
  driver: string;
  option: string;
  multiplier: number;
  explanation: string;
}

export interface Risk {
  risk_id: string;
  risk_item: string;
  weight: number;
  guidance: string;
}

export interface ContingencyBand {
  band: string;
  level: string;
  contingency_pct: number;
}

export interface ExportRow {
  list_name: string;
  req_id: string;
  title: string;
  priority: string;
  scenario: string;
  complexity: string;
  environments: string;
  reuse: string;
  stakeholders: string;
  subtotal_days: number;
  contingency_pct: number;
  total_days: number;
  estimator: string;
  last_estimated_on: string;
  state: string;
}

export interface PresetConfig {
  preset_key: string;
  name: string;
  description_template: string;
  complexity: string;
  environments: string;
  reuse: string;
  stakeholders: string;
  activities: string[];
  risks: string[];
}

export interface StickyDefaults {
  user: string;
  list_id: string;
  complexity?: string;
  environments?: string;
  reuse?: string;
  stakeholders?: string;
  activities_csv?: string;
  last_updated: string;
}

export interface DefaultSource {
  field: string;
  value: string;
  source: string;
  is_overridden: boolean;
}