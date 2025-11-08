import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, FileDown, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { logger } from '@/lib/logger';
import { List, Requirement } from '../types';
import { getLists, saveList, deleteList, getRequirementsByListId, getLatestEstimates } from '../lib/storage';
import { getListDefaults } from '../lib/defaults';
import { presets } from '../data/presets';
import { ExportDialog } from './ExportDialog';
import { DefaultPill } from './DefaultPill';

interface ListsViewProps {
  onSelectList: (listId: string) => void;
}

type ListStats = {
  totalRequirements: number;
  totalDays: number;
};

export function ListsView({ onSelectList }: ListsViewProps) {
  const [lists, setLists] = useState<List[]>([]);
  const [listStats, setListStats] = useState<Record<string, ListStats>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingList, setEditingList] = useState<List | null>(null);
  const [exportListId, setExportListId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    owner: '',
    period: '',
    notes: '',
    status: 'Draft' as const,
    preset_key: 'none' as string
  });
  const [defaultSources, setDefaultSources] = useState<Record<string, string>>({});
  const [overriddenFields, setOverriddenFields] = useState<Record<string, boolean>>({});
  const isMountedRef = useRef(true);

  const currentUser = 'current.user@example.com'; // In real app, get from auth

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadStatsForLists = useCallback(async (listsToProcess: List[]) => {
    if (listsToProcess.length === 0) {
      if (isMountedRef.current) {
        setListStats({});
      }
      return;
    }

    try {
      const requirementsByList: Array<{ listId: string; requirements: Requirement[] }> = await Promise.all(
        listsToProcess.map(async (list) => {
          const requirements = await getRequirementsByListId(list.list_id);
          return { listId: list.list_id, requirements };
        })
      );

      const allReqIds = requirementsByList.flatMap((entry) =>
        entry.requirements.map((req) => req.req_id)
      );

      const latestEstimates = allReqIds.length > 0
        ? await getLatestEstimates(allReqIds)
        : {};

      const statsMap: Record<string, ListStats> = {};
      requirementsByList.forEach(({ listId, requirements }) => {
        const totalRequirements = requirements.length;
        const totalDays = requirements.reduce((sum, requirement) => {
          const estimate = latestEstimates[requirement.req_id];
          return sum + (estimate?.total_days || 0);
        }, 0);

        statsMap[listId] = {
          totalRequirements,
          totalDays
        };
      });

      if (isMountedRef.current) {
        setListStats(statsMap);
      }
    } catch (error) {
      logger.error('Errore nel calcolare le statistiche delle liste', error);
    }
  }, []);

  const loadLists = useCallback(async () => {
    try {
      const fetchedLists = await getLists();
      if (!isMountedRef.current) {
        return;
      }

      setLists(fetchedLists);
      await loadStatsForLists(fetchedLists);
    } catch (error) {
      logger.error('Errore nel caricare le liste', error);
    }
  }, [loadStatsForLists]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const listData: List = {
      list_id: editingList?.list_id || `LIST-${Date.now()}`,
      ...formData,
      preset_key: formData.preset_key === 'none' ? undefined : formData.preset_key as List['preset_key'],
      created_on: editingList?.created_on || new Date().toISOString()
    };

    try {
      await saveList(listData);
      await loadLists();
      resetForm();
    } catch (error) {
      logger.error('Errore nel salvataggio della lista', error);
    }
  };

  const resetForm = () => {
    const defaults = getListDefaults(currentUser);
    setFormData({
      name: '',
      owner: defaults.owner || '',
      period: defaults.period || '',
      notes: defaults.notes || '',
      status: defaults.status || 'Draft',
      preset_key: 'none'
    });
    setDefaultSources({
      owner: 'Current User',
      period: 'Current Quarter',
      status: 'Default'
    });
    setOverriddenFields({});
    setEditingList(null);
    setShowCreateDialog(false);
  };

  const handleCreateNew = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const handleEdit = (list: List) => {
    setEditingList(list);
    setFormData({
      name: list.name,
      owner: list.owner,
      period: list.period,
      notes: list.notes,
      status: list.status,
      preset_key: list.preset_key || 'none'
    });
    // When editing, all fields are considered overridden
    setOverriddenFields({
      owner: true,
      period: true,
      status: true
    });
    setDefaultSources({});
    setShowCreateDialog(true);
  };

  const handleDelete = async (listId: string) => {
    if (confirm('Sei sicuro di voler eliminare questa lista e tutti i suoi requisiti?')) {
      try {
        await deleteList(listId);
        await loadLists();
      } catch (error) {
        logger.error('Errore nell\'eliminazione della lista', error);
      }
    }
  };

  const handleToggleOverride = (field: string) => {
    setOverriddenFields(prev => ({
      ...prev,
      [field]: !prev[field]
    }));

    if (!overriddenFields[field]) {
      // If switching to overridden, keep current value
      return;
    }

    // If switching back to default, reset to default value
    const defaults = getListDefaults(currentUser);
    if (field === 'owner') setFormData(prev => ({ ...prev, owner: defaults.owner || '' }));
    if (field === 'period') setFormData(prev => ({ ...prev, period: defaults.period || '' }));
    if (field === 'status') setFormData(prev => ({ ...prev, status: defaults.status || 'Draft' }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'In Review': return 'bg-yellow-100 text-yellow-800';
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Archived': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Liste di Requisiti</h1>
            <p className="text-muted-foreground">Gestisci le tue liste di requisiti stimati con default intelligenti</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Nuova Lista
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingList ? 'Modifica Lista' : 'Crea Nuova Lista'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome Lista</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="es. HR - Notifiche Q4"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="owner">Owner</Label>
                    {!editingList && defaultSources.owner && (
                      <DefaultPill
                        source={defaultSources.owner}
                        isOverridden={overriddenFields.owner || false}
                        onToggleOverride={() => handleToggleOverride('owner')}
                      />
                    )}
                  </div>
                  <Input
                    id="owner"
                    value={formData.owner}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    placeholder="Nome del responsabile"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="period">Periodo</Label>
                    {!editingList && defaultSources.period && (
                      <DefaultPill
                        source={defaultSources.period}
                        isOverridden={overriddenFields.period || false}
                        onToggleOverride={() => handleToggleOverride('period')}
                      />
                    )}
                  </div>
                  <Input
                    id="period"
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                    placeholder="es. Q4 2024"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="preset">Preset (Opzionale)</Label>
                  <Select
                    value={formData.preset_key}
                    onValueChange={(value) => setFormData({ ...formData, preset_key: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona preset per default intelligenti" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessun preset</SelectItem>
                      {presets.map((preset) => (
                        <SelectItem key={preset.preset_key} value={preset.preset_key}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.preset_key !== 'none' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {presets.find(p => p.preset_key === formData.preset_key)?.description_template}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="status">Status</Label>
                    {!editingList && defaultSources.status && (
                      <DefaultPill
                        source={defaultSources.status}
                        isOverridden={overriddenFields.status || false}
                        onToggleOverride={() => handleToggleOverride('status')}
                      />
                    )}
                  </div>
                  <Select
                    value={formData.status}
                    onValueChange={(value: List['status']) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="In Review">In Review</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">Note</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Note aggiuntive..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingList ? 'Aggiorna' : 'Crea'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Annulla
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => {
            const stats = listStats[list.list_id] || { totalRequirements: 0, totalDays: 0 };
            const preset = list.preset_key ? presets.find(p => p.preset_key === list.preset_key) : null;

            return (
              <Card key={list.list_id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{list.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Owner: {list.owner} • {list.period}
                      </p>
                      {preset && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          Preset: {preset.name}
                        </Badge>
                      )}
                    </div>
                    <Badge className={getStatusColor(list.status)}>
                      {list.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Requisiti</p>
                      <p className="font-semibold">{stats.totalRequirements}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Giorni Totali</p>
                      <p className="font-semibold">{stats.totalDays.toFixed(1)}</p>
                    </div>
                  </div>

                  {list.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {list.notes}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSelectList(list.list_id)}
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Visualizza
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExportListId(list.list_id)}
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(list)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(list.list_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {lists.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Nessuna lista creata ancora</p>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Crea la tua prima lista con default intelligenti
            </Button>
          </div>
        )}

        {exportListId && (
          <ExportDialog
            listId={exportListId}
            onClose={() => setExportListId(null)}
          />
        )}
      </div>
    </div>
  );
}