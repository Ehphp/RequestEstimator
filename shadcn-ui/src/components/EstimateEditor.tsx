import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowLeft, Save, Info, AlertCircle, Copy, Sparkles, RotateCcw, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useDefaultTracking } from '@/hooks/useDefaultTracking';
import { Requirement, Estimate, Activity, List } from '../types';
import { activities, risks } from '../data/catalog';
import { calculateEstimate } from '../lib/calculations';
import { saveEstimate, getEstimatesByReqId, getRequirementsByListId, getListActivityCatalog, upsertListActivityCatalog } from '../lib/storage';
import { getEstimateDefaults, updateStickyDefaults, resetToDefaults } from '../lib/defaults';
import { validateEstimate } from '../lib/validation';
import { getPriorityColor, getStateColor } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { DefaultPill } from './DefaultPill';
import { DriverSelect } from './DriverSelect';
import { ThemeToggle } from './ThemeToggle';
import { RequirementRelations } from './RequirementRelations';
import { buildActivityMapFromCatalogs, mergeActivitiesWithOverrides } from '../lib/utils';

interface EstimateEditorProps {
  requirement: Requirement;
  list: List;
  onBack: () => void;
  selectedEstimate?: Estimate | null;
}

export function EstimateEditor({ requirement, list, onBack, selectedEstimate }: EstimateEditorProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { defaultSources, setDefaultSources, overriddenFields, setOverriddenFields } = useDefaultTracking();

  // Generate automatic scenario name based on timestamp
  const generateScenarioName = () => {
    const now = new Date();
    const date = now.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    const time = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `Scenario ${date} ${time}`;
  };

  const [scenario, setScenario] = useState(generateScenarioName());
  const [complexity, setComplexity] = useState('');
  const [environments, setEnvironments] = useState('');
  const [reuse, setReuse] = useState('');
  const [stakeholders, setStakeholders] = useState('');
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedRisks, setSelectedRisks] = useState<string[]>([]);
  const [includeOptional, setIncludeOptional] = useState(false);
  const [optionalActivities, setOptionalActivities] = useState<string[]>([]);
  const [activityOverrides, setActivityOverrides] = useState<Record<string, { override_name?: string; override_days?: number; override_group?: string }>>({});
  const [additionalGroups, setAdditionalGroups] = useState<string[]>([]);
  const [persistedGroups, setPersistedGroups] = useState<Array<{ group: string; activities: Activity[] }>>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Load per-list persisted activity catalog (groups + activities)
  useEffect(() => {
    (async () => {
      try {
        const catalog = await getListActivityCatalog(list.list_id, list.technology || null);
        if (!catalog || !catalog.catalog) return;
        const groups = catalog.catalog.groups || [];
        // set persisted groups into state
        setPersistedGroups(groups);
        // also ensure group names show up in additionalGroups for UI
        const names = groups.map(g => g.group).filter(Boolean);
        setAdditionalGroups(prev => Array.from(new Set([...prev, ...names])));
      } catch (e) {
        logger.warn('Unable to load per-list activity catalog', e);
      }
    })();
  }, [list.list_id, list.technology]);
  const [calculatedEstimate, setCalculatedEstimate] = useState<Partial<Estimate> | null>(null);
  const [previousEstimates, setPreviousEstimates] = useState<Estimate[]>([]);
  const [autoCalcReady, setAutoCalcReady] = useState(false);
  const [allRequirements, setAllRequirements] = useState<Requirement[]>([]);

  // safer unmount flag for async
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    logger.info('EstimateEditor mounted/updated:', {
      hasSelectedEstimate: !!selectedEstimate,
      selectedEstimateId: selectedEstimate?.estimate_id,
      requirementId: requirement.req_id,
      currentUser
    });
  }, [selectedEstimate, requirement, currentUser]);

  // Load previous estimates
  useEffect(() => {
    (async () => {
      try {
        const estimates = await getEstimatesByReqId(requirement.req_id);
        if (aliveRef.current) setPreviousEstimates(estimates);
      } catch (e) {
        logger.error('Failed to load previous estimates', e);
      }
    })();
  }, [requirement.req_id]);

  // Load all requirements for relations display
  useEffect(() => {
    (async () => {
      try {
        const reqs = await getRequirementsByListId(list.list_id);
        if (aliveRef.current) setAllRequirements(reqs);
      } catch (e) {
        logger.error('Failed to load requirements for relations', e);
      }
    })();
  }, [list.list_id]);

  // Initialize form data
  const notifyStickyDefaultsError = useCallback((error: unknown) => {
    logger.error('Sticky defaults read failed', error);
    toast({
      variant: 'destructive',
      title: 'Defaults non disponibili',
      description: 'Impossibile recuperare i default sticky. I valori verranno ricalcolati.'
    });
  }, [toast]);

  useEffect(() => {
    setAutoCalcReady(false);

    (async () => {
      if (selectedEstimate) {
        logger.info('Loading selected estimate data:', { estimate_id: selectedEstimate.estimate_id });

        setScenario(selectedEstimate.scenario);
        setComplexity(selectedEstimate.complexity);
        setEnvironments(selectedEstimate.environments);
        setReuse(selectedEstimate.reuse);
        setStakeholders(selectedEstimate.stakeholders);
        setSelectedActivities([...selectedEstimate.included_activities]);
        setSelectedRisks([...selectedEstimate.selected_risks]);
        setIncludeOptional(selectedEstimate.include_optional);
        setOptionalActivities(selectedEstimate.optional_activities || []);
        // Load per-activity overrides if present
        const overridesRecord: Record<string, { override_name?: string; override_days?: number; override_group?: string }> = {};
        (selectedEstimate.included_activities_overrides || []).forEach(o => {
          overridesRecord[o.activity_code] = {
            override_name: o.override_name,
            override_days: o.override_days,
            override_group: o.override_group
          };
        });
        setActivityOverrides(overridesRecord);

        setOverriddenFields({
          complexity: true,
          environments: true,
          reuse: true,
          stakeholders: true,
          activities: true,
          risks: true
        });
        setDefaultSources([]);

        if (aliveRef.current) setAutoCalcReady(true);
        return;
      }

      // new estimate defaults - reset everything when selectedEstimate is null
      logger.info('Loading defaults for new estimate');

      if (!currentUser) {
        // Reset to empty state if no user
        setScenario(generateScenarioName());
        setComplexity('');
        setEnvironments('');
        setReuse('');
        setStakeholders('');
        setSelectedActivities([]);
        setSelectedRisks([]);
        setIncludeOptional(false);
        setOptionalActivities([]);
        setActivityOverrides({});
        setDefaultSources([]);
        setOverriddenFields({});

        if (aliveRef.current) setAutoCalcReady(true);
        return;
      }

      try {
        const { defaults, sources } = await getEstimateDefaults(requirement, list, currentUser, {
          onStickyDefaultsError: notifyStickyDefaultsError
        });
        if (!aliveRef.current) return;

        setScenario(generateScenarioName());
        setComplexity(defaults.complexity || '');
        setEnvironments(defaults.environments || '');
        setReuse(defaults.reuse || '');
        setStakeholders(defaults.stakeholders || '');
        setSelectedActivities(defaults.included_activities || []);
        setSelectedRisks(defaults.selected_risks || []);
        setIncludeOptional(defaults.include_optional || false);
        setOptionalActivities(defaults.optional_activities || []);
        setActivityOverrides({});
        setDefaultSources(sources);
      } catch (e) {
        logger.error('Failed to load defaults', e);
      } finally {
        if (aliveRef.current) setAutoCalcReady(true);
      }
    })();
  }, [
    selectedEstimate?.estimate_id,
    requirement.req_id,
    list.list_id,
    currentUser,
    notifyStickyDefaultsError,
    setOverriddenFields,
    setDefaultSources
  ]);

  // === MEMOS & DERIVED ===
  const groupedActivities = useMemo(() => {
    // base groups from canonical activities
    const groups = activities.reduce((acc, activity) => {
      const group = activity.driver_group || 'General';
      if (!acc[group]) acc[group] = [];
      acc[group].push(activity);
      return acc;
    }, {} as Record<string, Activity[]>);

    // merge persisted groups (from per-list catalog). Persisted activities override/augment canonical ones.
    persistedGroups.forEach(pg => {
      if (!pg || !pg.group) return;
      if (!groups[pg.group]) groups[pg.group] = [];
      pg.activities.forEach(act => {
        if (!groups[pg.group].some(a => a.activity_code === act.activity_code)) {
          groups[pg.group].push(act);
        }
      });
    });

    return groups;
  }, [activities, persistedGroups]); // activities è statico importato

  const lastGroupKey = useMemo(() => {
    const keys = Object.keys(groupedActivities);
    return keys.length ? keys[keys.length - 1] : undefined;
  }, [groupedActivities]);

  // Combined catalog activities: canonical activities + persisted per-list activities
  // Combined catalog activities: use utility to build a map from per-list catalog groups
  const activityMap = useMemo(() => {
    const listCatalog = (persistedGroups && persistedGroups.length > 0)
      ? ({ catalog: { groups: persistedGroups } } as any)
      : null;
    return buildActivityMapFromCatalogs(listCatalog, activities);
  }, [persistedGroups, activities]);

  const combinedCatalogActivities = useMemo(() => Array.from(activityMap.values()), [activityMap]);

  // Helper to build activity objects including synthetic custom activities
  const buildSelectedActivityObjects = useMemo(() => {
    const overridesArray = Object.entries(activityOverrides || {}).map(([activity_code, ov]) => ({
      activity_code,
      override_name: ov.override_name,
      override_days: ov.override_days,
      override_group: ov.override_group
    }));

    return mergeActivitiesWithOverrides(activityMap, selectedActivities, overridesArray);
  }, [activityMap, selectedActivities, activityOverrides]);

  // Replace previous simple filter with builder that supports custom activities
  const selectedActivityObjects = useMemo(
    () => buildSelectedActivityObjects,
    [buildSelectedActivityObjects]
  );

  const optionalActivityObjects = useMemo(
    () => activities.filter(a => optionalActivities.includes(a.activity_code)),
    [optionalActivities]
  );

  // Synthetic (custom) activities selected by user: those not present in the combined catalog
  const syntheticSelectedActivities = useMemo(() =>
    selectedActivityObjects.filter(a => !combinedCatalogActivities.find(act => act.activity_code === a.activity_code)),
    [selectedActivityObjects, combinedCatalogActivities]
  );

  // Build a merged activities list per group: catalog activities + any synthetic activities
  const activitiesByGroup = useMemo(() => {
    const map: Record<string, Activity[]> = {};
    // start with catalog groups (copy arrays to avoid mutation)
    Object.entries(groupedActivities).forEach(([g, arr]) => { map[g] = [...arr]; });
    // attach synthetic activities into their declared group when present
    syntheticSelectedActivities.forEach(s => {
      const group = s.driver_group || lastGroupKey || 'Custom';
      if (!map[group]) map[group] = [];
      map[group].push(s);
    });
    // include any additionalGroups created by user (ensure they show up even if empty)
    additionalGroups.forEach(g => { if (!map[g]) map[g] = []; });
    return map;
  }, [groupedActivities, syntheticSelectedActivities, lastGroupKey, additionalGroups]);

  // Synthetic activities whose driver_group is not in the catalog groups (keep them in top area)
  const topCustomSelectedActivities = useMemo(() =>
    syntheticSelectedActivities.filter(s => !Object.prototype.hasOwnProperty.call(activitiesByGroup, s.driver_group)),
    [syntheticSelectedActivities, activitiesByGroup]
  );



  const handleRemoveCustom = (code: string) => {
    // Remove from selection and overrides immediately for responsive UI
    setSelectedActivities(prev => prev.filter(c => c !== code));
    setActivityOverrides(prev => {
      const copy = { ...prev };
      delete copy[code];
      return copy;
    });

    // Also persist removal from per-list catalog if the activity exists there
    (async () => {
      try {
        if (!persistedGroups || persistedGroups.length === 0) return;
        // Remove the activity from any persisted group
        const updated = persistedGroups.map(g => ({
          group: g.group,
          activities: (g.activities || []).filter(a => a.activity_code !== code)
        }));

        // Remove groups that became empty and are not present in the canonical groupedActivities
        const cleaned = updated.filter(g => {
          if ((g.activities || []).length > 0) return true;
          // if group is present in canonical catalog, keep it (empty)
          return Object.prototype.hasOwnProperty.call(groupedActivities, g.group);
        });

        // If nothing changed, skip persistence
        const changed = JSON.stringify(cleaned) !== JSON.stringify(persistedGroups);
        if (changed) {
          await upsertListActivityCatalog(list.list_id, list.technology || null, { groups: cleaned });
          setPersistedGroups(cleaned);
          // ensure additionalGroups mirror persisted group names
          const names = cleaned.map(g => g.group).filter(Boolean);
          setAdditionalGroups(prev => Array.from(new Set([...prev.filter(n => Object.keys(groupedActivities).includes(n) ? false : true), ...names, ...prev])));
        }
      } catch (err) {
        logger.warn('Failed to persist removal of custom activity', { code, err });
      }
    })();
  };

  const combinedSelectedActivityObjects = useMemo(() => {
    if (!includeOptional || optionalActivityObjects.length === 0) return selectedActivityObjects;
    const optionalOnly = optionalActivityObjects.filter(
      opt => !selectedActivityObjects.some(sel => sel.activity_code === opt.activity_code)
    );
    return [...selectedActivityObjects, ...optionalOnly];
  }, [includeOptional, optionalActivityObjects, selectedActivityObjects]);

  // Apply user overrides (if any) to the selected activity objects. This creates
  // a shallow copy of activities with overridden display_name/base_days/driver_group
  // so downstream calculation functions can work unchanged.
  const mappedSelectedActivityObjects = useMemo(() => {
    return combinedSelectedActivityObjects.map(a => {
      const ov = activityOverrides[a.activity_code];
      return {
        ...a,
        display_name: ov?.override_name || a.display_name,
        base_days: ov?.override_days ?? a.base_days,
        driver_group: ov?.override_group || a.driver_group
      } as Activity;
    });
  }, [combinedSelectedActivityObjects, activityOverrides]);

  const optionalActivitiesTotalDays = useMemo(
    () => optionalActivityObjects.reduce((sum, a) => sum + a.base_days, 0),
    [optionalActivityObjects]
  );


  const calculateAndUpdateEstimate = useCallback(() => {
    const validationErrors = validateEstimate(
      complexity,
      environments,
      reuse,
      stakeholders,
      mappedSelectedActivityObjects
    );

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setCalculatedEstimate(null);
      return;
    }

    setErrors([]);

    try {
      const estimate = calculateEstimate(
        mappedSelectedActivityObjects,
        complexity,
        environments,
        reuse,
        stakeholders,
        selectedRisks
      );
      setCalculatedEstimate(estimate);
    } catch (error) {
      logger.error('Calculation error:', error);
      setErrors([error instanceof Error ? error.message : 'Errore nel calcolo']);
      setCalculatedEstimate(null);
    }
  }, [complexity, environments, reuse, stakeholders, combinedSelectedActivityObjects, selectedRisks]);

  useEffect(() => {
    if (autoCalcReady) calculateAndUpdateEstimate();
  }, [autoCalcReady, calculateAndUpdateEstimate]);

  // debug state
  useEffect(() => {
    logger.info('EstimateEditor state:', {
      scenario,
      complexity,
      environments,
      reuse,
      stakeholders,
      selectedActivitiesCount: selectedActivities.length,
      selectedRisksCount: selectedRisks.length,
      includeOptional,
      autoCalcReady,
      hasCalculatedEstimate: !!calculatedEstimate
    });
  }, [
    scenario,
    complexity,
    environments,
    reuse,
    stakeholders,
    selectedActivities,
    selectedRisks,
    includeOptional,
    autoCalcReady,
    calculatedEstimate
  ]);

  const handleSave = async () => {
    if (!calculatedEstimate) {
      setErrors(['Completa i parametri per generare la stima automatica prima di salvare']);
      return;
    }

    const validationErrors = validateEstimate(
      complexity,
      environments,
      reuse,
      stakeholders,
      undefined,
      { validateActivities: false, strictMode: true }
    );
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const includedActivitiesForSave = includeOptional
      ? Array.from(new Set([...selectedActivities, ...optionalActivities]))
      : selectedActivities;

    const estimateId = selectedEstimate?.estimate_id || `EST-${Date.now()}`;
    const isUpdate = !!selectedEstimate;

    const estimate: Estimate = {
      estimate_id: estimateId,
      req_id: requirement.req_id,
      scenario,
      complexity: complexity as Estimate['complexity'],
      environments: environments as Estimate['environments'],
      reuse: reuse as Estimate['reuse'],
      stakeholders: stakeholders as Estimate['stakeholders'],
      included_activities: includedActivitiesForSave,
      optional_activities: includeOptional ? optionalActivities : [],
      include_optional: includeOptional,
      selected_risks: selectedRisks,
      created_on: selectedEstimate?.created_on || new Date().toISOString(),
      complexity_default_source: overriddenFields.complexity ? undefined : defaultSources.find(s => s.field === 'complexity')?.source,
      complexity_is_overridden: !!overriddenFields.complexity,
      environments_default_source: overriddenFields.environments ? undefined : defaultSources.find(s => s.field === 'environments')?.source,
      environments_is_overridden: !!overriddenFields.environments,
      reuse_default_source: overriddenFields.reuse ? undefined : defaultSources.find(s => s.field === 'reuse')?.source,
      reuse_is_overridden: !!overriddenFields.reuse,
      stakeholders_default_source: overriddenFields.stakeholders ? undefined : defaultSources.find(s => s.field === 'stakeholders')?.source,
      stakeholders_is_overridden: !!overriddenFields.stakeholders,
      activities_default_source: overriddenFields.activities ? undefined : defaultSources.find(s => s.field === 'activities')?.source,
      activities_is_overridden: !!overriddenFields.activities,
      risks_default_source: overriddenFields.risks ? undefined : defaultSources.find(s => s.field === 'risks')?.source,
      risks_is_overridden: !!overriddenFields.risks,
      default_json: JSON.stringify(defaultSources),
      ...calculatedEstimate,
      // persist per-activity overrides (only for activities included in this estimate)
      included_activities_overrides: includedActivitiesForSave
        .map(code => {
          const ov = activityOverrides[code];
          if (!ov) return undefined;
          return {
            activity_code: code,
            override_name: ov.override_name,
            override_days: ov.override_days,
            override_group: ov.override_group
          };
        })
        .filter(Boolean) as Estimate['included_activities_overrides']
    } as Estimate;

    logger.info(isUpdate ? 'Updating existing estimate' : 'Creating new estimate', {
      estimate_id: estimateId,
      req_id: requirement.req_id,
      scenario,
      total_days: calculatedEstimate.total_days
    });

    try {
      await saveEstimate(estimate);

      if (currentUser) {
        try {
          await updateStickyDefaults(currentUser, list.list_id, {
            complexity: complexity as Estimate['complexity'],
            environments: environments as Estimate['environments'],
            reuse: reuse as Estimate['reuse'],
            stakeholders: stakeholders as Estimate['stakeholders'],
            included_activities: includedActivitiesForSave
          });
        } catch (stickyError) {
          logger.warn('Sticky defaults update skipped (non bloccante)', stickyError);
        }
      }

      toast({
        title: isUpdate ? 'Stima aggiornata' : 'Stima creata',
        description: `${isUpdate ? 'Modifiche salvate' : 'Nuova stima'}: ${calculatedEstimate.total_days} giorni`,
      });
      onBack();
    } catch (e) {
      logger.error('Saving estimate failed', e);
      setErrors(['Salvataggio fallito. Riprova o verifica la persistenza locale.']);
    }
  };

  const handleCloneEstimate = (estimate: Estimate) => {
    setScenario(estimate.scenario);
    setComplexity(estimate.complexity);
    setEnvironments(estimate.environments);
    setReuse(estimate.reuse);
    setStakeholders(estimate.stakeholders);
    setSelectedActivities([...estimate.included_activities]);
    setSelectedRisks([...estimate.selected_risks]);
    setIncludeOptional(estimate.include_optional);
    setOptionalActivities(estimate.optional_activities || []);
    // clone activity overrides too
    const overridesRecord: Record<string, { override_name?: string; override_days?: number; override_group?: string }> = {};
    (estimate.included_activities_overrides || []).forEach(o => {
      overridesRecord[o.activity_code] = {
        override_name: o.override_name,
        override_days: o.override_days,
        override_group: o.override_group
      };
    });
    setActivityOverrides(overridesRecord);
    setCalculatedEstimate(null);
    setErrors([]);

    setOverriddenFields({
      complexity: true,
      environments: true,
      reuse: true,
      stakeholders: true,
      activities: true,
      risks: true
    });
    setDefaultSources([]);
  };

  const handleToggleOverride = async (field: keyof typeof overriddenFields) => {
    const currentlyOverridden = !!overriddenFields[field];
    setOverriddenFields(prev => ({ ...prev, [field]: !prev[field] }));

    if (currentlyOverridden && currentUser) {
      const { defaults, sources } = await getEstimateDefaults(requirement, list, currentUser);
      setDefaultSources(sources);

      if (field === 'complexity' && defaults.complexity) setComplexity(defaults.complexity);
      if (field === 'environments' && defaults.environments) setEnvironments(defaults.environments);
      if (field === 'reuse' && defaults.reuse) setReuse(defaults.reuse);
      if (field === 'stakeholders' && defaults.stakeholders) setStakeholders(defaults.stakeholders);
      if (field === 'activities' && defaults.included_activities) setSelectedActivities(defaults.included_activities);
      if (field === 'risks' && defaults.selected_risks) setSelectedRisks(defaults.selected_risks);
    }
  };

  const handleResetAllDefaults = async () => {
    if (!currentUser) return;
    const { defaults, sources } = await resetToDefaults(requirement, list, currentUser, {
      onStickyDefaultsError: notifyStickyDefaultsError
    });

    setScenario(generateScenarioName());
    setComplexity(defaults.complexity || '');
    setEnvironments(defaults.environments || '');
    setReuse(defaults.reuse || '');
    setStakeholders(defaults.stakeholders || '');
    setSelectedActivities(defaults.included_activities || []);
    setSelectedRisks(defaults.selected_risks || []);
    setIncludeOptional(defaults.include_optional || false);
    setOptionalActivities(defaults.optional_activities || []);

    setDefaultSources(sources);
    setOverriddenFields({});
    setCalculatedEstimate(null);
  };

  const getDefaultSource = (field: string) => defaultSources.find(s => s.field === field);

  const getTotalRiskWeight = () => {
    const selectedRiskObjects = risks.filter(risk => selectedRisks.includes(risk.risk_id));
    return selectedRiskObjects.reduce((sum, risk) => sum + risk.weight, 0);
  };

  const getRiskBand = (score: number): { band: string; color: string; bgColor: string } => {
    if (score === 0) return { band: 'None', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' };
    if (score <= 10) return { band: 'Low', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/30' };
    if (score <= 20) return { band: 'Medium', color: 'text-yellow-700 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-900/30' };
    return { band: 'High', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/30' };
  };

  const risksByCategory = useMemo(() => {
    const categories = ['Technical', 'Business', 'Governance', 'Integration'] as const;
    return categories.map(cat => ({
      category: cat,
      risks: risks.filter(r => r.category === cat)
    }));
  }, []);

  // Inherit drivers from list if not set
  useEffect(() => {
    if (list) {
      // Complessità: non esiste default a livello lista, sempre editabile
      if (!reuse && list.default_reuse) setReuse(list.default_reuse);
      if (!stakeholders && list.default_stakeholders) setStakeholders(list.default_stakeholders);
      if (!environments && list.default_environments) setEnvironments(list.default_environments);
    }
  }, [list]);

  // Small component to edit per-activity overrides (name, days, group).
  function ActivityOverrideEditor({ activity }: { activity: Activity }) {
    const ov = activityOverrides[activity.activity_code] || {};
    const [open, setOpen] = useState(false);
    const [name, setName] = useState<string>(ov.override_name || '');
    const [days, setDays] = useState<string>(ov.override_days != null ? String(ov.override_days) : '');
    const [group, setGroup] = useState<string>(ov.override_group || activity.driver_group);
    const [newGroupName, setNewGroupName] = useState<string>('');

    useEffect(() => {
      const current = activityOverrides[activity.activity_code] || {};
      setName(current.override_name || '');
      setDays(current.override_days != null ? String(current.override_days) : '');
      setGroup(current.override_group || activity.driver_group);
    }, [activity.activity_code, activityOverrides]);

    const handleSaveOverride = () => {
      const parsed = days === '' ? undefined : Number(days);
      const finalGroup = group === '__NEW__' ? newGroupName.trim() : (group === '__NONE__' ? '' : group);
      if (finalGroup && !Object.keys(groupedActivities).includes(finalGroup) && !additionalGroups.includes(finalGroup)) {
        setAdditionalGroups(prev => [...prev, finalGroup]);
        // persist new group when user creates it while editing an activity
        (async () => {
          try {
            const merged = (persistedGroups || []).slice();
            if (!merged.some(m => m.group === finalGroup)) merged.push({ group: finalGroup, activities: [] });
            await upsertListActivityCatalog(list.list_id, list.technology || null, { groups: merged });
            setPersistedGroups(merged);
          } catch (e) {
            logger.warn('Failed to persist new group (override editor)', e);
          }
        })();
      }
      setActivityOverrides(prev => ({
        ...prev,
        [activity.activity_code]: {
          override_name: name || undefined,
          override_days: parsed,
          override_group: finalGroup || undefined
        }
      }));
      setOpen(false);
    };

    const daysInvalid = days !== '' && (isNaN(Number(days)) || Number(days) < 0);

    const handleResetOverride = () => {
      setActivityOverrides(prev => {
        const copy = { ...prev };
        delete copy[activity.activity_code];
        return copy;
      });
      setOpen(false);
    };

    const [confirmOpen, setConfirmOpen] = useState(false);

    const handleRemoveInDialog = () => {
      // open internal confirmation dialog (consistent UI)
      setConfirmOpen(true);
    };

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            title={`Modifica ${activity.display_name}`}
            aria-label={`Modifica ${activity.display_name}`}
            className={`h-6 w-6 p-0 flex-shrink-0 ml-2 rounded transition-colors text-sm ${activityOverrides[activity.activity_code] ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:bg-muted/10'}`}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica attività</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] block mb-1">Nome attività</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="text-[10px] block mb-1">Giorni</label>
              <input type="number" value={days} onChange={(e) => setDays(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="text-[10px] block mb-1">Sezione</label>
              <select value={group === '' ? '__NONE__' : (Object.keys(groupedActivities).concat(additionalGroups).includes(group) ? group : '__NEW__')} onChange={(e) => {
                const v = e.target.value;
                if (v === '__NEW__') {
                  setGroup('__NEW__');
                  setNewGroupName('');
                } else {
                  setGroup(v === '__NONE__' ? '' : v);
                  setNewGroupName('');
                }
              }} className="w-full border rounded px-2 py-1 text-sm">
                <option value="__NONE__">-- seleziona sezione --</option>
                {Object.keys(groupedActivities).concat(additionalGroups).map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
                <option value="__NEW__">Crea nuova sezione...</option>
              </select>
              {group === '__NEW__' && (
                <div className="mt-2">
                  <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nome nuova sezione" className="w-full border rounded px-2 py-1 text-sm" />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">Digita un nuovo nome per creare una nuova sezione.</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="destructive" onClick={handleRemoveInDialog} className="h-8 text-xs text-red-600 flex items-center gap-1">
                <Trash2 className="h-3.5 w-3.5" />
                Rimuovi
              </Button>
              <Button variant="ghost" onClick={handleResetOverride} className="h-8 text-xs">Reset</Button>
              <Button onClick={handleSaveOverride} className="h-8 text-xs" disabled={daysInvalid || (group === '__NEW__' && newGroupName.trim().length === 0)}>Salva</Button>
            </div>
            {daysInvalid && <p className="text-[10px] text-red-600 mt-1">Giorni non valido (&gt;= 0)</p>}
          </div>
        </DialogContent>

        {/* Internal confirmation dialog for removals (keeps UI consistent) */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Conferma rimozione</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm">Sei sicuro di voler rimuovere l'attività <strong>{activity.display_name}</strong> dalla selezione?</p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmOpen(false)} className="h-8 text-xs">Annulla</Button>
                <Button variant="destructive" onClick={() => { handleRemoveCustom(activity.activity_code); setConfirmOpen(false); setOpen(false); }} className="h-8 text-xs">Rimuovi</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </Dialog>
    );
  }

  // Dialog to create a new custom activity (adds to selectedActivities and activityOverrides)
  function AddActivityDialog() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [days, setDays] = useState<string>('');
    const [group, setGroup] = useState<string>(lastGroupKey || Object.keys(groupedActivities)[0] || 'General');
    const [newGroupName, setNewGroupName] = useState<string>('');

    const handleSave = () => {
      if (!name || name.trim().length === 0) return;
      const parsedDays = days === '' ? 0 : Number(days);
      const code = `CUSTOM-${Date.now()}`;
      const finalGroup = group === '__NEW__' ? newGroupName.trim() : (group === '__NONE__' ? '' : group);
      // register new group if user typed one not present in catalog
      if (finalGroup && !Object.keys(groupedActivities).includes(finalGroup) && !additionalGroups.includes(finalGroup)) {
        setAdditionalGroups(prev => [...prev, finalGroup]);
        // persist this new group into per-list catalog
        (async () => {
          try {
            // Build catalog payload merging persisted group's activities and new empty group if needed
            const merged = (persistedGroups || []).slice();
            if (!merged.some(m => m.group === finalGroup)) {
              merged.push({ group: finalGroup, activities: [] });
            }
            await upsertListActivityCatalog(list.list_id, list.technology || null, { groups: merged });
            // reflect persistedGroups
            setPersistedGroups(merged);
          } catch (e) {
            logger.warn('Failed to persist new group', e);
          }
        })();
      }
      setSelectedActivities(prev => [...prev, code]);
      setActivityOverrides(prev => ({ ...prev, [code]: { override_name: name.trim(), override_days: parsedDays, override_group: finalGroup } }));
      // persist the new custom activity into the per-list catalog group
      (async () => {
        try {
          const merged = (persistedGroups || []).slice();
          let target = merged.find(m => m.group === finalGroup);
          if (!target) {
            target = { group: finalGroup, activities: [] };
            merged.push(target);
          }
          // create activity object matching Activity type
          const newAct: Activity = {
            activity_code: code,
            display_name: name.trim(),
            driver_group: finalGroup || (lastGroupKey || 'Custom'),
            base_days: parsedDays,
            helper_short: '',
            helper_long: '',
            status: 'Active'
          };
          // avoid duplicates
          if (!target.activities.some(a => a.activity_code === code)) {
            target.activities.push(newAct);
          }
          await upsertListActivityCatalog(list.list_id, list.technology || null, { groups: merged });
          setPersistedGroups(merged);
        } catch (e) {
          logger.warn('Failed to persist custom activity', e);
        }
      })();
      setOpen(false);
    };

    const reset = () => { setName(''); setDays(''); setGroup(lastGroupKey || Object.keys(groupedActivities)[0] || 'General'); };
    const nameInvalid = !name || name.trim().length === 0;
    const daysInvalid = days !== '' && (isNaN(Number(days)) || Number(days) < 0);

    return (
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 text-[11px] px-2">+ Aggiungi</Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuova attività</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] block mb-1">Nome attività</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
              {nameInvalid && <p className="text-[10px] text-red-600 mt-1">Nome attività obbligatorio</p>}
            </div>
            <div>
              <label className="text-[10px] block mb-1">Giorni</label>
              <input type="number" value={days} onChange={(e) => setDays(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
              {daysInvalid && <p className="text-[10px] text-red-600 mt-1">Inserisci un numero di giorni valido (&gt;= 0)</p>}
            </div>
            <div>
              <label className="text-[10px] block mb-1">Sezione</label>
              <select value={group === '' ? '__NONE__' : (Object.keys(groupedActivities).concat(additionalGroups).includes(group) ? group : '__NEW__')} onChange={(e) => {
                const v = e.target.value;
                if (v === '__NEW__') { setGroup('__NEW__'); setNewGroupName(''); }
                else { setGroup(v === '__NONE__' ? '' : v); setNewGroupName(''); }
              }} className="w-full border rounded px-2 py-1 text-sm">
                <option value="__NONE__">-- seleziona sezione --</option>
                {Object.keys(groupedActivities).concat(additionalGroups).map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
                <option value="__NEW__">Crea nuova sezione...</option>
              </select>
              {group === '__NEW__' && (
                <div className="mt-2">
                  <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nome nuova sezione" className="w-full border rounded px-2 py-1 text-sm" />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">Digita un nuovo nome per creare una nuova sezione.</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)} className="h-8 text-xs">Annulla</Button>
              <Button onClick={handleSave} className="h-8 text-xs" disabled={nameInvalid || daysInvalid || (group === '__NEW__' && newGroupName.trim().length === 0)}>Aggiungi</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Inline confirm remove dialog to keep removal UX consistent for custom activities
  function ConfirmRemoveDialog({ name, onConfirm }: { name: string; onConfirm: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label={`Rimuovi ${name}`}>
            <Trash2 className="h-3 w-3 text-red-600" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Conferma rimozione</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Sei sicuro di voler rimuovere l'attività <strong>{name}</strong> dalla selezione?</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} className="h-8 text-xs">Annulla</Button>
              <Button variant="destructive" onClick={() => { onConfirm(); setOpen(false); }} className="h-8 text-xs">Rimuovi</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-gray-950 overflow-hidden flex flex-col p-3">
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border shadow-sm shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button variant="ghost" size="sm" onClick={onBack} className="h-7 w-7 p-0 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono text-muted-foreground shrink-0">{requirement.req_id}</span>
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-50 truncate flex-1">{requirement.title}</h1>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggle />
            <Badge className={`${getPriorityColor(requirement.priority)} text-xs px-2 py-0`}>
              {requirement.priority}
            </Badge>
            <Badge className={`${getStateColor(requirement.state)} text-xs px-2 py-0`}>
              {requirement.state}
            </Badge>
            {requirement.business_owner && (
              <span className="text-xs text-muted-foreground max-w-[120px] truncate">{requirement.business_owner}</span>
            )}
            {list.preset_key && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                <Sparkles className="h-3 w-3 mr-1" />
                {list.preset_key}
              </Badge>
            )}
            {list.technology && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                {list.technology}
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={handleResetAllDefaults} className="h-7 text-xs px-2 ml-1">
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {/* Relations Alert Badge */}
        {(requirement.parent_req_id || allRequirements.some(r => r.parent_req_id === requirement.req_id)) && (
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 py-2">
            <AlertDescription className="flex items-center gap-2">
              <RequirementRelations
                currentRequirement={requirement}
                allRequirements={allRequirements}
                onNavigate={() => { }}
                compact={true}
              />
            </AlertDescription>
          </Alert>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <Alert variant="destructive" className="py-1.5 px-3 shrink-0">
            <AlertCircle className="h-3.5 w-3.5" />
            <AlertDescription className="text-[10px]">
              {errors.map((error, index) => (<div key={index}>• {error}</div>))}
            </AlertDescription>
          </Alert>
        )}

        {/* Previous Estimates */}
        {previousEstimates.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/50 rounded-lg shrink-0">
            <span className="text-[10px] font-medium text-muted-foreground">Stime precedenti:</span>
            {previousEstimates.slice(0, 3).map((estimate) => (
              <Button
                key={estimate.estimate_id}
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2"
                onClick={() => handleCloneEstimate(estimate)}
              >
                <Copy className="h-3 w-3 mr-1" />
                {estimate.scenario}: {estimate.total_days}gg
              </Button>
            ))}
          </div>
        )}

        {/* 3 columns */}
        <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
          {/* Col 1 - Driver & Rischi */}
          <div className="flex flex-col gap-2 h-full min-h-0">
            {/* Driver */}
            <Card className="flex flex-col overflow-hidden shrink-0">
              <CardHeader className="pb-2 pt-2 px-3 shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold">Scenario & Driver</CardTitle>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground font-mono">{scenario}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-3 pb-3">
                {/* Complessità: sempre editabile a livello requisito */}
                <DriverSelect
                  label="Complessità"
                  driverType="complexity"
                  value={complexity}
                  onChange={setComplexity}
                  defaultSource={getDefaultSource('complexity')?.source}
                  isOverridden={!!overriddenFields.complexity}
                  onToggleOverride={() => handleToggleOverride('complexity')}
                />
                {/* Riutilizzo: mostra select se non c'è default in lista */}
                {(!list.default_reuse || overriddenFields.reuse) && (
                  <DriverSelect
                    label="Riutilizzo"
                    driverType="reuse"
                    value={reuse}
                    onChange={setReuse}
                    defaultSource={getDefaultSource('reuse')?.source}
                    isOverridden={!!overriddenFields.reuse}
                    onToggleOverride={() => handleToggleOverride('reuse')}
                  />
                )}
                {/* Ambienti: mostra select se non c'è default in lista */}
                {(!list.default_environments || overriddenFields.environments) && (
                  <DriverSelect
                    label="Ambienti"
                    driverType="environments"
                    value={environments}
                    onChange={setEnvironments}
                    defaultSource={getDefaultSource('environments')?.source}
                    isOverridden={!!overriddenFields.environments}
                    onToggleOverride={() => handleToggleOverride('environments')}
                  />
                )}
                {/* Stakeholders: mostra select se non c'è default in lista */}
                {(!list.default_stakeholders || overriddenFields.stakeholders) && (
                  <DriverSelect
                    label="Stakeholder"
                    driverType="stakeholders"
                    value={stakeholders}
                    onChange={setStakeholders}
                    defaultSource={getDefaultSource('stakeholders')?.source}
                    isOverridden={!!overriddenFields.stakeholders}
                    onToggleOverride={() => handleToggleOverride('stakeholders')}
                  />
                )}
              </CardContent>
            </Card>

            {/* Rischi */}
            <Card className="border-2 border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-950/30 flex flex-col overflow-hidden flex-1 min-h-0">
              <CardHeader className="pb-1.5 pt-2 px-3 shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[10px] font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-1.5">
                    Rischi PP
                    {selectedRisks.length > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                        {selectedRisks.length}
                      </Badge>
                    )}
                  </CardTitle>
                  {getDefaultSource('risks') && (
                    <DefaultPill
                      source={getDefaultSource('risks')!.source}
                      isOverridden={!!overriddenFields.risks}
                      onToggleOverride={() => handleToggleOverride('risks')}
                    />
                  )}
                </div>
                {selectedRisks.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-orange-800 dark:text-orange-200">Score: {getTotalRiskWeight()}pt</span>
                      <span className={`font-semibold ${getRiskBand(getTotalRiskWeight()).color}`}>
                        {getRiskBand(getTotalRiskWeight()).band}
                      </span>
                    </div>
                    <div className="w-full bg-orange-200 dark:bg-orange-900 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${getTotalRiskWeight() <= 10 ? 'bg-green-500'
                          : getTotalRiskWeight() <= 20 ? 'bg-yellow-500'
                            : 'bg-red-500'
                          }`}
                        style={{ width: `${Math.min((getTotalRiskWeight() / 30) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-orange-700 dark:text-orange-300">
                      <span>0-10:Low</span>
                      <span>11-20:Med</span>
                      <span>21+:High</span>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-1 overflow-y-auto flex-1 px-2 pb-2">
                <Accordion type="multiple" defaultValue={['Technical', 'Business']} className="space-y-1">
                  {risksByCategory.map(({ category, risks: catRisks }) => {
                    const selectedCount = catRisks.filter(r => selectedRisks.includes(r.risk_id)).length;
                    const categoryIcons = { Technical: '⚙️', Business: '💼', Governance: '🛡️', Integration: '🔗' } as const;

                    return (
                      <AccordionItem key={category} value={category} className="border rounded px-1.5">
                        <AccordionTrigger className="py-1.5 hover:no-underline">
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="text-xs">{categoryIcons[category as keyof typeof categoryIcons]}</span>
                            <span className="font-medium">{category}</span>
                            {selectedCount > 0 && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1 py-0">
                                {selectedCount}
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-1 pb-1.5">
                          {catRisks.map((risk) => (
                            <div key={risk.risk_id} className="flex items-start space-x-1.5 group">
                              <Checkbox
                                id={risk.risk_id}
                                checked={selectedRisks.includes(risk.risk_id)}
                                onCheckedChange={(checked) => {
                                  const isChecked = checked === true;
                                  setSelectedRisks(prev =>
                                    isChecked
                                      ? (prev.includes(risk.risk_id) ? prev : [...prev, risk.risk_id])
                                      : prev.filter(id => id !== risk.risk_id)
                                  );
                                }}
                                className="mt-0.5 h-3.5 w-3.5"
                              />
                              <div className="flex-1 min-w-0">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <label
                                      htmlFor={risk.risk_id}
                                      className="text-[10px] font-medium cursor-help hover:underline block leading-tight"
                                    >
                                      {risk.risk_item}
                                      <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 h-3">
                                        +{risk.weight}
                                      </Badge>
                                    </label>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-md">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2">
                                        <span>{categoryIcons[risk.category as keyof typeof categoryIcons]}</span>
                                        <span>{risk.risk_item}</span>
                                      </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-3">
                                      <div>
                                        <h4 className="text-sm font-semibold mb-1">Descrizione</h4>
                                        <p className="text-sm text-muted-foreground">{risk.guidance}</p>
                                      </div>
                                      <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <h4 className="text-sm font-semibold mb-1 text-blue-900 dark:text-blue-100">💡 Come mitigare</h4>
                                        <p className="text-sm text-blue-800 dark:text-blue-200">{risk.mitigation}</p>
                                      </div>
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Categoria: {risk.category}</span>
                                        <span className="font-semibold">Peso: +{risk.weight} punti</span>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                <p className="text-[9px] text-muted-foreground line-clamp-1 leading-tight">{risk.guidance}</p>
                              </div>
                            </div>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          </div>

          {/* Col 2 */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="pb-1.5 pt-2 px-3 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold">Attività</CardTitle>
                <div className="flex items-center gap-2">
                  <AddActivityDialog />
                  {getDefaultSource('activities') && (
                    <DefaultPill
                      source={getDefaultSource('activities')!.source}
                      isOverridden={!!overriddenFields.activities}
                      onToggleOverride={() => handleToggleOverride('activities')}
                    />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto  px-2 pb-2">
              {/* Custom (user-created) activities whose group is not present in the catalog */}
              {topCustomSelectedActivities.length > 0 && (
                <div className="mb-2 space-y-1 px-1">
                  {topCustomSelectedActivities.map((synthetic) => (
                    <div key={synthetic.activity_code} className="flex items-center justify-between bg-accent/10 rounded px-2 py-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-5">Custom</Badge>
                        <div className="text-[11px] font-medium">{synthetic.display_name} ({synthetic.base_days}gg)</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <ActivityOverrideEditor activity={synthetic} />
                        <ConfirmRemoveDialog name={synthetic.display_name} onConfirm={() => handleRemoveCustom(synthetic.activity_code)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Accordion
                type="multiple"
                defaultValue={lastGroupKey ? [lastGroupKey] : []}
                className="w-full"
              >
                {Object.keys(activitiesByGroup).map((group) => {
                  const groupActivities = activitiesByGroup[group] || [];
                  const selectedCount = groupActivities.filter(a => selectedActivities.includes(a.activity_code)).length;
                  const totalCount = groupActivities.length;

                  return (
                    <AccordionItem key={group} value={group}>
                      <AccordionTrigger className="text-[10px] font-semibold text-primary hover:no-underline py-1.5">
                        <div className="flex items-center justify-between w-full pr-2">
                          <span>{group}</span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                            {selectedCount}/{totalCount}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-1 pt-1 pb-1.5">
                        {groupActivities.map((activity) => (
                          <div key={activity.activity_code} className="flex items-start space-x-1.5">
                            <Checkbox
                              id={activity.activity_code}
                              checked={selectedActivities.includes(activity.activity_code)}
                              onCheckedChange={(checked) => {
                                const isChecked = checked === true; // Radix: boolean | 'indeterminate'
                                setSelectedActivities(prev =>
                                  isChecked
                                    ? (prev.includes(activity.activity_code) ? prev : [...prev, activity.activity_code])
                                    : prev.filter(id => id !== activity.activity_code)
                                );
                              }}
                              className="mt-0.5 h-3.5 w-3.5"
                            />
                            <div className="flex-1 flex items-center gap-1 min-w-0">
                              {(() => {
                                const ov = activityOverrides[activity.activity_code];
                                const labelName = ov?.override_name || activity.display_name;
                                const labelDays = ov?.override_days != null ? ov.override_days : activity.base_days;
                                return (
                                  <label
                                    htmlFor={activity.activity_code}
                                    className="text-[10px] font-medium cursor-pointer flex-1 truncate leading-tight"
                                    title={labelName}
                                  >
                                    {labelName} ({labelDays}gg)
                                  </label>
                                );
                              })()}
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-4 w-4 p-0 flex-shrink-0" aria-label={`Info ${activity.display_name}`}>
                                    <Info className="h-3 w-3" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>{activity.display_name}</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-3">
                                    <div>
                                      <p className="font-semibold">Giorni Base: {activity.base_days}</p>
                                      <p className="text-sm text-muted-foreground">Gruppo: {activity.driver_group}</p>
                                    </div>
                                    <div>
                                      <h4 className="font-semibold mb-2">Descrizione Breve</h4>
                                      <p className="text-sm">{activity.helper_short}</p>
                                    </div>
                                    <div>
                                      <h4 className="font-semibold mb-2">Dettagli Completi</h4>
                                      <div className="text-sm whitespace-pre-line">{activity.helper_long}</div>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              {/* Edit override button */}
                              <ActivityOverrideEditor activity={activity} />
                            </div>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>

          {/* Col 3 - Summary */}
          <div className="flex flex-col gap-2 h-full min-h-0">
            {/* Opzionali */}
            {optionalActivityObjects.length > 0 && (
              <Card className="border border-dashed border-yellow-200 bg-yellow-50/40 dark:border-yellow-800/40 dark:bg-yellow-900/20 shrink-0">
                <CardHeader className="pb-1 pt-2 px-3 shrink-0">
                  <CardTitle className="text-xs font-semibold text-yellow-900 dark:text-yellow-100">Attività opzionali</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-3 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-muted-foreground">Attività consigliate per stati/transizioni</p>
                      <p className="text-[9px] text-muted-foreground">
                        {optionalActivityObjects.map((a) => `${a.display_name} (${a.base_days}gg)`).join(' · ')}
                      </p>
                    </div>
                    <label htmlFor="include-optional-activities" className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[10px] font-semibold text-muted-foreground">{includeOptional ? 'Inclusa' : 'Esclusa'}</span>
                      <Checkbox
                        id="include-optional-activities"
                        checked={includeOptional}
                        onCheckedChange={(checked) => setIncludeOptional(checked === true)}
                        className="h-4 w-4"
                      />
                    </label>
                  </div>
                  {includeOptional && optionalActivitiesTotalDays > 0 && (
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Impatto stimato</span>
                      <Badge className="text-[9px] px-2 py-0.5">+{optionalActivitiesTotalDays} gg</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            <Card className="border-2 border-primary bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col shrink-0">
              <CardHeader className="pb-1.5 pt-2 px-3 shrink-0 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-primary">Riepilogo</CardTitle>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-primary border-primary/40">Auto</Badge>
              </CardHeader>
              <CardContent className="space-y-1.5 px-3 pb-3 shrink-0">
                {calculatedEstimate ? (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <div className="text-center p-1.5 bg-white/80 dark:bg-gray-900/80 rounded border">
                        <p className="text-muted-foreground text-[9px] leading-tight">Base</p>
                        <p className="font-semibold text-xs">{calculatedEstimate.activities_base_days}</p>
                      </div>
                      <div className="text-center p-1.5 bg-white/80 dark:bg-gray-900/80 rounded border">
                        <p className="text-muted-foreground text-[9px] leading-tight">Molt.</p>
                        <p className="font-semibold text-xs">x{calculatedEstimate.driver_multiplier}</p>
                      </div>
                      <div className="text-center p-1.5 bg-white/80 dark:bg-gray-900/80 rounded border">
                        <p className="text-muted-foreground text-[9px] leading-tight">Subtot.</p>
                        <p className="font-semibold text-xs">{calculatedEstimate.subtotal_days}gg</p>
                      </div>
                      <div className="text-center p-1.5 bg-orange-50 dark:bg-orange-900/50 rounded border border-orange-200 dark:border-orange-800">
                        <p className="text-muted-foreground text-[9px] leading-tight">Conting.</p>
                        <p className="font-semibold text-xs text-orange-800 dark:text-orange-300">
                          {calculatedEstimate.contingency_days}gg
                        </p>
                      </div>
                    </div>

                    <div className="text-center py-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg border border-primary/30">
                      <p className="text-muted-foreground text-[9px] leading-tight">Totale</p>
                      <p className="text-2xl font-bold text-primary leading-none">{calculatedEstimate.total_days} gg</p>
                    </div>

                    <Button onClick={handleSave} className="w-full h-7 text-xs">
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      Salva Stima
                    </Button>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground text-center py-3">
                    Compila i parametri per vedere la stima
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
