import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Save, Info, AlertCircle, Copy, Sparkles, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { saveEstimate, getEstimatesByReqId } from '../lib/storage';
import { getEstimateDefaults, updateStickyDefaults, resetToDefaults } from '../lib/defaults';
import { validateEstimate } from '../lib/validation';
import { getPriorityColor, getStateColor } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { DefaultPill } from './DefaultPill';
import { DriverSelect } from './DriverSelect';

interface EstimateEditorProps {
  requirement: Requirement;
  list: List;
  onBack: () => void;
  selectedEstimate?: Estimate | null;
}

export function EstimateEditor({ requirement, list, onBack, selectedEstimate }: EstimateEditorProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const {
    defaultSources,
    setDefaultSources,
    overriddenFields,
    setOverriddenFields
  } = useDefaultTracking();
  const [scenario, setScenario] = useState('A');
  const [complexity, setComplexity] = useState('');
  const [environments, setEnvironments] = useState('');
  const [reuse, setReuse] = useState('');
  const [stakeholders, setStakeholders] = useState('');
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedRisks, setSelectedRisks] = useState<string[]>([]);
  const [includeOptional, setIncludeOptional] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [calculatedEstimate, setCalculatedEstimate] = useState<Partial<Estimate> | null>(null);
  const [previousEstimates, setPreviousEstimates] = useState<Estimate[]>([]);
  const [autoCalcReady, setAutoCalcReady] = useState(false);

  // Load previous estimates
  useEffect(() => {
    let isMounted = true;

    const loadEstimates = async () => {
      const estimates = await getEstimatesByReqId(requirement.req_id);
      if (isMounted) {
        setPreviousEstimates(estimates);
      }
    };

    loadEstimates();

    return () => {
      isMounted = false;
    };
  }, [requirement.req_id]);

  // Initialize form data
  useEffect(() => {
    let isMounted = true;
    setAutoCalcReady(false);

    const loadInitialData = async () => {
      if (!currentUser) return;

      // If a specific estimate is selected, load its data
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

        // Mark all as overridden when viewing existing estimate
        setOverriddenFields({
          complexity: true,
          environments: true,
          reuse: true,
          stakeholders: true,
          activities: true,
          risks: true
        });
        setDefaultSources([]);
      } else {
        // Apply smart defaults on first load
        const { defaults, sources } = await getEstimateDefaults(requirement, list, currentUser);
        if (!isMounted) return;

        setScenario(defaults.scenario || 'A');
        setComplexity(defaults.complexity || '');
        setEnvironments(defaults.environments || '');
        setReuse(defaults.reuse || '');
        setStakeholders(defaults.stakeholders || '');
        setSelectedActivities(defaults.included_activities || []);
        setSelectedRisks(defaults.selected_risks || []);
        setIncludeOptional(defaults.include_optional || false);

        setDefaultSources(sources);
      }

      if (isMounted) {
        setAutoCalcReady(true);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [selectedEstimate?.estimate_id, requirement.req_id, list, currentUser]);

  const groupedActivities = activities.reduce((groups, activity) => {
    const group = activity.driver_group;
    if (!groups[group]) groups[group] = [];
    groups[group].push(activity);
    return groups;
  }, {} as Record<string, Activity[]>);
  const selectedActivityObjects = useMemo(
    () => activities.filter(a => selectedActivities.includes(a.activity_code)),
    [selectedActivities]
  );

  const calculateAndUpdateEstimate = useCallback(() => {
    const validationErrors = validateEstimate(
      complexity,
      environments,
      reuse,
      stakeholders,
      selectedActivityObjects
    );

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setCalculatedEstimate(null);
      return;
    }

    setErrors([]);

    try {
      const estimate = calculateEstimate(
        selectedActivityObjects,
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
  }, [complexity, environments, reuse, stakeholders, selectedActivityObjects, selectedRisks]);

  useEffect(() => {
    if (!autoCalcReady) return;
    calculateAndUpdateEstimate();
  }, [autoCalcReady, calculateAndUpdateEstimate]);

  const handleSave = async () => {
    if (!calculatedEstimate) {
      setErrors(['Completa i parametri per generare la stima automatica prima di salvare']);
      return;
    }

    // Validate using centralized validation
    const validationErrors = validateEstimate(complexity, environments, reuse, stakeholders, undefined, {
      validateActivities: false,
      strictMode: true
    });
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const estimate: Estimate = {
      estimate_id: `EST-${Date.now()}`,
      req_id: requirement.req_id,
      scenario,
      complexity: complexity as Estimate['complexity'],
      environments: environments as Estimate['environments'],
      reuse: reuse as Estimate['reuse'],
      stakeholders: stakeholders as Estimate['stakeholders'],
      included_activities: selectedActivities,
      optional_activities: [],
      include_optional: includeOptional,
      selected_risks: selectedRisks,
      created_on: new Date().toISOString(),
      // Add default source tracking
      complexity_default_source: overriddenFields.complexity ? undefined : defaultSources.find(s => s.field === 'complexity')?.source,
      complexity_is_overridden: overriddenFields.complexity || false,
      environments_default_source: overriddenFields.environments ? undefined : defaultSources.find(s => s.field === 'environments')?.source,
      environments_is_overridden: overriddenFields.environments || false,
      reuse_default_source: overriddenFields.reuse ? undefined : defaultSources.find(s => s.field === 'reuse')?.source,
      reuse_is_overridden: overriddenFields.reuse || false,
      stakeholders_default_source: overriddenFields.stakeholders ? undefined : defaultSources.find(s => s.field === 'stakeholders')?.source,
      stakeholders_is_overridden: overriddenFields.stakeholders || false,
      activities_default_source: overriddenFields.activities ? undefined : defaultSources.find(s => s.field === 'activities')?.source,
      activities_is_overridden: overriddenFields.activities || false,
      risks_default_source: overriddenFields.risks ? undefined : defaultSources.find(s => s.field === 'risks')?.source,
      risks_is_overridden: overriddenFields.risks || false,
      default_json: JSON.stringify(defaultSources),
      ...calculatedEstimate
    } as Estimate;

    await saveEstimate(estimate);

    // Update sticky defaults for future estimates (if user is authenticated)
    if (currentUser) {
      await updateStickyDefaults(currentUser, list.list_id, {
        complexity: complexity as Estimate['complexity'],
        environments: environments as Estimate['environments'],
        reuse: reuse as Estimate['reuse'],
        stakeholders: stakeholders as Estimate['stakeholders'],
        included_activities: selectedActivities
      });
    }

    // Show success toast
    toast({
      title: 'Stima salvata',
      description: `Totale: ${calculatedEstimate.total_days} giorni`,
    });
    onBack();
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
    setCalculatedEstimate(null);
    setErrors([]);

    // Mark all as overridden when cloning
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

  const handleToggleOverride = async (field: string) => {
    setOverriddenFields(prev => ({
      ...prev,
      [field]: !prev[field]
    }));

    if (!overriddenFields[field] && currentUser) {
      // If switching back to default, recalculate defaults
      const { defaults } = await getEstimateDefaults(requirement, list, currentUser);

      if (field === 'complexity' && defaults.complexity) {
        setComplexity(defaults.complexity);
      }
      if (field === 'environments' && defaults.environments) {
        setEnvironments(defaults.environments);
      }
      if (field === 'reuse' && defaults.reuse) {
        setReuse(defaults.reuse);
      }
      if (field === 'stakeholders' && defaults.stakeholders) {
        setStakeholders(defaults.stakeholders);
      }
      if (field === 'activities' && defaults.included_activities) {
        setSelectedActivities(defaults.included_activities);
      }
      if (field === 'risks' && defaults.selected_risks) {
        setSelectedRisks(defaults.selected_risks);
      }
    }
  };

  const handleResetAllDefaults = async () => {
    if (!currentUser) return;

    const { defaults, sources } = await resetToDefaults(requirement, list, currentUser);

    setComplexity(defaults.complexity || '');
    setEnvironments(defaults.environments || '');
    setReuse(defaults.reuse || '');
    setStakeholders(defaults.stakeholders || '');
    setSelectedActivities(defaults.included_activities || []);
    setSelectedRisks(defaults.selected_risks || []);
    setIncludeOptional(defaults.include_optional || false);

    setDefaultSources(sources);
    setOverriddenFields({});
    setCalculatedEstimate(null);
  };

  const getDefaultSource = (field: string) => {
    return defaultSources.find(s => s.field === field);
  };

  // Calculate total risk weight for display
  const getTotalRiskWeight = () => {
    const selectedRiskObjects = risks.filter(risk => selectedRisks.includes(risk.risk_id));
    const totalWeight = selectedRiskObjects.reduce((sum, risk) => sum + risk.weight, 0);
    return totalWeight;
  };

  // Get risk band based on score
  const getRiskBand = (score: number): { band: string; color: string; bgColor: string } => {
    if (score === 0) return { band: 'None', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' };
    if (score <= 10) return { band: 'Low', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/30' };
    if (score <= 20) return { band: 'Medium', color: 'text-yellow-700 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-900/30' };
    return { band: 'High', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/30' };
  };

  // Group risks by category
  const risksByCategory = useMemo(() => {
    const categories = ['Technical', 'Business', 'Governance', 'Integration'] as const;
    return categories.map(cat => ({
      category: cat,
      risks: risks.filter(r => r.category === cat)
    }));
  }, []);

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-gray-950 overflow-hidden flex flex-col p-3">
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col gap-2">
        {/* Header Ultra-Compatto - singola riga */}
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border shadow-sm shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button variant="ghost" size="sm" onClick={onBack} className="h-7 w-7 p-0 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono text-muted-foreground shrink-0">{requirement.req_id}</span>
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-50 truncate flex-1">{requirement.title}</h1>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
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

        {/* Errors - Ultra Compatto */}
        {errors.length > 0 && (
          <Alert variant="destructive" className="py-1.5 px-3 shrink-0">
            <AlertCircle className="h-3.5 w-3.5" />
            <AlertDescription className="text-[10px]">
              {errors.map((error, index) => (
                <div key={index}>• {error}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* Previous Estimates - Compatto inline */}
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

        {/* Layout a 3 colonne - 100% altezza disponibile */}
        <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
          {/* Colonna 1: Scenario & Drivers - Compatto */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="pb-1.5 pt-2 px-3 shrink-0">
              <CardTitle className="text-xs font-semibold">Scenario & Driver</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 overflow-y-auto flex-1 px-3 pb-3">
              <div>
                <Label htmlFor="scenario" className="text-[10px]">Scenario</Label>
                <Input
                  id="scenario"
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  placeholder="es. A, B, C"
                  className="mt-1 h-7 text-xs"
                />
              </div>

              <DriverSelect
                label="Complessità"
                driverType="complexity"
                value={complexity}
                onChange={setComplexity}
                defaultSource={getDefaultSource('complexity')?.source}
                isOverridden={overriddenFields.complexity}
                onToggleOverride={() => handleToggleOverride('complexity')}
              />

              <DriverSelect
                label="Ambienti"
                driverType="environments"
                value={environments}
                onChange={setEnvironments}
                defaultSource={getDefaultSource('environments')?.source}
                isOverridden={overriddenFields.environments}
                onToggleOverride={() => handleToggleOverride('environments')}
              />

              <DriverSelect
                label="Riutilizzo"
                driverType="reuse"
                value={reuse}
                onChange={setReuse}
                defaultSource={getDefaultSource('reuse')?.source}
                isOverridden={overriddenFields.reuse}
                onToggleOverride={() => handleToggleOverride('reuse')}
              />

              <DriverSelect
                label="Stakeholder"
                driverType="stakeholders"
                value={stakeholders}
                onChange={setStakeholders}
                defaultSource={getDefaultSource('stakeholders')?.source}
                isOverridden={overriddenFields.stakeholders}
                onToggleOverride={() => handleToggleOverride('stakeholders')}
              />
            </CardContent>
          </Card>            {/* Colonna 2: Activity Selection - Compatto */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="pb-1.5 pt-2 px-3 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold">Attività</CardTitle>
                {getDefaultSource('activities') && (
                  <DefaultPill
                    source={getDefaultSource('activities')!.source}
                    isOverridden={overriddenFields.activities || false}
                    onToggleOverride={() => handleToggleOverride('activities')}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 px-2 pb-2">
              <Accordion type="multiple" defaultValue={[Object.keys(groupedActivities)[Object.keys(groupedActivities).length - 1]]} className="w-full">
                {Object.entries(groupedActivities).map(([group, groupActivities]) => {
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
                                if (checked) {
                                  setSelectedActivities([...selectedActivities, activity.activity_code]);
                                } else {
                                  setSelectedActivities(selectedActivities.filter(id => id !== activity.activity_code));
                                }
                              }}
                              className="mt-0.5 h-3.5 w-3.5"
                            />
                            <div className="flex-1 flex items-center gap-1 min-w-0">
                              <label
                                htmlFor={activity.activity_code}
                                className="text-[10px] font-medium cursor-pointer flex-1 truncate leading-tight"
                                title={activity.display_name}
                              >
                                {activity.display_name} ({activity.base_days}gg)
                              </label>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-4 w-4 p-0 flex-shrink-0">
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

          {/* Colonna 3: Rischi & Summary - Layout Ottimizzato */}
          <div className="flex flex-col gap-2 h-full min-h-0">
            {/* Rischi - Compatto con scroll */}
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
                      isOverridden={overriddenFields.risks || false}
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
                    {/* Mini Progress bar */}
                    <div className="w-full bg-orange-200 dark:bg-orange-900 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${getTotalRiskWeight() <= 10 ? 'bg-green-500' :
                          getTotalRiskWeight() <= 20 ? 'bg-yellow-500' : 'bg-red-500'
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
                    const categoryIcons = {
                      Technical: '⚙️',
                      Business: '💼',
                      Governance: '🛡️',
                      Integration: '🔗'
                    };

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
                                  if (checked) {
                                    setSelectedRisks([...selectedRisks, risk.risk_id]);
                                  } else {
                                    setSelectedRisks(selectedRisks.filter(id => id !== risk.risk_id));
                                  }
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
                                        <h4 className="text-sm font-semibold mb-1 text-blue-900 dark:text-blue-100">
                                          💡 Come mitigare
                                        </h4>
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
            </Card>            {/* Summary - Compatto, NO SCROLL, sempre visibile */}
            <Card className="border-2 border-primary bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col shrink-0">
              <CardHeader className="pb-1.5 pt-2 px-3 shrink-0 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-primary">Riepilogo</CardTitle>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-primary border-primary/40">
                  Auto
                </Badge>
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
