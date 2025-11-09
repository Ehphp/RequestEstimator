import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Calculator, Edit, Trash2, Sparkles, BarChart3, List as ListIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { List, Requirement, Estimate, DefaultSource } from '../types';
import { getListById, getRequirementsByListId, saveRequirement, deleteRequirement, getLatestEstimates } from '../lib/storage';
import { getRequirementDefaults } from '../lib/defaults';
import { getPriorityColor, getStateColor } from '@/lib/utils';
import { DefaultPill } from './DefaultPill';
import { RequirementFormFields, RequirementFormStateBase } from './requirements/RequirementFormFields';
import { EstimateEditor } from './EstimateEditor';
import { DashboardView } from './DashboardView';

interface RequirementsViewProps {
  listId: string;
  onBack: () => void;
}

export function RequirementsView({ listId, onBack }: RequirementsViewProps) {
  const [list, setList] = useState<List | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [estimatingRequirement, setEstimatingRequirement] = useState<Requirement | null>(null);
  const [estimatesMap, setEstimatesMap] = useState<Map<string, Estimate>>(new Map());
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    priority: Requirement['priority'];
    business_owner: string;
    labels: string;
    state: Requirement['state'];
    estimator: string;
  }>({
    title: '',
    description: '',
    priority: 'Med',
    business_owner: '',
    labels: '',
    state: 'Proposed',
    estimator: ''
  });
  const [defaultSources, setDefaultSources] = useState<DefaultSource[]>([]);
  const [overriddenFields, setOverriddenFields] = useState<Record<string, boolean>>({});

  const currentUser = 'current.user@example.com'; // In real app, get from auth

  useEffect(() => {
    loadData();
  }, [listId]);

  const loadData = async () => {
    const currentList = await getListById(listId);
    setList(currentList || null);
    const reqs = await getRequirementsByListId(listId);
    setRequirements(reqs);

    // Carica le stime per tutti i requisiti
    const latestEstimates = await getLatestEstimates(reqs.map(req => req.req_id));
    const estimates = new Map();
    reqs.forEach(req => {
      const estimate = latestEstimates[req.req_id];
      if (estimate) {
        estimates.set(req.req_id, estimate);
      }
    });
    setEstimatesMap(estimates);
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({ ...prev, title }));

    if (!editingRequirement && list && title.trim()) {
      // Apply smart defaults when title changes
      const { defaults, sources } = getRequirementDefaults(list, currentUser, title);

      // Update form data with defaults (only for non-overridden fields)
      if (!overriddenFields.priority && defaults.priority) {
        setFormData(prev => ({ ...prev, priority: defaults.priority as Requirement['priority'] }));
      }
      if (!overriddenFields.labels && defaults.labels) {
        setFormData(prev => ({ ...prev, labels: defaults.labels ?? '' }));
      }
      if (!overriddenFields.description && defaults.description) {
        setFormData(prev => ({ ...prev, description: defaults.description ?? '' }));
      }
      if (!overriddenFields.business_owner && defaults.business_owner) {
        setFormData(prev => ({ ...prev, business_owner: defaults.business_owner ?? '' }));
      }
      if (!overriddenFields.estimator && defaults.estimator) {
        setFormData(prev => ({ ...prev, estimator: defaults.estimator ?? '' }));
      }

      setDefaultSources(sources);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const requirementData: Requirement = {
      req_id: editingRequirement?.req_id || `REQ-${Date.now()}`,
      list_id: listId,
      ...formData,
      created_on: editingRequirement?.created_on || new Date().toISOString(),
      last_estimated_on: editingRequirement?.last_estimated_on,
      // Add default source tracking
      priority_default_source: overriddenFields.priority ? undefined : defaultSources.find(s => s.field === 'priority')?.source,
      priority_is_overridden: overriddenFields.priority || false,
      labels_default_source: overriddenFields.labels ? undefined : defaultSources.find(s => s.field === 'labels')?.source,
      labels_is_overridden: overriddenFields.labels || false,
      description_default_source: overriddenFields.description ? undefined : defaultSources.find(s => s.field === 'description')?.source,
      description_is_overridden: overriddenFields.description || false
    };

    saveRequirement(requirementData);
    loadData();
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'Med',
      business_owner: '',
      labels: '',
      state: 'Proposed',
      estimator: ''
    });
    setDefaultSources([]);
    setOverriddenFields({});
    setEditingRequirement(null);
    setShowCreateDialog(false);
  };

  const handleCreateNew = () => {
    resetForm();
    if (list) {
      // Apply initial defaults
      const { defaults } = getRequirementDefaults(list, currentUser);
      setFormData(prev => ({
        ...prev,
        business_owner: defaults.business_owner || '',
        estimator: defaults.estimator || '',
        state: defaults.state || 'Proposed'
      }));
    }
    setShowCreateDialog(true);
  };

  const handleEdit = (requirement: Requirement) => {
    setEditingRequirement(requirement);
    setFormData({
      title: requirement.title,
      description: requirement.description,
      priority: requirement.priority,
      business_owner: requirement.business_owner,
      labels: requirement.labels ?? '',
      state: requirement.state,
      estimator: requirement.estimator ?? ''
    });
    // When editing, consider fields with default sources as potentially overridden
    setOverriddenFields({
      priority: requirement.priority_is_overridden || false,
      labels: requirement.labels_is_overridden || false,
      description: requirement.description_is_overridden || false
    });
    setDefaultSources([]);
    setShowCreateDialog(true);
  };

  const handleDelete = (reqId: string) => {
    if (confirm('Sei sicuro di voler eliminare questo requisito e tutte le sue stime?')) {
      deleteRequirement(reqId);
      loadData();
    }
  };

  const handleToggleOverride = (field: string) => {
    setOverriddenFields(prev => ({
      ...prev,
      [field]: !prev[field]
    }));

    if (!overriddenFields[field] && list) {
      // If switching back to default, recalculate defaults
      const { defaults } = getRequirementDefaults(list, currentUser, formData.title);

      if (field === 'priority' && defaults.priority) {
        setFormData(prev => ({ ...prev, priority: defaults.priority as Requirement['priority'] }));
      }
      if (field === 'labels' && defaults.labels) {
        setFormData(prev => ({ ...prev, labels: defaults.labels ?? '' }));
      }
      if (field === 'description' && defaults.description) {
        setFormData(prev => ({ ...prev, description: defaults.description ?? '' }));
      }
    }
  };

  const handleFormFieldChange = <K extends keyof RequirementFormStateBase>(field: K, value: RequirementFormStateBase[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderDefaultPill = (field: string) => {
    if (editingRequirement) {
      return null;
    }

    const source = defaultSources.find((s) => s.field === field);
    if (!source) {
      return null;
    }

    return (
      <DefaultPill
        source={source.source}
        isOverridden={overriddenFields[field] || false}
        onToggleOverride={() => handleToggleOverride(field)}
      />
    );
  };

  if (estimatingRequirement) {
    return (
      <EstimateEditor
        requirement={estimatingRequirement}
        list={list!}
        onBack={() => {
          setEstimatingRequirement(null);
          loadData();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb con metriche e azione */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-muted-foreground">Liste</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold">{list?.name}</span>
          </Button>
          <span className="text-muted-foreground">•</span>
          <span className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{requirements.length}</span> requisiti
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-sm text-muted-foreground">{list?.owner}</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-sm text-muted-foreground">{list?.period}</span>
          {list?.preset_key && (
            <>
              <span className="text-muted-foreground">•</span>
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3 w-3" />
                Default intelligenti
              </Badge>
            </>
          )}
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Requisito
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRequirement ? 'Modifica Requisito' : 'Crea Nuovo Requisito'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <RequirementFormFields
                formData={formData}
                onChange={handleFormFieldChange}
                onTitleChange={handleTitleChange}
                includeEstimator
                labelExtras={{
                  description: renderDefaultPill('description'),
                  priority: renderDefaultPill('priority'),
                  labels: renderDefaultPill('labels')
                }}
                titlePlaceholder="Titolo del requisito (i default si aggiornano automaticamente)"
                descriptionPlaceholder="Descrizione dettagliata del requisito"
                labelsPlaceholder="es. HR, Notifiche, Critical"
                labelsLabel="Labels (separati da virgola)"
              />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingRequirement ? 'Aggiorna' : 'Crea'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Annulla
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs per visualizzazione Lista/Dashboard */}
      <Tabs defaultValue="list" className="w-full mt-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <ListIcon className="h-4 w-4" />
            Lista Requisiti
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard Stima
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="grid gap-4">
            {requirements.map((requirement) => {
              const latestEstimate = estimatesMap.get(requirement.req_id);
              return (
                <Card key={requirement.req_id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{requirement.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {requirement.req_id} • Owner: {requirement.business_owner}
                        </p>
                        {/* Show default sources for key fields */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {requirement.priority_default_source && !requirement.priority_is_overridden && (
                            <Badge variant="secondary" className="text-xs">
                              Priority: {requirement.priority_default_source}
                            </Badge>
                          )}
                          {requirement.labels_default_source && !requirement.labels_is_overridden && (
                            <Badge variant="secondary" className="text-xs">
                              Labels: {requirement.labels_default_source}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getPriorityColor(requirement.priority)}>
                          {requirement.priority}
                        </Badge>
                        <Badge className={getStateColor(requirement.state)}>
                          {requirement.state}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm line-clamp-2">{requirement.description}</p>

                    {latestEstimate && (
                      <div className="bg-muted p-3 rounded-lg">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Scenario</p>
                            <p className="font-medium">{latestEstimate.scenario}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Subtotal</p>
                            <p className="font-medium">{latestEstimate.subtotal_days} giorni</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Totale</p>
                            <p className="font-semibold text-primary">{latestEstimate.total_days} giorni</p>
                          </div>
                        </div>
                        {/* Show default tracking for estimates */}
                        {latestEstimate.default_json && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-xs text-muted-foreground">
                              <Sparkles className="h-3 w-3 inline mr-1" />
                              Stima con default intelligenti applicati
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {requirement.labels && (
                      <div className="flex flex-wrap gap-1">
                        {requirement.labels.split(',').map((label, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {label.trim()}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => setEstimatingRequirement(requirement)}
                        className="flex-1"
                      >
                        <Calculator className="h-4 w-4 mr-1" />
                        {latestEstimate ? 'Aggiorna Stima' : 'Crea Stima'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(requirement)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(requirement.req_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {requirements.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">Nessun requisito creato ancora</p>
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Crea il primo requisito
                {list?.preset_key && (
                  <Badge variant="secondary" className="ml-2">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Con default intelligenti
                  </Badge>
                )}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dashboard" className="mt-6">
          {list && (
            <DashboardView
              list={list}
              requirements={requirements}
              onBack={onBack}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
