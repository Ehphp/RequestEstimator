import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, FileText, AlertCircle, Loader2, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSearchParams } from 'react-router-dom';
import { EmptyListsSidebar } from '@/components/EmptyListsSidebar';
import { DefaultPill } from '@/components/DefaultPill';
import { List, Requirement } from '../types';
import {
  getLists,
  getRequirementsByListId,
  generateId,
  saveList,
  deleteList,
} from '../lib/storage';
import { logger } from '@/lib/logger';
import { getListDefaults } from '../lib/defaults';
import { presets } from '@/data/presets';
import { RequirementsList } from '../components/RequirementsList';
import { RequirementDetailView } from '../components/RequirementDetailView';
import { TreemapApex, TECHNOLOGY_FALLBACK_LABEL } from '../components/TreemapApex';
import { getTechnologyColor } from '../lib/technology-colors';
import { getLatestEstimates } from '@/lib/storage';

export default function Index() {
  logger.debug('🔵 Index component rendered - TREEMAP VERSION');

  const [lists, setLists] = useState<List[]>([]);
  const [listStats, setListStats] = useState<Record<string, { totalRequirements: number; totalDays: number }>>({});
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [remeasureTrigger, setRemeasureTrigger] = useState(0); // Trigger for forced remeasurement
  const containerRef = useRef<HTMLDivElement>(null);
  const latestListIdRef = useRef<string | null>(null);
  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listPendingDeletion, setListPendingDeletion] = useState<List | null>(null);
  const [deleteMetadataLoading, setDeleteMetadataLoading] = useState(false);
  const [pendingRequirementCount, setPendingRequirementCount] = useState<number | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const listIdParam = searchParams.get('listId');
  const reqIdParam = searchParams.get('reqId');
  const currentUser = 'current.user@example.com'; // TODO: wire to auth

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSavingList, setIsSavingList] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    owner: string;
    period: string;
    notes: string;
    technology: string;
    status: List['status'];
    preset_key: string;
    default_priority?: 'High' | 'Med' | 'Low';
    default_business_owner?: string;
    default_labels?: string;
    default_description?: string;
  }>(() => {
    const defaults = getListDefaults(currentUser);
    return {
      name: '',
      owner: defaults.owner ?? '',
      period: defaults.period ?? '',
      notes: defaults.notes ?? '',
      technology: defaults.technology ?? 'Power Platform',
      status: (defaults.status as List['status']) ?? 'Active',
      preset_key: 'none',
      default_priority: undefined,
      default_business_owner: undefined,
      default_labels: undefined,
      default_description: undefined
    };
  });
  const [defaultSources, setDefaultSources] = useState<Record<string, string>>({
    owner: 'Current User',
    period: 'Current Quarter',
    status: 'Default'
  });
  const [overriddenFields, setOverriddenFields] = useState<Record<string, boolean>>({});
  const [showAutoFields, setShowAutoFields] = useState(false);
  const resetForm = useCallback(() => {
    const defaults = getListDefaults(currentUser);
    setFormData({
      name: '',
      owner: defaults.owner ?? '',
      period: defaults.period ?? '',
      notes: defaults.notes ?? '',
      technology: defaults.technology ?? 'Power Platform',
      status: (defaults.status as List['status']) ?? 'Active',
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
  }, [currentUser]);

  const technologyLegend = useMemo(() => {
    const seen = new Set<string>();
    const legend: Array<{ label: string; color: string }> = [];

    lists.forEach((list) => {
      const stats = listStats[list.list_id];
      if (!stats || stats.totalRequirements === 0 || stats.totalDays === 0) {
        return;
      }

      const tech = (list.technology?.trim() || TECHNOLOGY_FALLBACK_LABEL);
      if (seen.has(tech)) {
        return;
      }
      seen.add(tech);
      legend.push({
        label: tech,
        color: getTechnologyColor(tech)
      });
    });

    return legend;
  }, [lists, listStats]);

  const handleToggleOverride = (field: 'owner' | 'period' | 'status') => {
    setOverriddenFields(prev => ({
      ...prev,
      [field]: !prev[field]
    }));

    if (!overriddenFields[field]) {
      return;
    }

    const defaults = getListDefaults(currentUser);
    if (field === 'owner') {
      setFormData(prev => ({ ...prev, owner: defaults.owner ?? '' }));
    } else if (field === 'period') {
      setFormData(prev => ({ ...prev, period: defaults.period ?? '' }));
    } else if (field === 'status') {
      setFormData(prev => ({ ...prev, status: (defaults.status as List['status']) ?? 'Active' }));
    }
  };

  logger.debug('🔵 Index State:', {
    listsCount: lists.length,
    containerSize,
    selectedList: selectedList?.name
  });

  const updateSearchParams = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams);
      mutator(params);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    loadLists();
  }, []);

  useEffect(() => {
    if (!listIdParam) {
      if (selectedList) {
        setSelectedList(null);
        setRequirements([]);
      }
      return;
    }

    const matchedList = lists.find((list) => list.list_id === listIdParam);

    if (matchedList) {
      if (!selectedList || selectedList.list_id !== matchedList.list_id) {
        setSelectedList(matchedList);
      }
    } else if (lists.length > 0) {
      updateSearchParams((params) => {
        params.delete('listId');
        params.delete('reqId');
      });
    }
  }, [listIdParam, lists, selectedList, updateSearchParams]);

  const loadLists = async (options?: { autoSelectFirst?: boolean }): Promise<List[]> => {
    const { autoSelectFirst = false } = options || {};
    try {
      setLoading(true);
      setError(null);

      const listsData = await getLists();
      setLists(listsData);

      // Load stats for all lists
      if (listsData.length > 0) {
        const statsPromises = listsData.map(async (list) => {
          const reqs = await getRequirementsByListId(list.list_id);
          const reqIds = reqs.map(r => r.req_id);
          const estimates = reqIds.length > 0 ? await getLatestEstimates(reqIds) : {};
          const totalDays = reqs.reduce((sum, req) => sum + (estimates[req.req_id]?.total_days || 0), 0);
          return {
            listId: list.list_id,
            stats: { totalRequirements: reqs.length, totalDays }
          };
        });
        const results = await Promise.all(statsPromises);
        const statsMap: Record<string, { totalRequirements: number; totalDays: number }> = {};
        results.forEach(({ listId, stats }) => {
          statsMap[listId] = stats;
        });
        setListStats(statsMap);
        logger.debug('📊 Stats loaded:', statsMap);
      }

      if (autoSelectFirst && listsData.length > 0 && !selectedList) {
        setSelectedList(listsData[0]);
      }

      return listsData;
    } catch (err) {
      logger.error('Error loading lists:', err);
      setError('Errore nel caricamento delle liste. Verifica la connessione a Supabase.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    latestListIdRef.current = selectedList?.list_id ?? null;
  }, [selectedList]);

  const loadRequirements = async (listId: string, options?: { reset?: boolean }) => {
    const { reset = false } = options || {};
    try {
      setError(null);
      if (reset) {
        setRequirements([]);
      }
      const requirementsData = await getRequirementsByListId(listId);
      if (latestListIdRef.current !== listId) {
        return;
      }
      setRequirements(requirementsData);
    } catch (err) {
      logger.error('Error loading requirements:', err);
      if (latestListIdRef.current === listId) {
        setError('Errore nel caricamento dei requisiti.');
      }
    }
  };

  useEffect(() => {
    if (selectedList) {
      loadRequirements(selectedList.list_id, { reset: true });
    }
  }, [selectedList]);

  // Measure container size with throttling and exponential backoff retry
  useEffect(() => {
    if (selectedList) return; // Only measure when showing lists

    let rafId: number | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let retryTimeoutId: NodeJS.Timeout | null = null;
    let retryAttempt = 0;
    const MAX_RETRIES = 5;
    const retryDelays = [100, 150, 225, 337, 506]; // Exponential backoff

    const scheduleRetry = () => {
      if (retryAttempt < MAX_RETRIES) {
        const delay = retryDelays[retryAttempt];
        logger.debug(`🔄 Retry ${retryAttempt + 1}/${MAX_RETRIES} in ${delay}ms...`);
        retryTimeoutId = setTimeout(() => {
          retryAttempt++;
          updateSize();
        }, delay);
      } else {
        // Last resort: use window width
        const fallbackWidth = Math.max(window.innerWidth - 64, 800); // Subtract padding, min 800
        const fallbackHeight = Math.max(window.innerHeight - 200, 600);
        logger.warn('⚠️ Max retries reached, using fallback dimensions:', fallbackWidth, fallbackHeight);
        setContainerSize({ width: fallbackWidth, height: fallbackHeight });
      }
    };

    const updateSize = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        if (!containerRef.current) {
          logger.warn('⚠️ containerRef.current is null');
          scheduleRetry();
          rafId = null;
          return;
        }

        const parent = containerRef.current.parentElement;
        const rect = containerRef.current.getBoundingClientRect();
        const width = rect.width > 0 ? rect.width : (parent?.getBoundingClientRect().width || 0);

        logger.debug('📐 Measuring container:', {
          rectWidth: rect.width,
          parentWidth: parent?.getBoundingClientRect().width,
          finalWidth: width,
          retryAttempt
        });

        // Calculate available viewport height (from top of container to bottom of viewport - footer space)
        const containerTop = rect.top || 0;
        const viewportHeight = window.innerHeight;
        const footerSpace = 32; // Bottom padding
        const availableHeight = Math.max(viewportHeight - containerTop - footerSpace, 500);

        if (width > 0) {
          setContainerSize({ width, height: availableHeight });
          logger.debug('✅ Container size updated:', width, availableHeight);
        } else {
          logger.warn('⚠️ Container width is still 0, scheduling retry...');
          scheduleRetry();
        }

        rafId = null;
      });
    };

    // Throttle resize events (max 10fps)
    const handleResize = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        retryAttempt = 0; // Reset retry counter on manual resize
        updateSize();
      }, 100);
    };

    // Initial measurement
    logger.debug('🎬 Starting initial measurement...');
    updateSize();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (retryTimeoutId !== null) clearTimeout(retryTimeoutId);
    };
  }, [selectedList, remeasureTrigger]);

  // Trigger remeasurement when lists change
  useEffect(() => {
    if (!selectedList && lists.length > 0) {
      // Delay to allow DOM to update
      const timer = setTimeout(() => {
        setRemeasureTrigger(prev => prev + 1);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [lists.length, selectedList]);

  useEffect(() => {
    if (!reqIdParam) {
      if (selectedRequirement) {
        setSelectedRequirement(null);
      }
      return;
    }

    if (requirements.length === 0) {
      return;
    }

    const matchedRequirement = requirements.find((requirement) => requirement.req_id === reqIdParam);

    if (matchedRequirement) {
      if (!selectedRequirement || selectedRequirement.req_id !== matchedRequirement.req_id) {
        setSelectedRequirement(matchedRequirement);
      }
    } else {
      updateSearchParams((params) => {
        params.delete('reqId');
      });
    }
  }, [reqIdParam, requirements, selectedRequirement, updateSearchParams]);

  const handleCreateNewList = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const handleSubmitNewList = async (e: React.FormEvent) => {
    e.preventDefault();
    const listToSave: List = {
      list_id: generateId('LIST'),
      name: formData.name.trim(),
      owner: formData.owner,
      period: formData.period,
      notes: formData.notes,
      technology: formData.technology.trim(),
      status: formData.status,
      preset_key: formData.preset_key === 'none' ? undefined : (formData.preset_key as List['preset_key']),
      default_priority: formData.default_priority,
      default_business_owner: formData.default_business_owner,
      default_labels: formData.default_labels,
      default_description: formData.default_description,
      created_on: new Date().toISOString(),
      created_by: currentUser
    };

    try {
      setIsSavingList(true);
      await saveList(listToSave);
      const updatedLists = await loadLists();
      const savedList = updatedLists.find(list => list.list_id === listToSave.list_id) ?? listToSave;
      setSelectedList(savedList);
      updateSearchParams((params) => {
        params.set('listId', savedList.list_id);
        params.delete('reqId');
        params.delete('tab');
      });
      setShowCreateDialog(false);
      resetForm();
    } catch (err) {
      logger.error('Error creating new list:', err);
      setError('Errore nella creazione della nuova lista.');
    } finally {
      setIsSavingList(false);
    }
  };

  const handleSelectList = (list: List) => {
    setSelectedList(list);
    setSelectedRequirement(null);
    updateSearchParams((params) => {
      params.set('listId', list.list_id);
      params.delete('reqId');
      params.delete('tab');
    });
  };

  const handleSelectRequirement = (requirement: Requirement) => {
    logger.info('📍 Navigating to requirement estimate:', {
      req_id: requirement.req_id,
      title: requirement.title
    });
    setSelectedRequirement(requirement);
    updateSearchParams((params) => {
      params.set('reqId', requirement.req_id);
    });
  };

  const handleBackToRequirements = () => {
    setSelectedRequirement(null);
    updateSearchParams((params) => {
      params.delete('reqId');
    });
    // Reload requirements to get updated data
    if (selectedList) {
      loadRequirements(selectedList.list_id);
    }
  };

  const handleListUpdated = (updatedList: List) => {
    setLists((prev) => prev.map((list) => (list.list_id === updatedList.list_id ? updatedList : list)));
    setSelectedList(updatedList);
  };

  const handleBackToLists = () => {
    setSelectedList(null);
    setSelectedRequirement(null);
    setRequirements([]);
    updateSearchParams((params) => {
      params.delete('listId');
      params.delete('reqId');
      params.delete('tab');
    });
  };

  const openDeleteDialog = async (list: List) => {
    setListPendingDeletion(list);
    setDeleteDialogOpen(true);
    setPendingRequirementCount(null);
    setDeleteMetadataLoading(true);
    try {
      const requirements = await getRequirementsByListId(list.list_id);
      setPendingRequirementCount(requirements.length);
    } catch (err) {
      logger.error('Error counting requirements for list:', err);
      setError('Impossibile recuperare il numero di requisiti associati alla lista selezionata.');
    } finally {
      setDeleteMetadataLoading(false);
    }
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setListPendingDeletion(null);
    setPendingRequirementCount(null);
    setDeleteMetadataLoading(false);
    setDeleteInProgress(false);
  };

  const handleConfirmDelete = async () => {
    if (!listPendingDeletion) return;
    const deletingSelectedList = selectedList?.list_id === listPendingDeletion.list_id;
    try {
      setDeleteInProgress(true);
      setError(null);
      await deleteList(listPendingDeletion.list_id);
      if (deletingSelectedList) {
        setSelectedRequirement(null);
        setSelectedList(null);
        setRequirements([]);
        updateSearchParams((params) => {
          params.delete('listId');
          params.delete('reqId');
          params.delete('tab');
        });
      }
      await loadLists({ autoSelectFirst: !deletingSelectedList });
      closeDeleteDialog();
    } catch (err) {
      logger.error('Error deleting list:', err);
      setError('Errore durante l\'eliminazione della lista selezionata.');
    } finally {
      setDeleteInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-black dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 dark:text-gray-400" />
          <p className="text-lg text-gray-600 dark:text-gray-400">Caricamento dati da Supabase...</p>
        </div>
      </div>
    );
  }

  if (selectedRequirement && selectedList) {
    return (
      <RequirementDetailView
        requirement={selectedRequirement}
        list={selectedList}
        onBack={handleBackToRequirements}
      />
    );
  }

  if (selectedList) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black p-6">
        <RequirementsList
          list={selectedList}
          requirements={requirements}
          onBack={handleBackToLists}
          onSelectRequirement={handleSelectRequirement}
          onRequirementsChange={() => loadRequirements(selectedList.list_id)}
          onListUpdated={handleListUpdated}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-black dark:via-gray-900 dark:to-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-50">Sistema di Stima Requisiti</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Gestisci le tue liste di requisiti e crea stime accurate</p>
            <Badge variant="outline" className="mt-2 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Connesso a Supabase
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={handleCreateNewList} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Nuova Lista
            </Button>
          </div>
        </div>

        <Dialog
          open={showCreateDialog}
          onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) {
              resetForm();
            }
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crea Nuova Lista</DialogTitle>
              <DialogDescription>
                Compila i campi principali, puoi perfezionare i dettagli in un secondo momento.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitNewList} className="space-y-6">
              <section className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="list-name">Nome Lista</Label>
                  <Input
                    id="list-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="es. HR - Notifiche Q4"
                    required
                    className="h-10 sm:h-9"
                  />
                  <p className="text-xs text-muted-foreground">Nome leggibile dal business e dalle dashboard.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="list-preset">Preset (opzionale)</Label>
                    <Select
                      value={formData.preset_key}
                      onValueChange={(value) => setFormData({ ...formData, preset_key: value })}
                    >
                      <SelectTrigger className="h-10 sm:h-9">
                        <SelectValue placeholder="Suggerimenti automatici" />
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
                      <p className="text-[11px] text-muted-foreground">
                        {presets.find((p) => p.preset_key === formData.preset_key)?.description_template}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="list-technology">Tecnologia</Label>
                    <Input
                      id="list-technology"
                      value={formData.technology}
                      onChange={(e) => setFormData({ ...formData, technology: e.target.value })}
                      placeholder="es. Power Platform - Canvas Apps"
                      required
                      className="h-10 sm:h-9"
                    />
                    <p className="text-xs text-muted-foreground">
                      Indica la piattaforma o lo stack principale usato dalla lista.
                    </p>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="list-notes">Note</Label>
                    <Textarea
                      id="list-notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Note sintetiche per chi usera la lista"
                      rows={3}
                      className="text-sm min-h-[88px]"
                    />
                    <p className="text-xs text-muted-foreground">Visibili solo all'interno della scheda lista.</p>
                  </div>
                </div>
              </section>

              <div className="rounded-lg border border-dashed bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium text-muted-foreground">Campi auto-compilati</span>
                    <span>Owner, periodo e status derivano dal profilo.</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setShowAutoFields((prev) => !prev)}
                  >
                    <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
                    {showAutoFields ? 'Nascondi' : 'Modifica'}
                  </Button>
                </div>
                {showAutoFields && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="list-owner">Owner</Label>
                        {defaultSources.owner && (
                          <DefaultPill
                            source={defaultSources.owner}
                            isOverridden={overriddenFields.owner || false}
                            onToggleOverride={() => handleToggleOverride('owner')}
                          />
                        )}
                      </div>
                      <Input
                        id="list-owner"
                        value={formData.owner}
                        onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                        placeholder="Nome referente"
                        required
                        className="h-10 sm:h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="list-period">Periodo</Label>
                        {defaultSources.period && (
                          <DefaultPill
                            source={defaultSources.period}
                            isOverridden={overriddenFields.period || false}
                            onToggleOverride={() => handleToggleOverride('period')}
                          />
                        )}
                      </div>
                      <Input
                        id="list-period"
                        value={formData.period}
                        onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                        placeholder="es. Q4 2024"
                        required
                        className="h-10 sm:h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="list-status">Status</Label>
                        {defaultSources.status && (
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
                        <SelectTrigger className="h-10 sm:h-9">
                          <SelectValue placeholder="Stato della lista" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Draft">Draft</SelectItem>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Solo le liste attive alimentano la treemap home.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <section className="rounded-xl border bg-background/80 p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold">Valori ereditati dai requisiti</p>
                  <p className="text-xs text-muted-foreground">
                    Impostali se vuoi propagare business owner, labels o descrizioni sui nuovi requisiti (la priorita resta per-singolo requisito).
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="default-business-owner" className="text-xs">
                      Business owner default
                    </Label>
                    <Input
                      id="default-business-owner"
                      value={formData.default_business_owner || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          default_business_owner: e.target.value || undefined
                        })
                      }
                      placeholder="Lascia vuoto per usare l'owner della lista"
                      className="h-9"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Se vuoto, verra usato l'owner della lista ({formData.owner || 'non impostato'}).
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="default-labels" className="text-xs">
                      Labels default
                    </Label>
                    <Input
                      id="default-labels"
                      value={formData.default_labels || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          default_labels: e.target.value || undefined
                        })
                      }
                      placeholder="es. HR,Notifiche,Critical"
                      className="h-9"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Se vuoto, le etichette verranno inferite dal titolo del requisito.
                    </p>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="default-description" className="text-xs">
                      Template descrizione
                    </Label>
                    <Textarea
                      id="default-description"
                      value={formData.default_description || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          default_description: e.target.value || undefined
                        })
                      }
                      placeholder="Template base per descrizioni"
                      rows={2}
                      className="text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Se vuoto e il preset selezionato lo prevede, verra usato il template del preset.
                    </p>
                  </div>
                </div>
              </section>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Potrai aggiornare questi dati in seguito dalla scheda lista.
                </p>
                <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row">
                  <Button type="submit" className="w-full sm:w-auto min-w-[150px]" disabled={isSavingList}>
                    {isSavingList && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Crea Lista
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      resetForm();
                      setShowCreateDialog(false);
                    }}
                  >
                    Annulla
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {lists.length === 0 ? (
          <Card className="text-center py-12 dark:bg-gray-900/50 dark:border-gray-800">
            <CardContent>
              <FileText className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Nessuna lista trovata</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Crea la tua prima lista di requisiti per iniziare a gestire le stime
              </p>
              <Button onClick={handleCreateNewList}>
                <Plus className="h-4 w-4 mr-2" />
                Crea Prima Lista
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-6 h-[calc(100vh-200px)]">
            {/* Empty Lists Sidebar */}
            <EmptyListsSidebar
              emptyLists={lists.filter(list => {
                const stats = listStats[list.list_id] || { totalRequirements: 0, totalDays: 0 };
                return stats.totalRequirements === 0 || stats.totalDays === 0;
              })}
              listStats={listStats}
              onSelectList={handleSelectList}
              onDeleteList={openDeleteDialog}
            />

            {/* Treemap Container - ApexCharts Version */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold">Distribuzione effort liste</p>
                  <p className="text-xs text-muted-foreground">
                    Le aree rappresentano i giorni stimati totali; clicca per aprire la lista
                  </p>
                </div>
                {technologyLegend.length > 0 && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {technologyLegend.map(({ label, color }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 min-h-0">
                <TreemapApex
                  lists={lists}
                  listStats={listStats}
                  onSelectList={handleSelectList}
                  containerHeight={window.innerHeight - 200}
                  showLegend={false}
                />
              </div>
            </div>
          </div>
        )}

        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            if (!open && deleteDialogOpen && !deleteInProgress) {
              closeDeleteDialog();
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Elimina lista</AlertDialogTitle>
              <AlertDialogDescription>
                {listPendingDeletion ? (
                  deleteMetadataLoading ? (
                    'Calcolo del numero di requisiti associati...'
                  ) : (
                    <>
                      La lista{' '}
                      <span className="font-semibold text-foreground">
                        {listPendingDeletion.name}
                      </span>{' '}
                      contiene{' '}
                      <span className="font-semibold text-red-600">
                        {pendingRequirementCount ?? 0}{' '}
                        {pendingRequirementCount === 1 ? 'requisito' : 'requisiti'}
                      </span>
                      . Verranno eliminati anche i dati di stima collegati. L’operazione è irreversibile.
                    </>
                  )
                ) : (
                  'Seleziona una lista da eliminare.'
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteInProgress} onClick={closeDeleteDialog}>
                Annulla
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={deleteInProgress || deleteMetadataLoading || !listPendingDeletion}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deleteInProgress ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Eliminazione...
                  </span>
                ) : (
                  'Elimina definitivamente'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div >
  );
}

