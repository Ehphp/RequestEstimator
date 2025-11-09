import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, FileText, Calendar, User, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { ListOverviewCard } from '@/components/lists/ListOverviewCard';
import { List, Requirement } from '../types';
import {
  getLists,
  getRequirementsByListId,
  generateId,
  saveList,
  deleteList,
} from '../lib/storage';
import { logger } from '@/lib/logger';
import { RequirementsList } from '../components/RequirementsList';
import { EstimateEditor } from '../components/EstimateEditor';
import { generateTreemapLayout, TreemapNode, getCardSizeVariant } from '@/lib/treemap';
import { getLatestEstimates } from '@/lib/storage';

export default function Index() {
  console.log('🔵 Index component rendered - TREEMAP VERSION');

  const [lists, setLists] = useState<List[]>([]);
  const [treemapLayout, setTreemapLayout] = useState<TreemapNode[]>([]);
  const [listStats, setListStats] = useState<Record<string, { totalRequirements: number; totalDays: number }>>({});
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
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

  console.log('🔵 Index State:', {
    listsCount: lists.length,
    treemapLayoutCount: treemapLayout.length,
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
        console.log('📊 Stats loaded:', statsMap);
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

  // Calculate treemap layout
  useEffect(() => {
    console.log('🟢 TREEMAP EFFECT', { listsLength: lists.length, containerWidth: containerSize.width });

    if (lists.length === 0 || containerSize.width === 0 || selectedList) {
      setTreemapLayout([]);
      return;
    }

    const treemapItems = lists.map(list => ({
      id: list.list_id,
      value: Math.max(listStats[list.list_id]?.totalRequirements || 1, 1),
      data: list
    }));

    console.log('📊 Treemap items:', treemapItems);

    const layout = generateTreemapLayout(
      treemapItems,
      containerSize.width,
      containerSize.height,
      {
        padding: 12,
        minSize: 150,
        maxAspectRatio: 3,
        enableDynamicHeight: true
      }
    );

    console.log('✅ Treemap layout:', layout.map(l => ({ id: l.id, w: l.width.toFixed(0), h: l.height.toFixed(0) })));
    setTreemapLayout(layout);
  }, [lists, listStats, containerSize, selectedList]);

  // Measure container size with throttling
  useEffect(() => {
    if (selectedList) return; // Only measure when showing lists

    let rafId: number | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const updateSize = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        if (containerRef.current) {
          const parent = containerRef.current.parentElement;
          const rect = containerRef.current.getBoundingClientRect();
          const width = rect.width > 0 ? rect.width : (parent?.getBoundingClientRect().width || 1200);
          const availableHeight = Math.max(window.innerHeight - 250, 600);

          setContainerSize({ width, height: availableHeight });
          console.log('📐 Container size updated:', width, availableHeight);
        }
        rafId = null;
      });
    };

    // Throttle resize events (max 10fps)
    const handleResize = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(updateSize, 100);
    };

    // Initial measurement with retry
    updateSize();

    // Retry after a short delay if width is still 0
    const retryTimer = setTimeout(() => {
      if (containerSize.width === 0) {
        console.log('🔄 Retrying container measurement...');
        updateSize();
      }
    }, 200);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (timeoutId !== null) clearTimeout(timeoutId);
      clearTimeout(retryTimer);
    };
  }, [selectedList, containerSize.width]);

  useEffect(() => {
    if (selectedList) return;
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        const rect = containerRef.current.getBoundingClientRect();
        const width = rect.width > 0 ? rect.width : (parent?.getBoundingClientRect().width || 1200);
        const availableHeight = Math.max(window.innerHeight - 250, 600);
        setContainerSize({ width, height: availableHeight });
        console.log('📐 Re-measure after lists:', width, availableHeight);
      }
    }, 100);
    return () => clearTimeout(timer);
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

  const handleCreateNewList = async () => {
    try {
      const newList: List = {
        list_id: generateId('LIST'),
        name: 'Nuova Lista',
        description: 'Descrizione della nuova lista',
        preset_key: undefined,
        created_on: new Date().toISOString(),
        created_by: 'current.user@example.com',
        status: 'Active'
      };

      await saveList(newList);
      await loadLists();
      setSelectedList(newList);
      updateSearchParams((params) => {
        params.set('listId', newList.list_id);
        params.delete('reqId');
        params.delete('tab');
      });
    } catch (err) {
      logger.error('Error creating new list:', err);
      setError('Errore nella creazione della nuova lista.');
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
      <div className="min-h-screen bg-gray-50 dark:bg-black p-6">
        <EstimateEditor
          requirement={selectedRequirement}
          list={selectedList}
          onBack={handleBackToRequirements}
        />
      </div>
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
          <div
            ref={containerRef}
            className="relative bg-gradient-to-br from-background to-muted/20"
            style={{
              minHeight: '600px',
              height: containerSize.height > 0 ? `${containerSize.height}px` : '600px'
            }}
          >
            {treemapLayout.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-lg font-semibold">Calcolo layout treemap...</p>
                  <p className="text-sm text-muted-foreground">Container: {containerSize.width}×{containerSize.height}</p>
                </div>
              </div>
            )}
            {treemapLayout.map((node) => {
              const list = node.data as List;
              const stats = listStats[list.list_id] || { totalRequirements: 0, totalDays: 0 };

              // Determine layout based on card size using utility function
              const variant = getCardSizeVariant(node.width, node.height);
              const isSmall = variant === 'small';
              const isMedium = variant === 'medium';
              const isLarge = variant === 'large';

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
                    className="h-full cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all hover:z-10 dark:bg-gray-900/50 dark:border-gray-800 border-2"
                    onClick={() => handleSelectList(list)}
                    title={
                      <div className="flex items-baseline gap-1">
                        {!isSmall && <FileText className="h-4 w-4 shrink-0" />}
                        <span className={`${isSmall ? 'text-sm' : ''} line-clamp-2 flex-1`}>
                          {list.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`${isSmall ? 'text-[10px] px-1.5 py-0' : 'text-xs'} shrink-0 bg-primary/10 text-primary font-bold`}
                        >
                          {stats.totalRequirements}
                        </Badge>
                      </div>
                    }
                    headerContent={
                      !isSmall && (
                        <div className="text-[10px] text-muted-foreground mt-1 opacity-50">
                          {node.width.toFixed(0)}×{node.height.toFixed(0)}px
                        </div>
                      )
                    }
                    rightElement={
                      !isSmall && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDeleteDialog(list);
                          }}
                          aria-label={`Elimina ${list.name}`}
                          className="h-7 w-7 dark:hover:bg-gray-800"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                        </Button>
                      )
                    }
                    contentClassName="flex flex-col h-full"
                  >
                    <div className="flex-1 flex flex-col justify-center">
                      {/* Layout for SMALL cards */}
                      {isSmall && (
                        <div className="flex items-center justify-center gap-3">
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">Req</div>
                            <div className="text-xl font-bold text-primary">{stats.totalRequirements}</div>
                          </div>
                          <div className="h-8 w-px bg-border"></div>
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">GG</div>
                            <div className="text-xl font-bold text-primary">{stats.totalDays.toFixed(0)}</div>
                          </div>
                        </div>
                      )}

                      {/* Layout for MEDIUM cards */}
                      {isMedium && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="text-center p-2 bg-primary/5 rounded">
                              <div className="text-xs text-muted-foreground">Requisiti</div>
                              <div className="text-2xl font-bold text-primary">{stats.totalRequirements}</div>
                            </div>
                            <div className="text-center p-2 bg-primary/5 rounded">
                              <div className="text-xs text-muted-foreground">Giorni</div>
                              <div className="text-2xl font-bold text-primary">{stats.totalDays.toFixed(1)}</div>
                            </div>
                          </div>
                          {list.owner && (
                            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 justify-center">
                              <User className="h-3 w-3 mr-1" />
                              <span className="truncate">{list.owner}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Layout for LARGE cards */}
                      {isLarge && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-primary/5 rounded-lg">
                              <div className="text-sm text-muted-foreground mb-1">Requisiti</div>
                              <div className="text-3xl font-bold text-primary">{stats.totalRequirements}</div>
                            </div>
                            <div className="text-center p-3 bg-primary/5 rounded-lg">
                              <div className="text-sm text-muted-foreground mb-1">Giorni Totali</div>
                              <div className="text-3xl font-bold text-primary">{stats.totalDays.toFixed(1)}</div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {list.owner && (
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <User className="h-4 w-4 mr-2" />
                                <span>{list.owner}</span>
                              </div>
                            )}
                            {list.period && (
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <Calendar className="h-4 w-4 mr-2" />
                                <span>{list.period}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </ListOverviewCard>
                </div>
              );
            })}
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
    </div>
  );
}
