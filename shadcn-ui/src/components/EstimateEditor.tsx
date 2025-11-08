import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Info, AlertCircle, Copy, Sparkles, RotateCcw, User, Calendar, Tag, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Requirement, Estimate, Activity, List, DefaultSource } from '../types';
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
}

export function EstimateEditor({ requirement, list, onBack }: EstimateEditorProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
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
  const [defaultSources, setDefaultSources] = useState<DefaultSource[]>([]);
  const [overriddenFields, setOverriddenFields] = useState<Record<string, boolean>>({});
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const loadInitialData = async () => {
      // Load previous estimates asynchronously
      const estimates = await getEstimatesByReqId(requirement.req_id);
      setPreviousEstimates(estimates);

      if (!isInitializedRef.current) {
        // Apply smart defaults on first load
        const { defaults, sources } = await getEstimateDefaults(requirement, list, currentUser);

        setScenario(defaults.scenario || 'A');
        setComplexity(defaults.complexity || '');
        setEnvironments(defaults.environments || '');
        setReuse(defaults.reuse || '');
        setStakeholders(defaults.stakeholders || '');
        setSelectedActivities(defaults.included_activities || []);
        setSelectedRisks(defaults.selected_risks || []);
        setIncludeOptional(defaults.include_optional || false);

        setDefaultSources(sources);
        isInitializedRef.current = true;
      }
    };

    loadInitialData();
  }, [requirement.req_id, list, currentUser]);

  const groupedActivities = activities.reduce((groups, activity) => {
    const group = activity.driver_group;
    if (!groups[group]) groups[group] = [];
    groups[group].push(activity);
    return groups;
  }, {} as Record<string, Activity[]>);

  const handleCalculate = () => {
    const selectedActivityObjects = activities.filter(a => selectedActivities.includes(a.activity_code));

    const validationErrors = validateEstimate(complexity, environments, reuse, stakeholders, selectedActivityObjects);

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
  };

  const handleSave = async () => {
    if (!calculatedEstimate) {
      setErrors(['Calcola prima la stima prima di salvare']);
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

    const result = await saveEstimate(estimate);

    // Update sticky defaults for future estimates
    await updateStickyDefaults(currentUser, list.list_id, {
      complexity: complexity as Estimate['complexity'],
      environments: environments as Estimate['environments'],
      reuse: reuse as Estimate['reuse'],
      stakeholders: stakeholders as Estimate['stakeholders'],
      included_activities: selectedActivities
    });

    // Show success toast with optional warning
    toast({
      title: 'Stima salvata',
      description: result.warning
        ? `${result.warning}. Totale: ${calculatedEstimate.total_days} giorni`
        : `Totale: ${calculatedEstimate.total_days} giorni`,
      variant: result.warning ? 'default' : 'default',
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

    if (!overriddenFields[field]) {
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

  // Calculate expected contingency percentage for display
  const getExpectedContingencyPct = () => {
    const riskWeight = getTotalRiskWeight();
    return Math.min(0.05 + riskWeight, 0.50);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna ai Requisiti
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Stima Requisito</h1>
          <p className="text-muted-foreground">{requirement.req_id}</p>
          {list.preset_key && (
            <Badge variant="outline" className="mt-2">
              <Sparkles className="h-3 w-3 mr-1" />
              Default intelligenti da preset {list.preset_key}
            </Badge>
          )}
        </div>
        <Button variant="outline" onClick={handleResetAllDefaults}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Ripristina tutti i default
        </Button>
      </div>

      {/* Compact Requirement Information Section */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" />
            Informazioni Requisito
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div>
            <h3 className="font-semibold text-sm mb-1">{requirement.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{requirement.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge className={`${getPriorityColor(requirement.priority)} text-xs px-2 py-0.5`}>
              {requirement.priority}
            </Badge>
            <Badge className={`${getStateColor(requirement.state)} text-xs px-2 py-0.5`}>
              {requirement.state}
            </Badge>
            <div className="flex items-center gap-1">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{requirement.business_owner}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{new Date(requirement.created_on).toLocaleDateString('it-IT')}</span>
            </div>
            {requirement.last_estimated_on && (
              <span className="text-muted-foreground">
                • Ultima stima: {new Date(requirement.last_estimated_on).toLocaleDateString('it-IT')}
              </span>
            )}
          </div>

          {requirement.labels && (
            <div className="flex items-center gap-1 flex-wrap">
              <Tag className="h-3 w-3 text-muted-foreground" />
              {requirement.labels.split(',').map((label, index) => (
                <Badge key={index} variant="outline" className="text-xs px-1.5 py-0.5 h-5">
                  {label.trim()}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {previousEstimates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Stime Precedenti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {previousEstimates.slice(0, 3).map((estimate) => (
                <div key={estimate.estimate_id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">
                      Scenario {estimate.scenario} • {estimate.total_days} giorni
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(estimate.created_on).toLocaleDateString()} •
                      {estimate.complexity}/{estimate.environments}/{estimate.reuse}/{estimate.stakeholders}
                    </p>
                    {estimate.default_json && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Con default intelligenti
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCloneEstimate(estimate)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Clona
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optimized 3-Column Layout */}
      <div className="grid gap-4 xl:grid-cols-3 lg:grid-cols-2 grid-cols-1">
        {/* Column 1: Scenario & Drivers */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Scenario & Driver</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="scenario" className="text-sm">Scenario</Label>
              <Input
                id="scenario"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="es. A, B, C"
                className="mt-1"
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
        </Card>

        {/* Column 2: Activity Selection */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Selezione Attività</CardTitle>
              {getDefaultSource('activities') && (
                <DefaultPill
                  source={getDefaultSource('activities')!.source}
                  isOverridden={overriddenFields.activities || false}
                  onToggleOverride={() => handleToggleOverride('activities')}
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(groupedActivities).map(([group, groupActivities]) => (
              <div key={group}>
                <h4 className="font-semibold text-sm mb-2 text-primary">{group}</h4>
                <div className="space-y-2">
                  {groupActivities.map((activity) => (
                    <div key={activity.activity_code} className="flex items-center space-x-2">
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
                      />
                      <div className="flex-1 flex items-center gap-2">
                        <label
                          htmlFor={activity.activity_code}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {activity.display_name} ({activity.base_days}gg)
                        </label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{activity.helper_short}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Info className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{activity.display_name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
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
                </div>
                {group !== 'Analytics' && <Separator className="my-2" />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Column 3: Risks & Summary (Stacked) */}
        <div className="space-y-4">
          {/* Risks & Contingency - Now More Prominent */}
          <Card className="border-2 border-orange-200 bg-orange-50/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-orange-900 flex items-center gap-2">
                  Rischi & Contingenza
                  {selectedRisks.length > 0 && (
                    <Badge variant="outline" className="text-orange-700 border-orange-300">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +{Math.round(getExpectedContingencyPct() * 100)}% contingenza
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
              {/* Show current risk impact */}
              <div className="bg-orange-100 p-2 rounded text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-orange-800">Impatto Rischi:</span>
                  <Badge variant="outline" className="bg-orange-100 text-orange-800">
                    {selectedRisks.length} rischi • Peso totale: {getTotalRiskWeight()}
                  </Badge>
                </div>
                <div className="text-xs text-orange-700 mt-1">
                  Contingenza attesa: {Math.round(getExpectedContingencyPct() * 100)}% (5% base + {Math.round(getTotalRiskWeight() * 100)}% rischi)
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {risks.map((risk) => (
                  <div key={risk.risk_id} className="flex items-center space-x-2">
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
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={risk.risk_id}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {risk.risk_item}
                        <Badge variant="secondary" className="ml-2 text-xs">
                          +{Math.round(risk.weight * 100)}%
                        </Badge>
                      </label>
                      <p className="text-xs text-muted-foreground">{risk.guidance}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary - Now More Prominent */}
          <Card className="border-2 border-primary bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-primary">Riepilogo Calcolo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleCalculate} className="w-full" size="lg">
                <Info className="h-4 w-4 mr-2" />
                Calcola Stima
              </Button>

              {calculatedEstimate && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-muted-foreground text-xs">Giorni Base</p>
                      <p className="font-semibold">{calculatedEstimate.activities_base_days}</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-muted-foreground text-xs">Moltiplicatore</p>
                      <p className="font-semibold">x{calculatedEstimate.driver_multiplier}</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-muted-foreground text-xs">Subtotal</p>
                      <p className="font-semibold">{calculatedEstimate.subtotal_days} giorni</p>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded border border-orange-200">
                      <p className="text-muted-foreground text-xs">Contingenza</p>
                      <p className="font-semibold text-xs text-orange-800">
                        {calculatedEstimate.contingency_days} giorni
                        <br />({Math.round((calculatedEstimate.contingency_pct || 0) * 100)}%)
                      </p>
                    </div>
                  </div>

                  <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-muted-foreground text-sm">Totale Finale</p>
                    <p className="text-3xl font-bold text-primary">{calculatedEstimate.total_days} giorni</p>
                  </div>

                  {/* Show risk calculation details */}
                  {selectedRisks.length > 0 && (
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <p className="text-sm font-medium text-orange-900 mb-2">
                        <AlertCircle className="h-4 w-4 inline mr-1" />
                        Dettaglio Rischi:
                      </p>
                      <div className="text-xs text-orange-800 space-y-1">
                        <p>• {selectedRisks.length} rischi selezionati</p>
                        <p>• Peso totale: {getTotalRiskWeight()} ({Math.round(getTotalRiskWeight() * 100)}%)</p>
                        <p>• Contingenza: 5% base + {Math.round(getTotalRiskWeight() * 100)}% rischi = {Math.round((calculatedEstimate.contingency_pct || 0) * 100)}%</p>
                        <p>• Su {calculatedEstimate.subtotal_days} giorni = {calculatedEstimate.contingency_days} giorni contingenza</p>
                      </div>
                    </div>
                  )}

                  {/* Show applied defaults summary */}
                  {defaultSources.length > 0 && (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-900 mb-2">
                        <Sparkles className="h-4 w-4 inline mr-1" />
                        Default applicati:
                      </p>
                      <div className="text-xs text-blue-800 space-y-1">
                        {defaultSources.filter(s => !overriddenFields[s.field]).map((source, index) => (
                          <p key={index}>• {source.field}: {source.source}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button onClick={handleSave} className="w-full" size="lg">
                    <Save className="h-4 w-4 mr-2" />
                    Salva Stima
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}