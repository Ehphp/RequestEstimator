import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Info, AlertCircle, Copy, Sparkles, RotateCcw, User, Calendar, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Requirement, Estimate, Activity, List, DefaultSource } from '../types';
import { activities, drivers, risks } from '../data/catalog';
import { calculateEstimate, validateEstimateInputs } from '../lib/calculations';
import { saveEstimate, getEstimatesByReqId } from '../lib/storage';
import { getEstimateDefaults, updateStickyDefaults, resetToDefaults } from '../lib/defaults';
import { DefaultPill } from './DefaultPill';

interface EstimateEditorProps {
  requirement: Requirement;
  list: List;
  onBack: () => void;
}

export function EstimateEditor({ requirement, list, onBack }: EstimateEditorProps) {
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
  const [isInitialized, setIsInitialized] = useState(false);

  const currentUser = 'current.user@example.com'; // In real app, get from auth

  useEffect(() => {
    setPreviousEstimates(getEstimatesByReqId(requirement.req_id));
    
    if (!isInitialized) {
      // Apply smart defaults on first load
      const { defaults, sources } = getEstimateDefaults(requirement, list, currentUser);
      
      setScenario(defaults.scenario || 'A');
      setComplexity(defaults.complexity || '');
      setEnvironments(defaults.environments || '');
      setReuse(defaults.reuse || '');
      setStakeholders(defaults.stakeholders || '');
      setSelectedActivities(defaults.included_activities || []);
      setSelectedRisks(defaults.selected_risks || []);
      setIncludeOptional(defaults.include_optional || false);
      
      setDefaultSources(sources);
      setIsInitialized(true);
    }
  }, [requirement.req_id, list, currentUser, isInitialized]);

  const groupedActivities = activities.reduce((groups, activity) => {
    const group = activity.driver_group;
    if (!groups[group]) groups[group] = [];
    groups[group].push(activity);
    return groups;
  }, {} as Record<string, Activity[]>);

  const handleCalculate = () => {
    const selectedActivityObjects = activities.filter(a => selectedActivities.includes(a.activity_code));
    const validationErrors = validateEstimateInputs(complexity, environments, reuse, stakeholders, selectedActivityObjects);
    
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
        selectedRisks,
        includeOptional
      );
      setCalculatedEstimate(estimate);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Errore nel calcolo']);
      setCalculatedEstimate(null);
    }
  };

  const handleSave = () => {
    if (!calculatedEstimate) {
      alert('Calcola prima la stima');
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

    saveEstimate(estimate);
    
    // Update sticky defaults for future estimates
    updateStickyDefaults(currentUser, list.list_id, {
      complexity,
      environments,
      reuse,
      stakeholders,
      included_activities: selectedActivities
    });
    
    alert('Stima salvata con successo!');
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

  const handleToggleOverride = (field: string) => {
    setOverriddenFields(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
    
    if (!overriddenFields[field]) {
      // If switching back to default, recalculate defaults
      const { defaults } = getEstimateDefaults(requirement, list, currentUser);
      
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

  const handleResetAllDefaults = () => {
    const { defaults, sources } = resetToDefaults(requirement, list, currentUser);
    
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

  const getDriverOptions = (driverType: string) => {
    return drivers.filter(d => d.driver === driverType);
  };

  const getDefaultSource = (field: string) => {
    return defaultSources.find(s => s.field === field);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Med': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'Proposed': return 'bg-blue-100 text-blue-800';
      case 'Selected': return 'bg-purple-100 text-purple-800';
      case 'Scheduled': return 'bg-orange-100 text-orange-800';
      case 'Done': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="complexity" className="text-sm">Complessità</Label>
                {getDefaultSource('complexity') && (
                  <DefaultPill
                    source={getDefaultSource('complexity')!.source}
                    isOverridden={overriddenFields.complexity || false}
                    onToggleOverride={() => handleToggleOverride('complexity')}
                  />
                )}
              </div>
              <Select value={complexity} onValueChange={setComplexity}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona complessità" />
                </SelectTrigger>
                <SelectContent>
                  {getDriverOptions('complexity').map((driver) => (
                    <SelectItem key={driver.option} value={driver.option}>
                      {driver.option} (x{driver.multiplier}) - {driver.explanation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="environments" className="text-sm">Ambienti</Label>
                {getDefaultSource('environments') && (
                  <DefaultPill
                    source={getDefaultSource('environments')!.source}
                    isOverridden={overriddenFields.environments || false}
                    onToggleOverride={() => handleToggleOverride('environments')}
                  />
                )}
              </div>
              <Select value={environments} onValueChange={setEnvironments}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona ambienti" />
                </SelectTrigger>
                <SelectContent>
                  {getDriverOptions('environments').map((driver) => (
                    <SelectItem key={driver.option} value={driver.option}>
                      {driver.option} (x{driver.multiplier}) - {driver.explanation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="reuse" className="text-sm">Riutilizzo</Label>
                {getDefaultSource('reuse') && (
                  <DefaultPill
                    source={getDefaultSource('reuse')!.source}
                    isOverridden={overriddenFields.reuse || false}
                    onToggleOverride={() => handleToggleOverride('reuse')}
                  />
                )}
              </div>
              <Select value={reuse} onValueChange={setReuse}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona riutilizzo" />
                </SelectTrigger>
                <SelectContent>
                  {getDriverOptions('reuse').map((driver) => (
                    <SelectItem key={driver.option} value={driver.option}>
                      {driver.option} (x{driver.multiplier}) - {driver.explanation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="stakeholders" className="text-sm">Stakeholder</Label>
                {getDefaultSource('stakeholders') && (
                  <DefaultPill
                    source={getDefaultSource('stakeholders')!.source}
                    isOverridden={overriddenFields.stakeholders || false}
                    onToggleOverride={() => handleToggleOverride('stakeholders')}
                  />
                )}
              </div>
              <Select value={stakeholders} onValueChange={setStakeholders}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona stakeholder" />
                </SelectTrigger>
                <SelectContent>
                  {getDriverOptions('stakeholders').map((driver) => (
                    <SelectItem key={driver.option} value={driver.option}>
                      {driver.option} (x{driver.multiplier}) - {driver.explanation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                <CardTitle className="text-lg text-orange-900">Rischi & Contingenza</CardTitle>
                {getDefaultSource('risks') && (
                  <DefaultPill
                    source={getDefaultSource('risks')!.source}
                    isOverridden={overriddenFields.risks || false}
                    onToggleOverride={() => handleToggleOverride('risks')}
                  />
                )}
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
                        {risk.risk_item} (peso: {risk.weight})
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
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-muted-foreground text-xs">Contingenza</p>
                      <p className="font-semibold">
                        {calculatedEstimate.contingency_days}gg 
                        ({Math.round((calculatedEstimate.contingency_pct || 0) * 100)}%)
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-muted-foreground text-sm">Totale Finale</p>
                    <p className="text-3xl font-bold text-primary">{calculatedEstimate.total_days} giorni</p>
                  </div>
                  
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