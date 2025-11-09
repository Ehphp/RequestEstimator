import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, FileDown, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { ListOverviewCard } from './lists/ListOverviewCard';
import { generateTreemapLayout, TreemapNode } from '@/lib/treemap';
import { createMockLists, createMockStats } from '@/lib/mockData';

interface ListsViewProps {
  onSelectList: (listId: string) => void;
}

type ListStats = {
  totalRequirements: number;
  totalDays: number;
};

export function ListsView({ onSelectList }: ListsViewProps) {
  console.log('🔵 ListsView component rendered - TREEMAP VERSION');

  const [lists, setLists] = useState<List[]>([]);
  const [listStats, setListStats] = useState<Record<string, ListStats>>({});
  const [treemapLayout, setTreemapLayout] = useState<TreemapNode[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingList, setEditingList] = useState<List | null>(null);
  const [exportListId, setExportListId] = useState<string | null>(null);

  console.log('🔵 State:', {
    listsCount: lists.length,
    treemapLayoutCount: treemapLayout.length,
    containerSize
  });
  const [formData, setFormData] = useState<{
    name: string;
    owner: string;
    period: string;
    notes: string;
    status: List['status'];
    preset_key: string;
    default_priority?: 'High' | 'Med' | 'Low';
    default_business_owner?: string;
    default_labels?: string;
    default_description?: string;
  }>({
    name: '',
    owner: '',
    period: '',
    notes: '',
    status: 'Draft',
    preset_key: 'none',
    default_priority: undefined,
    default_business_owner: undefined,
    default_labels: undefined,
    default_description: undefined
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

  // Calculate treemap layout when lists or stats change
  useEffect(() => {
    console.log('🟢 TREEMAP EFFECT TRIGGERED', {
      listsLength: lists.length,
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
      statsKeys: Object.keys(listStats)
    });

    if (lists.length === 0 || containerSize.width === 0) {
      console.log('⚠️ Skipping treemap: no lists or zero width');
      setTreemapLayout([]);
      return;
    }

    const treemapItems = lists.map(list => {
      const reqCount = listStats[list.list_id]?.totalRequirements || 0;
      // Use actual count, or minimum of 1 if there are no requirements
      const value = Math.max(reqCount, 1);

      console.log(`📊 Treemap item: ${list.name} - ${reqCount} requirements -> value ${value}`);

      return {
        id: list.list_id,
        value,
        data: list
      };
    });

    console.log('📊 Treemap items:', treemapItems.map(i => ({ id: i.id, value: i.value })));
    console.log('📐 Container size:', containerSize);

    const layout = generateTreemapLayout(
      treemapItems,
      containerSize.width,
      containerSize.height,
      12, // padding
      150 // min size (reduced from 200 for better variety)
    );

    console.log('✅ Treemap layout calculated:', layout.map(l => ({
      id: l.id,
      width: l.width.toFixed(0),
      height: l.height.toFixed(0)
    })));

    setTreemapLayout(layout);
  }, [lists, listStats, containerSize]);  // Measure container size and handle resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Use viewport height minus header and padding for dynamic height
        const availableHeight = Math.max(window.innerHeight - 250, 600);
        setContainerSize({
          width: rect.width,
          height: availableHeight
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Re-measure when lists change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = Math.max(window.innerHeight - 250, 600);
        setContainerSize({
          width: rect.width,
          height: availableHeight
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [lists.length]);

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

  const loadMockData = () => {
    const mockLists = createMockLists();
    const mockStats = createMockStats();

    setLists(mockLists);
    setListStats(mockStats);

    logger.info('Loaded mock data with varying requirement counts:', mockStats);
  };

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const listData: List = {
      list_id: editingList?.list_id || `LIST-${Date.now()}`,
      ...formData,
      preset_key: formData.preset_key === 'none' ? undefined : formData.preset_key as List['preset_key'],
      created_on: editingList?.created_on || new Date().toISOString(),
      created_by: editingList?.created_by || currentUser
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
      owner: defaults.owner ?? '',
      period: defaults.period ?? '',
      notes: defaults.notes ?? '',
      status: defaults.status ?? 'Draft',
      preset_key: 'none',
      default_priority: undefined,
      default_business_owner: undefined,
      default_labels: undefined,
      default_description: undefined
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
      owner: list.owner ?? '',
      period: list.period ?? '',
      notes: list.notes ?? '',
      status: list.status,
      preset_key: list.preset_key || 'none',
      default_priority: list.default_priority,
      default_business_owner: list.default_business_owner,
      default_labels: list.default_labels,
      default_description: list.default_description
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

  console.log('🎨 RENDERING with treemapLayout.length:', treemapLayout.length);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Liste di Requisiti [TREEMAP MODE]</h1>
            <p className="text-muted-foreground">Gestisci le tue liste di requisiti stimati con default intelligenti</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={loadMockData}
              size="sm"
            >
              🎲 Carica Dati Test
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button onClick={handleCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuova Lista
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

                  {/* NEW SECTION: Defaults per Requisiti */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <span className="text-primary">⚙️</span>
                      Defaults per Nuovi Requisiti (Opzionale)
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Imposta valori predefiniti che verranno applicati automaticamente ai nuovi requisiti di questa lista.
                      Lasciando vuoto un campo, verrà usata l'inferenza automatica da keywords.
                    </p>

                    <div className="space-y-3 bg-muted/30 p-3 rounded-lg">
                      <div>
                        <Label htmlFor="default_priority" className="text-xs">
                          Priorità Default
                        </Label>
                        <Select
                          value={formData.default_priority || 'none'}
                          onValueChange={(value) => setFormData({
                            ...formData,
                            default_priority: value === 'none' ? undefined : value as 'High' | 'Med' | 'Low'
                          })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Inferisci da keywords" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">🔍 Inferisci da keywords</span>
                            </SelectItem>
                            <SelectItem value="High">🔴 Alta</SelectItem>
                            <SelectItem value="Med">🟡 Media</SelectItem>
                            <SelectItem value="Low">🟢 Bassa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="default_business_owner" className="text-xs">
                          Business Owner Default
                        </Label>
                        <Input
                          id="default_business_owner"
                          value={formData.default_business_owner || ''}
                          onChange={(e) => setFormData({ ...formData, default_business_owner: e.target.value || undefined })}
                          placeholder="Lascia vuoto per usare Owner della lista"
                          className="h-9"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Se vuoto, verrà usato l'Owner della lista: {formData.owner || 'non impostato'}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="default_labels" className="text-xs">
                          Labels Default
                        </Label>
                        <Input
                          id="default_labels"
                          value={formData.default_labels || ''}
                          onChange={(e) => setFormData({ ...formData, default_labels: e.target.value || undefined })}
                          placeholder="es. HR,Notifiche,Critical (o lascia vuoto per inferenza)"
                          className="h-9"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Se vuoto, le etichette verranno inferite dal titolo del requisito
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="default_description" className="text-xs">
                          Template Descrizione
                        </Label>
                        <Textarea
                          id="default_description"
                          value={formData.default_description || ''}
                          onChange={(e) => setFormData({ ...formData, default_description: e.target.value || undefined })}
                          placeholder="Template base per descrizioni (o lascia vuoto per preset)"
                          rows={2}
                          className="text-sm"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Se vuoto e hai un preset, verrà usato il template del preset
                        </p>
                      </div>
                    </div>
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
        </div>

        <div
          ref={containerRef}
          className="relative bg-gradient-to-br from-background to-muted/20"
          style={{
            minHeight: '600px',
            height: containerSize.height > 0 ? `${containerSize.height}px` : '600px'
          }}
        >
          {treemapLayout.length === 0 && lists.length > 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-lg font-semibold">Calcolo layout treemap...</p>
                <p className="text-sm text-muted-foreground">Container: {containerSize.width}×{containerSize.height}</p>
              </div>
            </div>
          )}
          {treemapLayout.map((node) => {
            const list = node.data as List;
            const stats = listStats[list.list_id] || { totalRequirements: 0, totalDays: 0 };
            const preset = list.preset_key ? presets.find(p => p.preset_key === list.preset_key) : null;

            return (
              <div
                key={list.list_id}
                className="absolute transition-all duration-300 ease-in-out"
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.width}px`,
                  height: `${node.height}px`,
                }}
              >
                <ListOverviewCard
                  title={
                    <div className="flex items-baseline gap-2">
                      <span className="line-clamp-2">{list.name}</span>
                      <Badge
                        variant="secondary"
                        className="text-xs shrink-0 bg-primary/10 text-primary font-bold"
                      >
                        {stats.totalRequirements}
                      </Badge>
                    </div>
                  }
                  className="h-full hover:shadow-xl hover:scale-[1.02] transition-all hover:z-10 border-2"
                  contentClassName="flex flex-col justify-between h-full"
                  headerContent={
                    <>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        Owner: {list.owner} • {list.period}
                      </p>
                      {preset && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          Preset: {preset.name}
                        </Badge>
                      )}
                      {/* Debug info - temporary */}
                      <p className="text-xs text-muted-foreground mt-1">
                        Size: {node.width.toFixed(0)}×{node.height.toFixed(0)}px
                      </p>
                    </>
                  }
                  rightElement={
                    <Badge className={getStatusColor(list.status)}>
                      {list.status}
                    </Badge>
                  }
                >
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Requisiti</p>
                        <p className="text-2xl font-bold text-primary">{stats.totalRequirements}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Giorni Totali</p>
                        <p className="text-2xl font-bold text-primary">{stats.totalDays.toFixed(1)}</p>
                      </div>
                    </div>

                    {list.notes && node.height > 250 && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {list.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 mt-auto">
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
                </ListOverviewCard>
              </div>
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
