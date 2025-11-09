import { useEffect, useMemo, useState, useRef, FormEvent, SyntheticEvent } from 'react';
import { ArrowLeft, Plus, Calendar, User, Tag, BarChart3, List as ListIcon, LayoutGrid, Search, X, PenSquare, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { FilterPopover } from './requirements/FilterPopover';
import { PRIORITY_OPTIONS, STATE_OPTIONS } from '@/constants/requirements';
import { DefaultPill } from '@/components/DefaultPill';
import { RequirementFormFields, RequirementFormStateBase } from './requirements/RequirementFormFields';
import { List, Requirement, DefaultSource } from '../types';
import { saveRequirement, generateId, getLatestEstimates, deleteRequirement } from '../lib/storage';
import { getRequirementDefaults } from '../lib/defaults';
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

type OverrideableField = 'priority' | 'labels' | 'description';
type OverrideState = Record<OverrideableField, boolean>;

const createInitialFormState = (): RequirementFormStateBase => ({
  title: '',
  description: '',
  business_owner: '',
  labels: '',
  priority: 'Med',
  state: 'Proposed',
  estimator: ''
});

const createInitialOverrideState = (): OverrideState => ({
  priority: false,
  labels: false,
  description: false
});

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
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [formData, setFormData] = useState<RequirementFormStateBase>(createInitialFormState());
  const [defaultSources, setDefaultSources] = useState<DefaultSource[]>([]);
  const [overriddenFields, setOverriddenFields] = useState<OverrideState>(createInitialOverrideState());
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requirementPendingDeletion, setRequirementPendingDeletion] = useState<Requirement | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    if (isFormDialogOpen && titleInputRef.current) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isFormDialogOpen]);

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

  // Current user - in real app, get from auth context
  const currentUser = 'current.user@example.com';

  const resetFormState = () => {
    setFormData(createInitialFormState());
    setDefaultSources([]);
    setOverriddenFields(createInitialOverrideState());
    setEditingRequirement(null);
  };

  const closeFormDialog = () => {
    setIsFormDialogOpen(false);
    resetFormState();
  };

  const handleFormDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (formSubmitting) {
        return;
      }
      closeFormDialog();
    } else {
      setIsFormDialogOpen(true);
    }
  };

  const getSourceForField = (field: OverrideableField) =>
    defaultSources.find((source) => source.field === field)?.source;

  const handleFormFieldChange = <K extends keyof RequirementFormStateBase>(field: K, value: RequirementFormStateBase[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTitleChange = (value: string) => {
    if (!list) {
      setFormData((prev) => ({ ...prev, title: value }));
      return;
    }

    if (editingRequirement) {
      setFormData((prev) => ({ ...prev, title: value }));
      return;
    }

    const { defaults, sources } = getRequirementDefaults(list, currentUser, value);
    setDefaultSources(sources);
    setFormData((prev) => ({
      ...prev,
      title: value,
      priority: overriddenFields.priority ? prev.priority : ((defaults.priority as Requirement['priority']) ?? prev.priority),
      labels: overriddenFields.labels ? prev.labels : (defaults.labels ?? prev.labels),
      description: overriddenFields.description ? prev.description : (defaults.description ?? prev.description)
    }));
  };

  const handleOpenCreateDialog = () => {
    resetFormState();
    const { defaults, sources } = getRequirementDefaults(list, currentUser);
    setDefaultSources(sources);
    setFormData({
      title: '',
      description: defaults.description ?? '',
      business_owner: defaults.business_owner ?? '',
      labels: defaults.labels ?? '',
      priority: (defaults.priority as Requirement['priority']) ?? 'Med',
      state: (defaults.state as Requirement['state']) ?? 'Proposed',
      estimator: defaults.estimator ?? ''
    });
    setIsFormDialogOpen(true);
  };

  const buildSourcesFromRequirement = (requirement: Requirement): DefaultSource[] => {
    const sources: DefaultSource[] = [];
    if (requirement.priority_default_source) {
      sources.push({
        field: 'priority',
        value: requirement.priority,
        source: requirement.priority_default_source,
        is_overridden: requirement.priority_is_overridden
      });
    }
    if (requirement.labels_default_source) {
      sources.push({
        field: 'labels',
        value: requirement.labels,
        source: requirement.labels_default_source,
        is_overridden: requirement.labels_is_overridden
      });
    }
    if (requirement.description_default_source) {
      sources.push({
        field: 'description',
        value: requirement.description,
        source: requirement.description_default_source,
        is_overridden: requirement.description_is_overridden
      });
    }
    return sources;
  };

  const handleEditRequirement = (requirement: Requirement) => {
    setEditingRequirement(requirement);
    setFormData({
      title: requirement.title,
      description: requirement.description,
      business_owner: requirement.business_owner,
      labels: requirement.labels ?? '',
      priority: requirement.priority,
      state: requirement.state,
      estimator: requirement.estimator ?? ''
    });
    setOverriddenFields({
      priority: Boolean(requirement.priority_is_overridden),
      labels: Boolean(requirement.labels_is_overridden),
      description: Boolean(requirement.description_is_overridden)
    });
    setDefaultSources(buildSourcesFromRequirement(requirement));
    setIsFormDialogOpen(true);
  };

  const handleToggleOverride = (field: OverrideableField) => {
    if (!list) {
      return;
    }

    const wasOverridden = overriddenFields[field];
    setOverriddenFields((prev) => ({
      ...prev,
      [field]: !wasOverridden
    }));

    if (wasOverridden) {
      const { defaults, sources } = getRequirementDefaults(list, currentUser, formData.title);
      setDefaultSources(sources);
      setFormData((prev) => {
        if (field === 'priority' && defaults.priority) {
          return { ...prev, priority: defaults.priority as Requirement['priority'] };
        }
        if (field === 'labels') {
          return { ...prev, labels: defaults.labels ?? '' };
        }
        if (field === 'description') {
          return { ...prev, description: defaults.description ?? '' };
        }
        return prev;
      });
    }
  };

  const renderDefaultPill = (field: OverrideableField) => {
    const source = defaultSources.find((s) => s.field === field);
    if (!source) {
      return null;
    }

    return (
      <DefaultPill
        source={source.source}
        isOverridden={overriddenFields[field]}
        onToggleOverride={() => handleToggleOverride(field)}
      />
    );
  };

  const handleSubmitRequirement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setFormSubmitting(true);
      const normalizedLabels = formData.labels
        .split(',')
        .map((label) => label.trim())
        .filter(Boolean)
        .join(', ');

      const requirement: Requirement = {
        req_id: editingRequirement?.req_id ?? generateId('REQ'),
        list_id: list.list_id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        business_owner: formData.business_owner.trim(),
        labels: normalizedLabels || undefined,
        priority: formData.priority,
        state: formData.state,
        estimator: formData.estimator?.trim() || undefined,
        created_on: editingRequirement?.created_on ?? new Date().toISOString(),
        last_estimated_on: editingRequirement?.last_estimated_on,
        priority_default_source: overriddenFields.priority ? undefined : getSourceForField('priority'),
        priority_is_overridden: overriddenFields.priority,
        labels_default_source: overriddenFields.labels ? undefined : getSourceForField('labels'),
        labels_is_overridden: overriddenFields.labels,
        description_default_source: overriddenFields.description ? undefined : getSourceForField('description'),
        description_is_overridden: overriddenFields.description
      };

      await saveRequirement(requirement);

      toast({
        title: editingRequirement ? 'Requisito aggiornato' : 'Requisito salvato',
        description: editingRequirement
          ? 'I dati del requisito sono stati aggiornati.'
          : `Requisito creato con i default di "${list.name}".`
      });

      closeFormDialog();
      onRequirementsChange();
    } catch (error) {
      logger.error('Error saving requirement:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile salvare il requisito. Riprova.'
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const openDeleteRequirementDialog = (requirement: Requirement) => {
    setRequirementPendingDeletion(requirement);
    setDeleteDialogOpen(true);
  };

  const closeDeleteRequirementDialog = () => {
    setDeleteDialogOpen(false);
    setRequirementPendingDeletion(null);
  };

  const handleDeleteDialogChange = (open: boolean) => {
    if (!open) {
      if (deleteLoading) {
        return;
      }
      closeDeleteRequirementDialog();
    } else {
      setDeleteDialogOpen(true);
    }
  };

  const handleConfirmDeleteRequirement = async () => {
    if (!requirementPendingDeletion) {
      return;
    }

    try {
      setDeleteLoading(true);
      await deleteRequirement(requirementPendingDeletion.req_id);
      toast({
        title: 'Requisito eliminato',
        description: `Il requisito "${requirementPendingDeletion.title}" è stato rimosso.`
      });
      closeDeleteRequirementDialog();
      onRequirementsChange();
    } catch (error) {
      logger.error('Error deleting requirement:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile eliminare il requisito. Riprova.'
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatEstimateDays = (days: number): string => {
    if (!Number.isFinite(days)) {
      return '0';
    }
    return Number.isInteger(days) ? days.toFixed(0) : days.toFixed(1);
  };

  const renderEstimateHighlight = (requirement: Requirement, variant: 'default' | 'compact' = 'default') => {
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

    const layoutClasses =
      variant === 'compact'
        ? 'flex flex-col gap-1 rounded-md px-2.5 py-1.5 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:gap-2'
        : 'flex flex-col gap-1.5 rounded-lg px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between';

    const iconClasses = variant === 'compact' ? 'h-3 w-3' : 'h-3.5 w-3.5';

    return (
      <div className={`${layoutClasses} border font-medium ${stateClasses}`}>
        <div className="flex items-center gap-1.5">
          <BarChart3 className={iconClasses} />
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

  const handleActionAreaEvent = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const renderRequirementActions = (requirement: Requirement) => (
    <div
      className="shrink-0"
      onClick={handleActionAreaEvent}
      onMouseDown={handleActionAreaEvent}
      onPointerDown={handleActionAreaEvent}
      onKeyDown={handleActionAreaEvent}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={`Azioni per ${requirement.title}`}
            onClick={handleActionAreaEvent}
            onMouseDown={handleActionAreaEvent}
            onPointerDown={handleActionAreaEvent}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              handleEditRequirement(requirement);
            }}
          >
            <PenSquare className="mr-2 h-4 w-4" />
            Modifica dati
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(event) => {
              event.stopPropagation();
              openDeleteRequirementDialog(requirement);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Elimina
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Breadcrumb e Tabs */}
      <div className="flex items-center justify-between gap-4">
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

        <div className="flex items-center gap-3">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="h-10 bg-muted/50">
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
          </Tabs>

          <Dialog open={isFormDialogOpen} onOpenChange={handleFormDialogOpenChange}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Requisito
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingRequirement ? 'Modifica Requisito' : 'Nuovo Requisito'}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  I default intelligenti della lista "<span className="font-medium">{list.name}</span>" verranno applicati automaticamente.
                </p>
              </DialogHeader>
              <form onSubmit={handleSubmitRequirement} className="space-y-4">
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
                  titlePlaceholder="Titolo del requisito (aggiorna i default automaticamente)"
                  descriptionPlaceholder="Descrizione dettagliata del requisito"
                  labelsPlaceholder="es. HR, Notifiche, Critical"
                  labelsLabel="Etichette (separate da virgola)"
                  titleRef={titleInputRef}
                />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {editingRequirement
                      ? `Creato il ${new Date(editingRequirement.created_on).toLocaleDateString('it-IT')}`
                      : 'Campi precompilati tramite preset della lista'}
                  </span>
                  {editingRequirement && (
                    <span className="font-mono text-xs text-muted-foreground">ID: {editingRequirement.req_id}</span>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={closeFormDialog} disabled={formSubmitting}>
                    Annulla
                  </Button>
                  <Button type="submit" disabled={formSubmitting || !formData.title.trim()}>
                    {formSubmitting ? 'Salvataggio...' : editingRequirement ? 'Aggiorna' : 'Crea Requisito'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Contenuto Tab */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
                <Button onClick={handleOpenCreateDialog} size="lg" className="shadow-md">
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
                <div className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-3'}>
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
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-3 flex-1">
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
                              </div>
                              {renderRequirementActions(requirement)}
                            </div>
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
                        className={`group cursor-pointer border bg-card/70 transition-all duration-150 ${cardAccentClasses} hover:border-primary/40 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
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
                        <div className="flex flex-col gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
                          <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${requirement.priority === 'High'
                                  ? 'bg-red-500'
                                  : requirement.priority === 'Med'
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                  }`}
                              />
                              <p className="truncate text-sm font-semibold leading-tight text-foreground">
                                {requirement.title}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 sm:justify-end">
                              <div className="min-w-[160px] flex-1 sm:flex-none">
                                {renderEstimateHighlight(requirement, 'compact')}
                              </div>
                              {renderRequirementActions(requirement)}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <Badge className={`${prioritySolidBadge} text-white text-[10px] font-semibold px-2 py-0.5 border-0`}>
                              {requirement.priority === 'High' ? 'Alta' : requirement.priority === 'Med' ? 'Media' : 'Bassa'}
                            </Badge>
                            <Badge className={`${stateSolidBadge} text-white text-[10px] font-semibold px-2 py-0.5 border-0`}>
                              {requirement.state === 'Proposed' ? 'Proposto' :
                                requirement.state === 'Selected' ? 'Selezionato' :
                                  requirement.state === 'Scheduled' ? 'Pianificato' : 'Completato'}
                            </Badge>
                            {requirement.business_owner ? (
                              <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-0.5">
                                <User className="h-3 w-3" />
                                <span className="font-medium normal-case">{requirement.business_owner}</span>
                              </div>
                            ) : (
                              <span className="rounded-full border border-dashed px-2 py-0.5">Non assegnato</span>
                            )}
                            <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-2 py-0.5">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(requirement.created_on).toLocaleDateString('it-IT')}</span>
                            </div>
                          </div>

                          <div className="hidden flex-col gap-2 text-[11px] text-muted-foreground group-hover:flex group-focus-visible:flex group-active:flex">
                            {requirement.description && (
                              <p className="line-clamp-2 leading-snug text-muted-foreground">
                                {requirement.description}
                              </p>
                            )}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {labels.length > 0 && (
                                  <>
                                    <Tag className="h-3 w-3" />
                                    {labels.slice(0, 4).map((label, index) => (
                                      <Badge key={index} variant="outline" className="px-2 py-0.5 text-[10px]">
                                        {label}
                                      </Badge>
                                    ))}
                                    {labels.length > 4 && (
                                      <Badge variant="outline" className="px-2 py-0.5 text-[10px]">
                                        +{labels.length - 4}
                                      </Badge>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina requisito</AlertDialogTitle>
            <AlertDialogDescription>
              {requirementPendingDeletion ? (
                <>
                  Il requisito{' '}
                  <span className="font-semibold text-foreground">
                    {requirementPendingDeletion.title}
                  </span>{' '}
                  (ID <span className="font-mono">{requirementPendingDeletion.req_id}</span>) e tutte le sue stime verranno eliminati.
                  L&#39;operazione è irreversibile.
                </>
              ) : (
                'Seleziona un requisito da eliminare.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading} onClick={closeDeleteRequirementDialog}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteRequirement}
              disabled={deleteLoading || !requirementPendingDeletion}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleteLoading ? 'Eliminazione...' : 'Elimina definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
