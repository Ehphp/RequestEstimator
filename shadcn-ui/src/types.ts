// Core entity types
export interface List {
  list_id: string;
  name: string;
  description?: string;
  preset_key?: string;
  created_on: string;
  created_by: string;
  status: 'Active' | 'Archived';
  // Additional business fields
  owner?: string;
  period?: string;
  notes?: string;
}

export interface Requirement {
  req_id: string;
  list_id: string;
  title: string;
  description: string;
  priority: 'High' | 'Med' | 'Low';
  state: 'Proposed' | 'Selected' | 'Scheduled' | 'Done';
  business_owner: string;
  labels?: string;
  created_on: string;
  last_estimated_on?: string;
  // Additional business fields
  estimator?: string;
  // Default tracking fields
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
  complexity: 'Low' | 'Medium' | 'High';
  environments: '1 env' | '2 env' | '3 env';
  reuse: 'High' | 'Medium' | 'Low';
  stakeholders: '1 team' | '2-3 team' | '4+ team';
  included_activities: string[];
  optional_activities: string[];
  include_optional: boolean;
  selected_risks: string[];
  activities_base_days: number;
  driver_multiplier: number;
  subtotal_days: number;
  risk_score: number;
  contingency_pct: number;
  contingency_days: number;
  total_days: number;
  catalog_version: string;
  drivers_version: string;
  riskmap_version: string;
  created_on: string;

  // Default tracking fields
  complexity_default_source?: string;
  complexity_is_overridden: boolean;
  environments_default_source?: string;
  environments_is_overridden: boolean;
  reuse_default_source?: string;
  reuse_is_overridden: boolean;
  stakeholders_default_source?: string;
  stakeholders_is_overridden: boolean;
  activities_default_source?: string;
  activities_is_overridden: boolean;
  risks_default_source?: string;
  risks_is_overridden: boolean;
  default_json?: string;
}

// Catalog types
export interface Activity {
  activity_code: string;
  display_name: string;
  driver_group: string;
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

// UI types
export interface DefaultSource {
  field: string;
  value?: string;
  source: string;
  is_overridden?: boolean;
}

export interface EstimateDefaults {
  scenario?: string;
  complexity?: string;
  environments?: string;
  reuse?: string;
  stakeholders?: string;
  included_activities?: string[];
  selected_risks?: string[];
  include_optional?: boolean;
}

export interface StickyDefaults {
  user_id: string;
  list_id: string;
  complexity?: string;
  environments?: string;
  reuse?: string;
  stakeholders?: string;
  included_activities?: string[];
  updated_on: string;
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

// Dashboard types
export interface RequirementWithEstimate {
  requirement: Requirement;
  estimate: Estimate | null;
  estimationDays: number; // total_days from estimate or 0
  difficulty: 1 | 2 | 3 | 4 | 5; // mapped from complexity
  tags: string[]; // parsed from labels
}

export interface DashboardFilters {
  priorities: ('High' | 'Med' | 'Low')[];
  tags: string[];
  startDate: string;
  nDevelopers: number;
  excludeWeekends: boolean;
  holidays: string[];
  colorBy: 'priority' | 'tag';
}

export interface DashboardKPI {
  totalDays: number;
  avgDays: number;
  medianDays: number;
  p80Days: number;
  // Mix difficoltà
  difficultyMix: {
    low: number;    // count with difficulty 1-2
    medium: number; // count with difficulty 3
    high: number;   // count with difficulty 4-5
  };
  // Mix priorità
  priorityMix: {
    High: number;   // count
    Med: number;
    Low: number;
  };
  priorityMixPct: {
    High: number;   // percentage
    Med: number;
    Low: number;
  };
  // Effort per priorità
  effortByPriority: {
    High: number;   // total days
    Med: number;
    Low: number;
  };
  effortByPriorityPct: {
    High: number;   // percentage
    Med: number;
    Low: number;
  };
  // Top tag per effort
  topTagByEffort: {
    tag: string;
    effort: number;
  } | null;
}

export interface ScenarioConfig {
  startDate: string;
  nDevelopers: number;
  excludeWeekends: boolean;
  holidays: string[];
  mode: 'Splittable' | 'Indivisible';
  priorityPolicy: 'Neutral' | 'PriorityFirst' | 'CapacitySplit';
  capacityShare?: {
    High: number;
    Med: number;
    Low: number;
  };
}

export interface ProjectionResult {
  finishDate: string;
  totalWorkdays: number;
  milestones?: {
    finishHigh?: string;
    finishMed?: string;
    finishLow?: string;
  };
}