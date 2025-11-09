import { useEffect, useMemo, useState, useRef } from 'react';
import { ArrowLeft, Plus, Calendar, User, Tag, BarChart3, List as ListIcon, LayoutGrid, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/use-toast';
import { FilterPopover } from './requirements/FilterPopover';
import { RequirementFormFields, RequirementFormStateBase } from './requirements/RequirementFormFields';
import { PRIORITY_OPTIONS, STATE_OPTIONS } from '@/constants/requirements';
import { List, Requirement } from '../types';
import { saveRequirement, generateId, getLatestEstimates } from '../lib/storage';
import { logger } from '@/lib/logger';
import { DashboardView } from './DashboardView';
import { useSearchParams } from 'react-router-dom';

interface RequirementsListProps {
  list: List;
  requirements: Requirement[];
  onBack: () => void;
  onSelectRequirement: (requirement: Requirement) => void;
  onRequirementsChange: () => void;
}

type RequirementFormState = RequirementFormStateBase;

type RequirementFilters = {
  search: string;
  priorities: Requirement['priority'][];
  states: Requirement['state'][];
  owners: string[];
  labels: string[];
  estimate: 'all' | 'estimated' | 'missing';
};

type SortOption = 'created-desc' | 'created-asc' | 'priority' | 'title' | 'estimate-desc' | 'estimate-asc';
type TabValue = 'list' | 'dashboard';

type RequirementWithMeta = {
  requirement: Requirement;
  labels: string[];
  hasEstimate: boolean;
  estimateDays: number;
};

const ESTIMATE_OPTIONS = [
  { value: 'all', label: 'Tutti' },
  { value: 'estimated', label: 'Solo stimati' },
  { value: 'missing', label: 'Da stimare' }
] as const;

const PRIORITY_ORDER: Record<Requirement['priority'], number> = {
  High: 0,
  Med: 1,
  Low: 2
};

const PRIORITY_LABEL: Record<Requirement['priority'], string> = {
  High: 'Alta',
  Med: 'Media',
  Low: 'Bassa'
};

const STATE_LABEL: Record<Requirement['state'], string> = {
  Proposed: 'Proposto',
  Selected: 'Selezionato',
  Scheduled: 'Pianificato',
  Done: 'Completato'
};

const INITIAL_FILTERS: RequirementFilters = {
  search: '',
  priorities: [],
  states: [],
  owners: [],
  labels: [],
  estimate: 'all'
};

const toggleArrayValue = <T,>(array: T[], value: T): T[] =>
  array.includes(value) ? array.filter((item) => item !== value) : [...array, value];

export function RequirementsList({
  list,
  requirements,
  onBack,
  onSelectRequirement,
  onRequirementsChange
}: RequirementsListProps) {
  const { toast } = useToast();
  const titleInputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRequirement, setNewRequirement] = useState<RequirementFormState>({
    title: '',
    description: '',
    business_owner: '',
    priority: 'Med' as const,
    state: 'Proposed' as const,
    labels: ''
  });
  const handleNewRequirementFieldChange = <K extends keyof RequirementFormState>(field: K, value: RequirementFormState[K]) => {
    setNewRequirement((prev) => ({ ...prev, [field]: value }));
  };
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [estimatesMap, setEstimatesMap] = useState<Record<string, { totalDays: number; updatedOn?: string } | null>>({});
  const [estimatesLoaded, setEstimatesLoaded] = useState(false);
  const [filters, setFilters] = useState<RequirementFilters>(INITIAL_FILTERS);
  const [sortOption, setSortOption] = useState<SortOption>('created-desc');
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabValue = tabParam === 'dashboard' ? 'dashboard' : 'list';
  const handleTabChange = (value: string) => {
    const nextTab: TabValue = value === 'dashboard' ? 'dashboard' : 'list';
    const params = new URLSearchParams(searchParams);
    if (nextTab === 'list') {
      params.delete('tab');
    } else {
      params.set('tab', nextTab);
    }
    setSearchParams(params, { replace: true });
  };

  // Focus management for dialog
  useEffect(() => {
    if (isAddDialogOpen && titleInputRef.current) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isAddDialogOpen]);

  useEffect(() => {
    let isMounted = true;

    const loadEstimates = async () => {
      const reqIds = requirements.map((requirement) => requirement.req_id);

      if (reqIds.length === 0) {
        if (isMounted) {
          setEstimatesMap({});
          setEstimatesLoaded(true);
        }
        return;
      }

      setEstimatesLoaded(false);

      try {
        const latestEstimates = await getLatestEstimates(reqIds);

        if (isMounted) {
          const entries = requirements.map((requirement) => {
            const estimate = latestEstimates[requirement.req_id];
            return [
              requirement.req_id,
              estimate ? { totalDays: estimate.total_days, updatedOn: estimate.created_on } : null
            ] as const;
          });

          setEstimatesMap(Object.fromEntries(entries));
        }
      } catch (error) {
        logger.error('Error preparing estimates map', error);
      } finally {
        if (isMounted) {
          setEstimatesLoaded(true);
        }
      }
    };

    loadEstimates();

    return () => {
      isMounted = false;
    };
  }, [requirements]);

  const requirementsWithMeta = useMemo<RequirementWithMeta[]>(() => {
    return requirements.map((requirement) => {
      const labels = requirement.labels
        ? requirement.labels.split(',').map((label) => label.trim()).filter(Boolean)
        : [];
      const summary = estimatesMap[requirement.req_id];
      const estimateDays = summary?.totalDays ?? 0;
      const hasEstimate = Boolean(
        (summary && summary.totalDays > 0) || requirement.last_estimated_on
      );

      return {
        requirement,
        labels,
        hasEstimate,
        estimateDays
      };
    });
  }, [requirements, estimatesMap]);

  const ownerOptions = useMemo(() => {
    const owners = new Set<string>();
    requirements.forEach((requirement) => {
      if (requirement.business_owner?.trim()) {
        owners.add(requirement.business_owner.trim());
      }
    });
    return Array.from(owners).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
  }, [requirements]);

  const labelOptions = useMemo(() => {
    const labels = new Set<string>();
    requirementsWithMeta.forEach((item) => {
      item.labels.forEach((label) => labels.add(label));
    });
    return Array.from(labels).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
  }, [requirementsWithMeta]);

  const filteredRequirements = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return requirementsWithMeta.filter(({ requirement, labels, hasEstimate }) => {
      if (search) {
        const haystack = `${requirement.title} ${requirement.description ?? ''} ${requirement.req_id} ${requirement.business_owner ?? ''} ${labels.join(' ')}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      if (filters.priorities.length > 0 && !filters.priorities.includes(requirement.priority)) {
        return false;
      }

      if (filters.states.length > 0 && !filters.states.includes(requirement.state)) {
        return false;
      }

      if (filters.owners.length > 0) {
        const ownerValue = requirement.business_owner?.trim();
        if (!ownerValue || !filters.owners.includes(ownerValue)) {
          return false;
        }
      }

      if (filters.labels.length > 0) {
        const matchesLabels = filters.labels.every((label) => labels.includes(label));
        if (!matchesLabels) {
          return false;
        }
      }

      if (filters.estimate === 'estimated' && !hasEstimate) {
        return false;
      }

      if (filters.estimate === 'missing' && hasEstimate) {
        return false;
      }

      return true;
    });
  }, [requirementsWithMeta, filters]);

  const visibleRequirements = useMemo(() => {
    const sorted = [...filteredRequirements];

    sorted.sort((a, b) => {
      switch (sortOption) {
        case 'created-asc':
          return new Date(a.requirement.created_on).getTime() - new Date(b.requirement.created_on).getTime();
        case 'priority':
          return PRIORITY_ORDER[a.requirement.priority] - PRIORITY_ORDER[b.requirement.priority];
        case 'title':
          return a.requirement.title.localeCompare(b.requirement.title, 'it', { sensitivity: 'base' });
        case 'estimate-desc':
          return (b.estimateDays ?? 0) - (a.estimateDays ?? 0);
        case 'estimate-asc':
          return (a.estimateDays ?? 0) - (b.estimateDays ?? 0);
        case 'created-desc':
        default:
          return new Date(b.requirement.created_on).getTime() - new Date(a.requirement.created_on).getTime();
      }
    });

    return sorted;
  }, [filteredRequirements, sortOption]);

  const visibleRequirementEntities = useMemo(
    () => visibleRequirements.map((item) => item.requirement),
    [visibleRequirements]
  );

  const hasActiveFilters =
    Boolean(filters.search.trim()) ||
    filters.priorities.length > 0 ||
    filters.states.length > 0 ||
    filters.owners.length > 0 ||
    filters.labels.length > 0 ||
    filters.estimate !== 'all';

  const activeFilterCount =
    (filters.search.trim() ? 1 : 0) +
    filters.priorities.length +
    filters.states.length +
    filters.owners.length +
    filters.labels.length +
    (filters.estimate !== 'all' ? 1 : 0);

  const handleResetFilters = () => setFilters({ ...INITIAL_FILTERS });

  const handleTogglePriority = (value: Requirement['priority']) => {
    setFilters((prev) => ({
      ...prev,
      priorities: toggleArrayValue(prev.priorities, value)
    }));
  };

  const handleToggleState = (value: Requirement['state']) => {
    setFilters((prev) => ({
      ...prev,
      states: toggleArrayValue(prev.states, value)
    }));
  };

  const handleToggleOwner = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      owners: toggleArrayValue(prev.owners, value)
    }));
  };

  const handleToggleLabel = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      labels: toggleArrayValue(prev.labels, value)
    }));
  };

  const handleEstimateFilterChange = (value: RequirementFilters['estimate']) => {
    setFilters((prev) => ({
      ...prev,
      estimate: value
    }));
  };

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      search: value
    }));
  };

  const handleSortChange = (value: SortOption) => {
    setSortOption(value);
  };

  const filterChips: { key: string; label: string; onRemove: () => void }[] = [];
  const trimmedSearch = filters.search.trim();

  if (trimmedSearch) {
    filterChips.push({
      key: 'search',
      label: `Testo: "${trimmedSearch}"`,
      onRemove: () => handleSearchChange('')
    });
  }

  filters.priorities.forEach((priority) => {
    filterChips.push({
      key: `priority-${priority}`,
      label: `Priorità: ${PRIORITY_LABEL[priority]}`,
      onRemove: () => handleTogglePriority(priority)
    });
  });

  filters.states.forEach((state) => {
    filterChips.push({
      key: `state-${state}`,
      label: `Stato: ${STATE_LABEL[state]}`,
      onRemove: () => handleToggleState(state)
    });
  });

  filters.owners.forEach((owner) => {
    filterChips.push({
      key: `owner-${owner}`,
      label: `Owner: ${owner}`,
      onRemove: () => handleToggleOwner(owner)
    });
  });

  filters.labels.forEach((label) => {
    filterChips.push({
      key: `label-${label}`,
      label: `Etichetta: ${label}`,
      onRemove: () => handleToggleLabel(label)
    });
  });

  if (filters.estimate !== 'all') {
    filterChips.push({
      key: 'estimate',
      label: filters.estimate === 'estimated' ? 'Solo stimati' : 'Da stimare',
      onRemove: () => handleEstimateFilterChange('all')
    });
  }

  const totalRequirements = requirements.length;
  const visibleCount = visibleRequirementEntities.length;
  const handleAddRequirement = async () => {
    try {
      const requirement: Requirement = {
        req_id: generateId('REQ'),
        list_id: list.list_id,
        title: newRequirement.title,
        description: newRequirement.description,
        business_owner: newRequirement.business_owner,
        priority: newRequirement.priority,
        state: newRequirement.state,
        labels: newRequirement.labels,
        created_on: new Date().toISOString(),
        last_estimated_on: undefined
      };

      await saveRequirement(requirement);

      // Reset form
      setNewRequirement({
        title: '',
        description: '',
        business_owner: '',
        priority: 'Med',
        state: 'Proposed',
        labels: ''
      });

      setIsAddDialogOpen(false);
      onRequirementsChange();

      toast({
        title: 'Requisito salvato',
        description: 'Il requisito è stato aggiunto con successo',
      });
    } catch (error) {
      logger.error('Error adding requirement:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile salvare il requisito. Riprova.',
      });
    }
  };

  const formatEstimateDays = (days: number): string => {
    if (!Number.isFinite(days)) {
      return '0';
    }
    return Number.isInteger(days) ? days.toFixed(0) : days.toFixed(1);
  };

  const renderEstimateHighlight = (requirement: Requirement) => {
    const summary = estimatesMap[requirement.req_id];
    const hasEstimate = Boolean(summary && summary.totalDays > 0);
    const loading = !estimatesLoaded;

    const stateClasses = loading
      ? 'border-muted bg-muted/50 text-muted-foreground dark:text-muted'
      : hasEstimate
        ? 'border-emerald-400 bg-emerald-100/80 text-emerald-900 dark:border-emerald-400/70 dark:bg-emerald-500/30 dark:text-emerald-50'
        : 'border-amber-400 bg-amber-100/80 text-amber-900 dark:border-amber-400/70 dark:bg-amber-500/25 dark:text-amber-50';

    const label = loading
      ? 'Caricamento stima...'
      : hasEstimate
        ? `Stima ${formatEstimateDays(summary!.totalDays)} gg`
        : 'Stima non ancora effettuata';

    return (
      <div className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium sm:flex-row sm:items-center sm:justify-between ${stateClasses}`}>
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>
        {hasEstimate && summary?.updatedOn && (
          <span className="text-[11px] font-normal opacity-80">
            Aggiornata {new Date(summary.updatedOn).toLocaleDateString('it-IT')}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb con metriche e azione */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-muted-foreground">Liste</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold">{list.name}</span>
          </Button>
          <span className="text-muted-foreground">•</span>
          <span className="text-sm text-muted-foreground">{list.description}</span>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Requisito
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Aggiungi Nuovo Requisito</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <RequirementFormFields
                formData={newRequirement}
                onChange={handleNewRequirementFieldChange}
                titleRef={titleInputRef}
                titlePlaceholder="Titolo del requisito"
                descriptionPlaceholder="Descrizione dettagliata del requisito"
                labelsPlaceholder="tag1,tag2,tag3"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleAddRequirement} disabled={!newRequirement.title.trim()}>
                  Salva Requisito
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs per Lista/Dashboard */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-4 h-11 bg-muted/50">
          <TabsTrigger
            value="list"
            className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md"
            aria-current={activeTab === 'list' ? 'page' : undefined}
          >
            <ListIcon className="h-4 w-4" />
            Lista Requisiti
          </TabsTrigger>
          <TabsTrigger
            value="dashboard"
            className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md"
            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard Stima
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {totalRequirements === 0 ? (
            <Card className="text-center py-12 bg-gradient-to-br from-muted/30 to-background border-dashed">
              <CardContent>
                <div className="bg-primary/10 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Nessun requisito trovato</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Aggiungi il primo requisito per iniziare a creare stime e tracciare il progresso del progetto
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)} size="lg" className="shadow-md">
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Primo Requisito
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Mostrati {visibleCount} di {totalRequirements}{' '}
                    {totalRequirements === 1 ? 'requisito' : 'requisiti'}
                  </p>
                  {hasActiveFilters && (
                    <p className="text-xs text-muted-foreground">
                      {activeFilterCount}{' '}
                      {activeFilterCount === 1 ? 'filtro attivo' : 'filtri attivi'}
                    </p>
                  )}
                </div>
                <div className="inline-flex items-center gap-1 rounded-md border bg-muted/40 p-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Visualizzazione elenco"
                    className={`gap-2 ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                    onClick={() => setViewMode('list')}
                  >
                    <ListIcon className="h-4 w-4" />
                    <span>Dettagli</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Visualizzazione a riquadri"
                    className={`gap-2 ${viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    <span>Riquadri</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filters.search}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    placeholder="Cerca per titolo, owner o etichetta"
                    className="pl-9"
                  />
                </div>

                <FilterPopover
                  buttonLabel="Priorità"
                  title="Priorità"
                  options={PRIORITY_OPTIONS}
                  selectedValues={filters.priorities}
                  onToggle={(value) => handleTogglePriority(value as Requirement['priority'])}
                  triggerClassName="w-[160px]"
                />

                <FilterPopover
                  buttonLabel="Stato"
                  title="Stato del requisito"
                  options={STATE_OPTIONS}
                  selectedValues={filters.states}
                  onToggle={(value) => handleToggleState(value as Requirement['state'])}
                  triggerClassName="w-[170px]"
                />

                {ownerOptions.length > 0 && (
                  <FilterPopover
                    buttonLabel="Business Owner"
                    title="Business Owner"
                    options={ownerOptions.map((owner) => ({ value: owner, label: owner }))}
                    selectedValues={filters.owners}
                    onToggle={handleToggleOwner}
                    triggerClassName="w-[190px]"
                    scrollable
                    contentClassName="w-72"
                  />
                )}

                {labelOptions.length > 0 && (
                  <FilterPopover
                    buttonLabel="Etichette"
                    title="Etichette"
                    options={labelOptions.map((label) => ({ value: label, label }))}
                    selectedValues={filters.labels}
                    onToggle={handleToggleLabel}
                    triggerClassName="w-[160px]"
                    scrollable
                    optionClassName="capitalize"
                  />
                )}

                <Select
                  value={filters.estimate}
                  onValueChange={(value) => handleEstimateFilterChange(value as RequirementFilters['estimate'])}
                >
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Stato stima" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTIMATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortOption} onValueChange={(value) => handleSortChange(value as SortOption)}>
                  <SelectTrigger className="w-[190px]">
                    <SelectValue placeholder="Ordinamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created-desc">Più recenti</SelectItem>
                    <SelectItem value="created-asc">Meno recenti</SelectItem>
                    <SelectItem value="priority">Priorità</SelectItem>
                    <SelectItem value="title">Titolo A-Z</SelectItem>
                    <SelectItem value="estimate-desc">Stima maggiore</SelectItem>
                    <SelectItem value="estimate-asc">Stima minore</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="ghost" size="sm" onClick={handleResetFilters} disabled={!hasActiveFilters}>
                  Reimposta filtri
                </Button>
              </div>

              {filterChips.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {filterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onRemove}
                      className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition"
                    >
                      <span>{chip.label}</span>
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}

              {!estimatesLoaded ? (
                <Skeleton variant="card" count={6} className="mb-4" />
              ) : visibleCount === 0 ? (
                <EmptyState
                  illustration="filter"
                  title="Nessun requisito trovato"
                  description="Prova a modificare i filtri di ricerca o reimposta tutti i criteri per vedere l'elenco completo dei requisiti."
                  action={{
                    label: "Reimposta filtri",
                    onClick: handleResetFilters
                  }}
                />
              ) : (
                <div className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'grid gap-4'}>
                  {visibleRequirements.map(({ requirement, labels }) => {
                    const priorityAccentColor = {
                      High: 'border-red-500',
                      Med: 'border-yellow-500',
                      Low: 'border-green-500'
                    }[requirement.priority];

                    const prioritySolidBadge = {
                      High: 'bg-red-500 hover:bg-red-600',
                      Med: 'bg-yellow-500 hover:bg-yellow-600',
                      Low: 'bg-green-500 hover:bg-green-600'
                    }[requirement.priority];

                    const stateSolidBadge = {
                      Proposed: 'bg-blue-500 hover:bg-blue-600',
                      Selected: 'bg-purple-500 hover:bg-purple-600',
                      Scheduled: 'bg-orange-500 hover:bg-orange-600',
                      Done: 'bg-green-600 hover:bg-green-700'
                    }[requirement.state];

                    const cardAccentClasses = `${viewMode === 'grid' ? 'border-t-4' : 'border-l-4'} ${priorityAccentColor}`;

                    if (viewMode === 'grid') {
                      return (
                        <Card
                          key={requirement.req_id}
                          className={`h-full flex flex-col cursor-pointer transition-all duration-300 ${cardAccentClasses} hover:shadow-lg bg-gradient-to-br from-background to-muted/10`}
                          onClick={() => onSelectRequirement(requirement)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectRequirement(requirement);
                            }
                          }}
                          role="button"
                          aria-label={`Apri requisito: ${requirement.title}`}
                        >
                          <CardHeader className="space-y-3 pb-4 flex flex-col flex-1">
                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <Badge className={`${prioritySolidBadge} text-white text-[11px] font-semibold px-2 py-0.5 border-0`}>
                                {requirement.priority === 'High' ? 'Alta' : requirement.priority === 'Med' ? 'Media' : 'Bassa'}
                              </Badge>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>{new Date(requirement.created_on).toLocaleDateString('it-IT')}</span>
                              </div>
                            </div>
                            <CardTitle className="text-base leading-tight line-clamp-2">{requirement.title}</CardTitle>
                            {requirement.description && (
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {requirement.description}
                              </p>
                            )}
                          </CardHeader>
                          <CardContent className="pt-0 space-y-3">
                            {renderEstimateHighlight(requirement)}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge className={`${stateSolidBadge} text-white text-[11px] font-semibold px-2 py-0.5 border-0`}>
                                {requirement.state === 'Proposed' ? 'Proposto' :
                                  requirement.state === 'Selected' ? 'Selezionato' :
                                    requirement.state === 'Scheduled' ? 'Pianificato' : 'Completato'}
                              </Badge>
                              {requirement.business_owner && (
                                <div className="flex items-center gap-1.5 rounded border px-2 py-0.5">
                                  <User className="h-3 w-3" />
                                  <span className="font-medium">{requirement.business_owner}</span>
                                </div>
                              )}
                              {requirement.last_estimated_on && (
                                <div className="flex items-center gap-1.5 rounded border px-2 py-0.5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400">
                                  <BarChart3 className="h-3 w-3" />
                                  <span>Stimato {new Date(requirement.last_estimated_on).toLocaleDateString('it-IT')}</span>
                                </div>
                              )}
                              {labels.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Tag className="h-3 w-3 text-muted-foreground" />
                                  {labels.slice(0, 2).map((label, index) => (
                                    <Badge key={index} variant="outline" className="text-[11px] px-2 py-0.5">
                                      {label}
                                    </Badge>
                                  ))}
                                  {labels.length > 2 && (
                                    <Badge variant="outline" className="text-[11px] px-2 py-0.5">
                                      +{labels.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    return (
                      <Card
                        key={requirement.req_id}
                        className={`cursor-pointer hover:shadow-lg transition-all duration-300 ${cardAccentClasses} hover:scale-[1.01] bg-gradient-to-br from-background to-muted/20`}
                        onClick={() => onSelectRequirement(requirement)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectRequirement(requirement);
                          }
                        }}
                        role="button"
                        aria-label={`Apri requisito: ${requirement.title}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg mb-2 flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">{requirement.title}</span>
                              </CardTitle>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {requirement.description}
                              </p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <Badge className={`${prioritySolidBadge} text-white text-xs font-semibold px-2.5 py-1 border-0`}>
                                {requirement.priority === 'High' ? 'Alta' : requirement.priority === 'Med' ? 'Media' : 'Bassa'}
                              </Badge>
                              <Badge className={`${stateSolidBadge} text-white text-xs font-semibold px-2.5 py-1 border-0`}>
                                {requirement.state === 'Proposed' ? 'Proposto' :
                                  requirement.state === 'Selected' ? 'Selezionato' :
                                    requirement.state === 'Scheduled' ? 'Pianificato' : 'Completato'}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="pt-0 space-y-3">
                          {renderEstimateHighlight(requirement)}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            {requirement.business_owner && (
                              <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
                                <User className="h-3.5 w-3.5" />
                                <span className="font-medium">{requirement.business_owner}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{new Date(requirement.created_on).toLocaleDateString('it-IT')}</span>
                            </div>
                            {requirement.last_estimated_on && (
                              <div className="flex items-center gap-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
                                <BarChart3 className="h-3.5 w-3.5" />
                                <span className="font-medium">Stimato: {new Date(requirement.last_estimated_on).toLocaleDateString('it-IT')}</span>
                              </div>
                            )}
                            {labels.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Tag className="h-3.5 w-3.5" />
                                {labels.slice(0, 3).map((label, index) => (
                                  <Badge key={index} variant="outline" className="text-xs px-2 py-0.5 bg-background hover:bg-muted">
                                    {label}
                                  </Badge>
                                ))}
                                {labels.length > 3 && (
                                  <Badge variant="outline" className="text-xs px-2 py-0.5">
                                    +{labels.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dashboard">
          <DashboardView
            list={list}
            requirements={visibleRequirementEntities}
            onBack={onBack}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
