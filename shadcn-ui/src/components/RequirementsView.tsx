import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Calculator, Edit, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { List, Requirement, DefaultSource } from '../types';
import { getLists, getRequirementsByListId, saveRequirement, deleteRequirement, getLatestEstimate } from '../lib/storage';
import { getRequirementDefaults } from '../lib/defaults';
import { DefaultPill } from './DefaultPill';
import { EstimateEditor } from './EstimateEditor';

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
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Med' as const,
    business_owner: '',
    labels: '',
    state: 'Proposed' as const,
    estimator: ''
  });
  const [defaultSources, setDefaultSources] = useState<DefaultSource[]>([]);
  const [overriddenFields, setOverriddenFields] = useState<Record<string, boolean>>({});

  const currentUser = 'current.user@example.com'; // In real app, get from auth

  useEffect(() => {
    loadData();
  }, [listId]);

  const loadData = () => {
    const lists = getLists();
    const currentList = lists.find(l => l.list_id === listId);
    setList(currentList || null);
    setRequirements(getRequirementsByListId(listId));
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
        setFormData(prev => ({ ...prev, labels: defaults.labels }));
      }
      if (!overriddenFields.description && defaults.description) {
        setFormData(prev => ({ ...prev, description: defaults.description }));
      }
      if (!overriddenFields.business_owner && defaults.business_owner) {
        setFormData(prev => ({ ...prev, business_owner: defaults.business_owner }));
      }
      if (!overriddenFields.estimator && defaults.estimator) {
        setFormData(prev => ({ ...prev, estimator: defaults.estimator }));
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
      labels: requirement.labels,
      state: requirement.state,
      estimator: requirement.estimator
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
        setFormData(prev => ({ ...prev, labels: defaults.labels }));
      }
      if (field === 'description' && defaults.description) {
        setFormData(prev => ({ ...prev, description: defaults.description }));
      }
    }
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
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna alle Liste
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{list?.name}</h1>
          <p className="text-muted-foreground">
            {list?.owner} • {list?.period} • {requirements.length} requisiti
            {list?.preset_key && (
              <Badge variant="outline" className="ml-2">
                <Sparkles className="h-3 w-3 mr-1" />
                Default intelligenti attivi
              </Badge>
            )}
          </p>
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
              <div>
                <Label htmlFor="title">Titolo</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Titolo del requisito (i default si aggiornano automaticamente)"
                  required
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="description">Descrizione</Label>
                  {!editingRequirement && defaultSources.find(s => s.field === 'description') && (
                    <DefaultPill
                      source={defaultSources.find(s => s.field === 'description')!.source}
                      isOverridden={overriddenFields.description || false}
                      onToggleOverride={() => handleToggleOverride('description')}
                    />
                  )}
                </div>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrizione dettagliata del requisito"
                  rows={4}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="priority">Priorità</Label>
                    {!editingRequirement && defaultSources.find(s => s.field === 'priority') && (
                      <DefaultPill
                        source={defaultSources.find(s => s.field === 'priority')!.source}
                        isOverridden={overriddenFields.priority || false}
                        onToggleOverride={() => handleToggleOverride('priority')}
                      />
                    )}
                  </div>
                  <Select 
                    value={formData.priority} 
                    onValueChange={(value: Requirement['priority']) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Med">Med</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="state">Stato</Label>
                  <Select 
                    value={formData.state} 
                    onValueChange={(value: Requirement['state']) => setFormData({ ...formData, state: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Proposed">Proposed</SelectItem>
                      <SelectItem value="Selected">Selected</SelectItem>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="Done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="business_owner">Business Owner</Label>
                  <Input
                    id="business_owner"
                    value={formData.business_owner}
                    onChange={(e) => setFormData({ ...formData, business_owner: e.target.value })}
                    placeholder="Nome del business owner"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="estimator">Estimator</Label>
                  <Input
                    id="estimator"
                    value={formData.estimator}
                    onChange={(e) => setFormData({ ...formData, estimator: e.target.value })}
                    placeholder="Chi farà la stima"
                    required
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="labels">Labels (separati da virgola)</Label>
                  {!editingRequirement && defaultSources.find(s => s.field === 'labels') && (
                    <DefaultPill
                      source={defaultSources.find(s => s.field === 'labels')!.source}
                      isOverridden={overriddenFields.labels || false}
                      onToggleOverride={() => handleToggleOverride('labels')}
                    />
                  )}
                </div>
                <Input
                  id="labels"
                  value={formData.labels}
                  onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
                  placeholder="es. HR, Notifiche, Critical"
                />
              </div>
              
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

      <div className="grid gap-4">
        {requirements.map((requirement) => {
          const latestEstimate = getLatestEstimate(requirement.req_id);
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
    </div>
  );
}