// Core entity types
export interface List {
  list_id: string;
  name: string;
  description?: string;
  preset_key?: string;
  created_on: string;
  created_by: string;
  status: 'Draft' | 'Active' | 'Archived';
  // Additional business fields
  owner?: string;
  period?: string;
  notes?: string;
  technology?: string;
  // Default fields for requirements (cascade defaults)
  default_priority?: 'High' | 'Med' | 'Low';
  default_business_owner?: string;
  default_labels?: string;
  default_description?: string;
  // Default fields for estimates (cascade defaults)
  default_environments?: '1 env' | '2 env' | '3 env';
  default_stakeholders?: '1 team' | '2-3 team' | '4+ team' | null;
  default_reuse?: 'High' | 'Medium' | 'Low' | null;
}

export interface Requirement {
  req_id: string;
  list_id: string;
  parent_req_id?: string | null;
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
  environments?: string;
  stakeholders?: string;
  environments_default_source?: string;
  environments_is_overridden?: boolean;
  stakeholders_default_source?: string;
  stakeholders_is_overridden?: boolean;
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

  // Optional per-estimate overrides for activities. Low-impact: kept optional and
  // separate from `included_activities` (which remains string[]) so existing
  // code that expects string[] keeps working. When present, UIs should merge
  // these overrides with the catalog activity definitions for display and
  // for calculation (override base_days/name/driver_group).
  included_activities_overrides?: Array<{
    activity_code: string;
    override_name?: string;
    override_days?: number;
    override_group?: string;
  }>;
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
  category: 'Technical' | 'Business' | 'Governance' | 'Integration';
  weight: number;
  guidance: string;
  mitigation: string;
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

// Per-list catalog for activities (persisted by list and optional technology)
export interface ListActivityCatalog {
  id?: string; // db id or uuid
  list_id: string;
  technology?: string | null;
  // catalog structured as groups -> activities. Activities reuse the Activity type.
  catalog: {
    groups: Array<{
      group: string;
      activities: Activity[];
    }>;
    // Optional per-list exclusions (activity codes or whole groups) stored with the catalog
    excluded_activity_codes?: string[];
    excluded_groups?: string[];
  };
  created_on?: string;
  updated_on?: string;
  created_by?: string;
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
  targetDate?: string; // Data obiettivo opzionale per calcolo velocity
  nDevelopers: number;
  excludeWeekends: boolean;
  holidays: string[];
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
  priorityPolicy: 'Neutral' | 'PriorityFirst';
}

export interface ProjectionResult {
  finishDate: string;
  totalWorkdays: number;
}
