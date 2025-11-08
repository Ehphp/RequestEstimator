import { List, Requirement, Estimate, StickyDefaults, DefaultSource } from '../types';
import { presets, getCurrentQuarter, inferPriorityFromTitle, inferLabelsFromTitle, inferStakeholdersFromLabels, shouldIncludeOptionalActivities, inferRisksFromTitle } from '../data/presets';
import { getStickyDefaults as getSupabaseStickyDefaults, saveStickyDefaults as saveSupabaseStickyDefaults } from './storage';
import { logger } from './logger';

// Sticky defaults management (now using Supabase)
export async function getStickyDefaults(user: string, listId: string): Promise<StickyDefaults | null> {
  try {
    return await getSupabaseStickyDefaults(user, listId);
  } catch (error) {
    logger.error('Error getting sticky defaults:', error);
    return null;
  }
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
    notes: ''
  };
}

// Requirement defaults
export function getRequirementDefaults(
  list: List,
  currentUser: string,
  title: string = ''
): { defaults: Partial<Requirement>; sources: DefaultSource[] } {
  const preset = list.preset_key ? presets.find(p => p.preset_key === list.preset_key) : null;
  const sources: DefaultSource[] = [];

  // Priority from title analysis
  const inferredPriority = inferPriorityFromTitle(title);
  sources.push({
    field: 'priority',
    value: inferredPriority,
    source: title ? 'Keyword Analysis' : 'Default',
    is_overridden: false
  });

  // Labels from title analysis
  const inferredLabels = inferLabelsFromTitle(title);
  const labelsString = inferredLabels.join(', ');
  if (inferredLabels.length > 0) {
    sources.push({
      field: 'labels',
      value: labelsString,
      source: 'Keyword Analysis',
      is_overridden: false
    });
  }

  // Description from preset
  let description = '';
  if (preset) {
    description = preset.description_template.replace('{evento}', 'evento specifico');
    sources.push({
      field: 'description',
      value: description,
      source: `Preset: ${preset.name}`,
      is_overridden: false
    });
  }

  const defaults: Partial<Requirement> = {
    priority: inferredPriority as Requirement['priority'],
    business_owner: list.owner,
    labels: labelsString,
    state: 'Proposed',
    estimator: currentUser,
    description: description,
    // Default source tracking
    priority_default_source: title ? 'Keyword Analysis' : 'Default',
    priority_is_overridden: false,
    labels_default_source: inferredLabels.length > 0 ? 'Keyword Analysis' : undefined,
    labels_is_overridden: false,
    description_default_source: preset ? `Preset: ${preset.name}` : undefined,
    description_is_overridden: false
  };

  return { defaults, sources };
}

// Estimate defaults
export async function getEstimateDefaults(
  requirement: Requirement,
  list: List,
  currentUser: string
): Promise<{ defaults: Partial<Estimate>; sources: DefaultSource[] }> {
  const preset = list.preset_key ? presets.find(p => p.preset_key === list.preset_key) : null;
  const sticky = await getStickyDefaults(currentUser, list.list_id);  // Ora è async
  const sources: DefaultSource[] = [];

  // Scenario
  let scenario = 'Standard';
  let scenarioSource = 'Default';
  if (preset) {
    scenario = 'A';
    scenarioSource = `Preset: ${preset.name}`;
  }

  // Complexity - sticky first, then preset, then default
  let complexity = 'Medium';
  let complexitySource = 'Default';
  if (sticky?.complexity) {
    complexity = sticky.complexity;
    complexitySource = 'Sticky/Estimator';
  } else if (preset) {
    complexity = preset.complexity;
    complexitySource = `Preset: ${preset.name}`;
  }

  // Environments - preset or default
  let environments = '2 env';
  let environmentsSource = 'Default';
  if (preset) {
    environments = preset.environments;
    environmentsSource = `Preset: ${preset.name}`;
  }

  // Reuse - inferred logic
  let reuse = 'Medium';
  let reuseSource = 'Default';
  if (preset) {
    reuse = preset.reuse;
    reuseSource = `Preset: ${preset.name}`;
  }

  // Stakeholders - inferred from labels
  const labels = requirement.labels ? requirement.labels.split(',').map(l => l.trim()) : [];
  const stakeholders = inferStakeholdersFromLabels(labels);
  const stakeholdersSource = labels.length > 0 ? 'Labels Analysis' : (preset ? `Preset: ${preset.name}` : 'Default');

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
  currentUser: string
): Promise<{ defaults: Partial<Estimate>; sources: DefaultSource[] }> {
  // Clear sticky defaults for this context and recalculate
  return await getEstimateDefaults(requirement, list, currentUser);
}