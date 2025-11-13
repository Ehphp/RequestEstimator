import { List, Requirement, Estimate, StickyDefaults, DefaultSource } from '../types';
import { presets, getCurrentQuarter, inferPriorityFromTitle, inferLabelsFromTitle, shouldIncludeOptionalActivities, inferRisksFromTitle } from '../data/presets';
import { getStickyDefaults as getSupabaseStickyDefaults, saveStickyDefaults as saveSupabaseStickyDefaults } from './storage';
import { logger } from './logger';
// ...existing code...

/**
 * DEFAULTS SYSTEM ARCHITECTURE
 * ============================
 * 
 * This module implements a multi-tiered cascade defaults system with three levels:
 * 
 * 1. LIST DEFAULTS (getListDefaults)
 *    - Owner, period, status for lists
 *    - NEW: Default values for requirements (priority, business_owner, labels, description)
 * 
 * 2. REQUIREMENT DEFAULTS (getRequirementDefaults) - CASCADE LOGIC:
 *    Priority:       List Default → Keyword Analysis → System Default ('Med')
 *    Business Owner: List.default_business_owner → List.owner → Empty
 *    Labels:         List Default → Keyword Analysis → Empty
 *    Description:    List Default → Preset Template → Empty
 * 
 * 3. ESTIMATE DEFAULTS (getEstimateDefaults) - CASCADE LOGIC:
 *    Complexity:     Sticky/Estimator → Preset → Default ('Medium')
 *    Environments:   Preset → Default ('2 env')
 *    Reuse:          Preset → Default ('Medium')
 *    Stakeholders:   Labels Analysis → Preset → Default ('1 team')
 *    Activities:     Sticky/Estimator → Preset → Empty
 *    Risks:          Title Analysis → Preset → Empty
 * 
 * KEY PRINCIPLES:
 * - Explicit defaults (List, Preset) always override inference
 * - Inference (Keywords, Analysis) provides smart fallbacks
 * - System defaults ensure all required fields have values
 * - Backward compatible: existing data continues to work
 * - All defaults tracked with source attribution for transparency
 */

// Sticky defaults management (now using Supabase)
export async function getStickyDefaults(
  user: string,
  listId: string,
  onError?: (error: unknown) => void
): Promise<StickyDefaults | null> {
  return await getSupabaseStickyDefaults(user, listId, onError);
}

export async function saveStickyDefaults(sticky: StickyDefaults): Promise<void> {
  try {
    // Assicurati che last_updated sia presente
    const updatedSticky = {
      ...sticky,
      updated_on: new Date().toISOString()
    };
    await saveSupabaseStickyDefaults(updatedSticky);
  } catch (error) {
    logger.error('Error saving sticky defaults:', error);
    throw error;
  }
}

// List defaults
export function getListDefaults(currentUser: string): Partial<List> {
  return {
    period: getCurrentQuarter(),
    owner: currentUser,
    status: 'Active',
    notes: '',
    technology: 'Power Platform'
  };
}

// Requirement defaults with cascade logic: List Default → Preset → Keyword Analysis → System Default
export function getRequirementDefaults(
  list: List,
  currentUser: string,
  title: string = ''
): { defaults: Partial<Requirement>; sources: DefaultSource[] } {
  const preset = list.preset_key ? presets.find(p => p.preset_key === list.preset_key) : null;
  const sources: DefaultSource[] = [];

  // PRIORITY: List Default → Keyword Analysis → System Default
  let priority: Requirement['priority'];
  let prioritySource: string;
  if (list.default_priority) {
    // List has explicit default priority
    priority = list.default_priority;
    prioritySource = 'List Default';
  } else {
    // Fall back to keyword analysis
    priority = inferPriorityFromTitle(title) as Requirement['priority'];
    prioritySource = title ? 'Keyword Analysis' : 'Default';
  }
  sources.push({
    field: 'priority',
    value: priority,
    source: prioritySource,
    is_overridden: false
  });

  // LABELS: List Default → Keyword Analysis → Empty
  let labels: string;
  let labelsSource: string | undefined;
  if (list.default_labels) {
    // List has explicit default labels
    labels = list.default_labels;
    labelsSource = 'List Default';
    sources.push({
      field: 'labels',
      value: labels,
      source: labelsSource,
      is_overridden: false
    });
  } else {
    // Fall back to keyword analysis
    const inferredLabels = inferLabelsFromTitle(title);
    labels = inferredLabels.join(', ');
    if (inferredLabels.length > 0) {
      labelsSource = 'Keyword Analysis';
      sources.push({
        field: 'labels',
        value: labels,
        source: labelsSource,
        is_overridden: false
      });
    }
  }

  // DESCRIPTION: List Default → Preset → Empty
  let description = '';
  let descriptionSource: string | undefined;
  if (list.default_description) {
    // List has explicit default description
    description = list.default_description;
    descriptionSource = 'List Default';
    sources.push({
      field: 'description',
      value: description,
      source: descriptionSource,
      is_overridden: false
    });
  } else if (preset) {
    // Fall back to preset template
    description = preset.description_template.replace('{evento}', 'evento specifico');
    descriptionSource = `Preset: ${preset.name}`;
    sources.push({
      field: 'description',
      value: description,
      source: descriptionSource,
      is_overridden: false
    });
  }

  // BUSINESS_OWNER: List.default_business_owner → List.owner → Empty
  const businessOwner = list.default_business_owner || list.owner || '';

  // Includi environments e stakeholders se presenti nella lista
  let environments: Requirement['environments'] | undefined = undefined;
  let environmentsSource: string | undefined = undefined;
  if (list.default_environments) {
    environments = list.default_environments;
    environmentsSource = 'List Default';
    sources.push({
      field: 'environments',
      value: environments,
      source: environmentsSource,
      is_overridden: false
    });
  }

  let stakeholders: Requirement['stakeholders'] | undefined = undefined;
  let stakeholdersSource: string | undefined = undefined;
  if (list.default_stakeholders) {
    stakeholders = list.default_stakeholders;
    stakeholdersSource = 'List Default';
    sources.push({
      field: 'stakeholders',
      value: stakeholders,
      source: stakeholdersSource,
      is_overridden: false
    });
  }

  const defaults: Partial<Requirement> = {
    priority,
    business_owner: businessOwner,
    labels,
    state: 'Proposed',
    estimator: currentUser,
    description,
    environments,
    stakeholders,
    // Default source tracking
    priority_default_source: prioritySource,
    priority_is_overridden: false,
    labels_default_source: labelsSource,
    labels_is_overridden: false,
    description_default_source: descriptionSource,
    description_is_overridden: false,
    environments_default_source: environmentsSource,
    environments_is_overridden: false,
    stakeholders_default_source: stakeholdersSource,
    stakeholders_is_overridden: false
  };

  return { defaults, sources };
}

// Estimate defaults
export async function getEstimateDefaults(
  requirement: Requirement,
  list: List,
  currentUser: string,
  options?: { onStickyDefaultsError?: (error: unknown) => void }
): Promise<{ defaults: Partial<Estimate>; sources: DefaultSource[] }> {
  const preset = list.preset_key ? presets.find(p => p.preset_key === list.preset_key) : null;
  const sticky = await getStickyDefaults(currentUser, list.list_id, options?.onStickyDefaultsError);  // Ora è async
  const sources: DefaultSource[] = [];

  // Scenario (auto-generated, no longer from defaults)
  const scenario = 'Standard'; // Legacy fallback, actual scenario name generated in EstimateEditor

  // Complexity - sticky > preset > list > default
  let complexity = 'Medium';
  let complexitySource = 'Default';
  if (sticky?.complexity) {
    complexity = sticky.complexity;
    complexitySource = 'Sticky/Estimator';
  } else if (preset && preset.complexity) {
    complexity = preset.complexity;
    complexitySource = `Preset: ${preset.name}`;
  } else if (list.default_priority) {
    // fallback: use list default_priority as complexity if possible (if types match)
    complexity = list.default_priority as any;
    complexitySource = 'List Default';
  }

  // Environments - list > preset > default
  let environments = '2 env';
  let environmentsSource = 'Default';
  if (list.default_environments) {
    environments = list.default_environments;
    environmentsSource = 'List Default';
  } else if (preset && preset.environments) {
    environments = preset.environments;
    environmentsSource = `Preset: ${preset.name}`;
  }

  // Reuse - sticky > preset > list > default
  let reuse = 'Medium';
  let reuseSource = 'Default';
  if (sticky?.reuse) {
    reuse = sticky.reuse;
    reuseSource = 'Sticky/Estimator';
  } else if (preset && preset.reuse) {
    reuse = preset.reuse;
    reuseSource = `Preset: ${preset.name}`;
  } else if (list.default_reuse) {
    reuse = list.default_reuse as any;
    reuseSource = 'List Default';
  }

  // Stakeholders - sticky > preset > list > default
  let stakeholders = '1 team';
  let stakeholdersSource = 'Default';
  if (sticky?.stakeholders) {
    stakeholders = sticky.stakeholders;
    stakeholdersSource = 'Sticky/Estimator';
  } else if (preset && preset.stakeholders) {
    stakeholders = preset.stakeholders;
    stakeholdersSource = `Preset: ${preset.name}`;
  } else if (list.default_stakeholders) {
    stakeholders = list.default_stakeholders;
    stakeholdersSource = 'List Default';
  }

  // Activities - preset or sticky
  let includedActivities: string[] = [];
  let activitiesSource = 'Default';
  if (sticky?.included_activities && sticky.included_activities.length > 0) {
    includedActivities = sticky.included_activities;
    activitiesSource = 'Sticky/Estimator';
  } else if (preset) {
    includedActivities = preset.activities;
    activitiesSource = `Preset: ${preset.name}`;
  }

  // Optional activities based on title patterns
  const includeOptional = shouldIncludeOptionalActivities(requirement.title);
  let optionalActivities: string[] = [];
  if (includeOptional) {
    optionalActivities = ['WF_HOOK']; // Workflow hook for state changes
  }

  // Risks - inferred from title
  const inferredRisks = inferRisksFromTitle(requirement.title);
  let selectedRisks = preset ? preset.risks : [];
  selectedRisks = [...selectedRisks, ...inferredRisks];
  const risksSource = inferredRisks.length > 0 ? 'Title Analysis' : (preset ? `Preset: ${preset.name}` : 'Default');

  // Build sources array
  sources.push(
    { field: 'complexity', value: complexity, source: complexitySource, is_overridden: false },
    { field: 'environments', value: environments, source: environmentsSource, is_overridden: false },
    { field: 'reuse', value: reuse, source: reuseSource, is_overridden: false },
    { field: 'stakeholders', value: stakeholders, source: stakeholdersSource, is_overridden: false }
  );

  if (includedActivities.length > 0) {
    sources.push({ field: 'activities', value: includedActivities.join(','), source: activitiesSource, is_overridden: false });
  }

  if (selectedRisks.length > 0) {
    sources.push({ field: 'risks', value: selectedRisks.join(','), source: risksSource, is_overridden: false });
  }

  const defaults: Partial<Estimate> = {
    scenario,
    complexity: complexity as Estimate['complexity'],
    environments: environments as Estimate['environments'],
    reuse: reuse as Estimate['reuse'],
    stakeholders: stakeholders as Estimate['stakeholders'],
    included_activities: includedActivities,
    optional_activities: optionalActivities,
    include_optional: includeOptional,
    selected_risks: selectedRisks,
    // Default source tracking
    complexity_default_source: complexitySource,
    complexity_is_overridden: false,
    environments_default_source: environmentsSource,
    environments_is_overridden: false,
    reuse_default_source: reuseSource,
    reuse_is_overridden: false,
    stakeholders_default_source: stakeholdersSource,
    stakeholders_is_overridden: false,
    activities_default_source: activitiesSource,
    activities_is_overridden: false,
    risks_default_source: risksSource,
    risks_is_overridden: false,
    default_json: JSON.stringify(sources)
  };

  return { defaults, sources };
}

// Update sticky defaults when user makes choices
export async function updateStickyDefaults(
  user: string,
  listId: string,
  estimate: Partial<Estimate>
): Promise<void> {
  const sticky: StickyDefaults = {
    user_id: user,
    list_id: listId,
    complexity: estimate.complexity,
    environments: estimate.environments,
    reuse: estimate.reuse,
    stakeholders: estimate.stakeholders,
    included_activities: estimate.included_activities || [],
    updated_on: new Date().toISOString()
  };

  await saveStickyDefaults(sticky);
}

// Reset defaults
export async function resetToDefaults(
  requirement: Requirement,
  list: List,
  currentUser: string,
  options?: { onStickyDefaultsError?: (error: unknown) => void }
): Promise<{ defaults: Partial<Estimate>; sources: DefaultSource[] }> {
  return await getEstimateDefaults(requirement, list, currentUser, options);
}
