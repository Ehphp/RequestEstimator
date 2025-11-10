import { useEffect, useMemo, useState, useRef, FormEvent, SyntheticEvent, useCallback } from 'react';
import { ArrowLeft, Plus, Calendar, User, Tag, BarChart3, List as ListIcon, LayoutGrid, Search, X, PenSquare, Trash2, MoreHorizontal, ArrowDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
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
import { useDebounce } from '@/hooks/use-debounce';
import { FilterPopover } from './requirements/FilterPopover';
import { PRIORITY_OPTIONS, STATE_OPTIONS } from '@/constants/requirements';
import { DefaultPill } from '@/components/DefaultPill';
import { RequirementFormFields, RequirementFormStateBase } from './requirements/RequirementFormFields';
import { List, Requirement, DefaultSource, RequirementWithEstimate } from '../types';
import { saveRequirement, generateId, deleteRequirement, saveList } from '../lib/storage';
import { getRequirementDefaults } from '../lib/defaults';
import { prepareRequirementsWithEstimates } from '../lib/calculations';
import {
  buildRequirementTree,
  flattenRequirementTree,
  sortRequirementTree,
  getDescendantIds,
  getAncestorIds,
  wouldCreateCycle,
  RequirementTree,
  RequirementTreeNode
} from '../lib/requirementsHierarchy';
import { logger } from '@/lib/logger';
import { DashboardView } from './DashboardView';
import { useSearchParams } from 'react-router-dom';
import { parseLabels } from '@/lib/utils';
import {
  RequirementFilters,
  SortOption,
  ESTIMATE_OPTIONS,
  INITIAL_FILTERS,
  toggleArrayValue,
  hasActiveFilters as checkHasActiveFilters,
  countActiveFilters as getActiveFilterCount,
  normalizeSearchString
} from '@/lib/filterUtils';

interface RequirementsListProps {
  list: List;
  requirements: Requirement[];
  onBack: () => void;
  onSelectRequirement: (requirement: Requirement) => void;
  onRequirementsChange: () => void;
  onListUpdated: (list: List) => void;
}

type TabValue = 'list' | 'dashboard';

type RequirementWithMeta = {
  requirement: Requirement;
  labels: string[];
  hasEstimate: boolean;
  estimateDays: number;
};

type RequirementWithHierarchyMeta = RequirementWithMeta & {
  depth: number;
  parentId: string | null;
  path: string[];
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
  estimator: '',
  parent_req_id: null
});

const createInitialOverrideState = (): OverrideState => ({
  priority: false,
  labels: false,
  description: false
});

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

const allowDraftStatus = import.meta.env.VITE_ENABLE_DRAFT_STATUS === 'true';

export function RequirementsList({
  list,
  requirements,
  onBack,
  onSelectRequirement,
  onRequirementsChange,
  onListUpdated
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
  const [requirementEstimates, setRequirementEstimates] = useState<Record<string, RequirementWithEstimate>>({});
  const [estimatesLoading, setEstimatesLoading] = useState(false);
  const [filters, setFilters] = useState<RequirementFilters>(INITIAL_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
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

  const createListFormState = (baseList: List) => ({
    owner: baseList.owner ?? '',
    period: baseList.period ?? '',
    technology: baseList.technology ?? '',
    status: baseList.status,
    notes: baseList.notes ?? ''
  });

  const [isEditListDialogOpen, setIsEditListDialogOpen] = useState(false);
  const [listFormData, setListFormData] = useState(() => createListFormState(list));
  const [listUpdating, setListUpdating] = useState(false);
  const openListEditDialog = () => {
    setListFormData(createListFormState(list));
    setIsEditListDialogOpen(true);
  };
  const updateListFormField = (field: keyof typeof listFormData, value: string) =>
    setListFormData(prev => ({ ...prev, [field]: value }));
  const handleSubmitListUpdate = async (event: FormEvent) => {
    event.preventDefault();
    setListUpdating(true);
    try {
      const trimmedOwner = listFormData.owner.trim();
      const trimmedPeriod = listFormData.period.trim();
      const trimmedTechnology = listFormData.technology.trim();
      const trimmedNotes = listFormData.notes.trim();
      const updatedList: List = {
        ...list,
        owner: trimmedOwner || undefined,
        period: trimmedPeriod || undefined,
        technology: trimmedTechnology || undefined,
        status: listFormData.status,
        notes: trimmedNotes || undefined
      };
      await saveList(updatedList);
      onListUpdated(updatedList);
      setIsEditListDialogOpen(false);
      toast({
        title: 'Lista aggiornata',
        description: 'I metadati della lista sono stati salvati.'
      });
    } catch (error) {
      logger.error('Error updating list', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile aggiornare la lista.'
      });
    } finally {
      setListUpdating(false);
    }
  };

  // Focus management for dialog
  useEffect(() => {
    if (isFormDialogOpen && titleInputRef.current) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isFormDialogOpen]);

  useEffect(() => {
    setListFormData(createListFormState(list));
  }, [list]);

  useEffect(() => {
    let isMounted = true;

    if (requirements.length === 0) {
      setRequirementEstimates({});
      setEstimatesLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setEstimatesLoading(true);

    prepareRequirementsWithEstimates(requirements)
      .then((summaries) => {
        if (!isMounted) return;
        const entries = summaries.map((summary) => [summary.requirement.req_id, summary] as const);
        setRequirementEstimates(Object.fromEntries(entries));
      })
      .catch((error) => {
        logger.error('Error preparing estimates map', error);
      })
      .finally(() => {
        if (isMounted) {
          setEstimatesLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [requirements]);

  const requirementsWithMeta = useMemo<RequirementWithMeta[]>(() => {
    return requirements.map((requirement) => {
      const labels = parseLabels(requirement.labels);
      const summary = requirementEstimates[requirement.req_id];
      const estimateDays = summary?.estimationDays ?? 0;
      const hasEstimate = Boolean(
        (summary && summary.estimationDays > 0) || requirement.last_estimated_on
      );

      return {
        requirement,
        labels,
        hasEstimate,
        estimateDays
      };
    });
  }, [requirements, requirementEstimates]);

  const requirementMetaMap = useMemo(() => {
    const map = new Map<string, RequirementWithMeta>();
    requirementsWithMeta.forEach((item) => {
      map.set(item.requirement.req_id, item);
    });
    return map;
  }, [requirementsWithMeta]);

  const requirementTree = useMemo<RequirementTree<RequirementWithMeta>>(() => {
    return buildRequirementTree(requirementsWithMeta, {
      getId: (item) => item.requirement.req_id,
      getParentId: (item) => item.requirement.parent_req_id ?? null
    });
  }, [requirementsWithMeta]);

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

  const childCountByParent = useMemo(() => {
    const counts = new Map<string, number>();
    requirements.forEach((requirement) => {
      if (requirement.parent_req_id) {
        counts.set(
          requirement.parent_req_id,
          (counts.get(requirement.parent_req_id) ?? 0) + 1
        );
      }
    });
    return counts;
  }, [requirements]);

  const parentSelectOptions = useMemo(() => {
    const flattened = flattenRequirementTree(requirementTree);
    const blockedIds = new Set<string>();

    if (editingRequirement) {
      blockedIds.add(editingRequirement.req_id);
      getDescendantIds(requirementTree, editingRequirement.req_id).forEach((id) => blockedIds.add(id));
    }

    return flattened
      .filter(({ item }) => !blockedIds.has(item.requirement.req_id))
      .map(({ item, depth }) => ({
        value: item.requirement.req_id,
        label: item.requirement.title || item.requirement.req_id,
        depth
      }));
  }, [requirementTree, editingRequirement]);

  // Sync debounced search with filters
  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: debouncedSearch }));
  }, [debouncedSearch]);

  const filteredRequirementIds = useMemo(() => {
    const normalizedSearch = normalizeSearchString(filters.search);
    const matches = new Set<string>();

    requirementsWithMeta.forEach(({ requirement, labels, hasEstimate }) => {
      let passes = true;

      if (normalizedSearch) {
        const haystack = normalizeSearchString(
          `${requirement.title} ${requirement.description ?? ''} ${requirement.req_id} ${requirement.business_owner ?? ''} ${labels.join(' ')}`
        );
        if (!haystack.includes(normalizedSearch)) {
          passes = false;
        }
      }

      if (passes && filters.priorities.length > 0 && !filters.priorities.includes(requirement.priority)) {
        passes = false;
      }

      if (passes && filters.states.length > 0 && !filters.states.includes(requirement.state)) {
        passes = false;
      }

      if (passes && filters.owners.length > 0) {
        const ownerValue = requirement.business_owner?.trim();
        if (!ownerValue || !filters.owners.includes(ownerValue)) {
          passes = false;
        }
      }

      if (passes && filters.labels.length > 0) {
        const matchesLabels = filters.labels.every((label) => labels.includes(label));
        if (!matchesLabels) {
          passes = false;
        }
      }

      if (passes && filters.estimate === 'estimated' && !hasEstimate) {
        passes = false;
      }

      if (passes && filters.estimate === 'missing' && hasEstimate) {
        passes = false;
      }

      if (passes) {
        matches.add(requirement.req_id);
      }
    });

    if (matches.size === 0) {
      return matches;
    }

    const expanded = new Set(matches);
    matches.forEach((id) => {
      getAncestorIds(requirementTree, id).forEach((ancestorId) => expanded.add(ancestorId));
    });

    return expanded;
  }, [requirementsWithMeta, filters, requirementTree]);

  const filteredTree = useMemo<RequirementTree<RequirementWithMeta>>(() => {
    if (filteredRequirementIds.size === 0) {
      return {
        roots: [],
        nodeMap: new Map(),
        getId: requirementTree.getId,
        getParentId: requirementTree.getParentId
      };
    }

    const cloneNode = (
      node: RequirementTreeNode<RequirementWithMeta>
    ): RequirementTreeNode<RequirementWithMeta> | null => {
      const nodeId = requirementTree.getId(node.item);
      const clonedChildren = node.children
        .map(cloneNode)
        .filter((child): child is RequirementTreeNode<RequirementWithMeta> => Boolean(child));

      if (filteredRequirementIds.has(nodeId) || clonedChildren.length > 0) {
        return {
          item: node.item,
          children: clonedChildren
        };
      }

      return null;
    };

    const prunedRoots = requirementTree.roots
      .map(cloneNode)
      .filter((node): node is RequirementTreeNode<RequirementWithMeta> => Boolean(node));

    const nodeMap = new Map<string, RequirementTreeNode<RequirementWithMeta>>();
    const registerNode = (node: RequirementTreeNode<RequirementWithMeta>) => {
      const nodeId = requirementTree.getId(node.item);
      nodeMap.set(nodeId, node);
      node.children.forEach(registerNode);
    };
    prunedRoots.forEach(registerNode);

    return {
      roots: prunedRoots,
      nodeMap,
      getId: requirementTree.getId,
      getParentId: requirementTree.getParentId
    };
  }, [requirementTree, filteredRequirementIds]);

  const compareRequirements = useCallback(
    (a: RequirementWithMeta, b: RequirementWithMeta) => {
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
    },
    [sortOption]
  );

  const visibleRequirements = useMemo<RequirementWithHierarchyMeta[]>(() => {
    if (filteredTree.roots.length === 0) {
      return [];
    }

    const cloneNode = (
      node: RequirementTreeNode<RequirementWithMeta>
    ): RequirementTreeNode<RequirementWithMeta> => ({
      item: node.item,
      children: node.children.map(cloneNode)
    });

    const treeForSorting: RequirementTree<RequirementWithMeta> = {
      roots: filteredTree.roots.map(cloneNode),
      nodeMap: filteredTree.nodeMap,
      getId: filteredTree.getId,
      getParentId: filteredTree.getParentId
    };

    sortRequirementTree(treeForSorting.roots, compareRequirements);

    const flattened = flattenRequirementTree(treeForSorting);
    return flattened.map(({ item, depth, parentId, path }) => ({
      ...item,
      depth,
      parentId,
      path
    }));
  }, [filteredTree, compareRequirements]);

  const visibleRequirementEntities = useMemo(
    () => visibleRequirements.map((item) => item.requirement),
    [visibleRequirements]
  );

  const hasActiveFilters = useMemo(() => checkHasActiveFilters(filters), [filters]);

  const activeFilterCount = useMemo(() => {
    return (filters.search.trim() ? 1 : 0) + getActiveFilterCount(filters);
  }, [filters]);

  const handleResetFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setSearchInput('');
  }, []);

  const handleTogglePriority = useCallback((value: Requirement['priority']) => {
    setFilters((prev) => ({
      ...prev,
      priorities: toggleArrayValue(prev.priorities, value)
    }));
  }, []);

  const handleToggleState = useCallback((value: Requirement['state']) => {
    setFilters((prev) => ({
      ...prev,
      states: toggleArrayValue(prev.states, value)
    }));
  }, []);

  const handleToggleOwner = useCallback((value: string) => {
    setFilters((prev) => ({
      ...prev,
      owners: toggleArrayValue(prev.owners, value)
    }));
  }, []);

  const handleToggleLabel = useCallback((value: string) => {
    setFilters((prev) => ({
      ...prev,
      labels: toggleArrayValue(prev.labels, value)
    }));
  }, []);

  const handleEstimateFilterChange = useCallback((value: RequirementFilters['estimate']) => {
    setFilters((prev) => ({
      ...prev,
      estimate: value
    }));
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const handleSortChange = useCallback((value: SortOption) => {
    setSortOption(value);
  }, []);

  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    const trimmedSearch = filters.search.trim();

    if (trimmedSearch) {
      chips.push({
        key: 'search',
        label: `Testo: "${trimmedSearch}"`,
        onRemove: () => {
          setFilters((prev) => ({ ...prev, search: '' }));
          setSearchInput('');
        }
      });
    }

    filters.priorities.forEach((priority) => {
      chips.push({
        key: `priority-${priority}`,
        label: `Priorità: ${PRIORITY_LABEL[priority]}`,
        onRemove: () => handleTogglePriority(priority)
      });
    });

    filters.states.forEach((state) => {
      chips.push({
        key: `state-${state}`,
        label: `Stato: ${STATE_LABEL[state]}`,
        onRemove: () => handleToggleState(state)
      });
    });

    filters.owners.forEach((owner) => {
      chips.push({
        key: `owner-${owner}`,
        label: `Owner: ${owner}`,
        onRemove: () => handleToggleOwner(owner)
      });
    });

    filters.labels.forEach((label) => {
      chips.push({
        key: `label-${label}`,
        label: `Etichetta: ${label}`,
        onRemove: () => handleToggleLabel(label)
      });
    });

    if (filters.estimate !== 'all') {
      chips.push({
        key: 'estimate',
        label: filters.estimate === 'estimated' ? 'Solo stimati' : 'Da stimare',
        onRemove: () => handleEstimateFilterChange('all')
      });
    }

    return chips;
  }, [filters, handleTogglePriority, handleToggleState, handleToggleOwner, handleToggleLabel, handleEstimateFilterChange]);

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
      estimator: defaults.estimator ?? '',
      parent_req_id: null
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
      estimator: requirement.estimator ?? '',
      parent_req_id: requirement.parent_req_id ?? null
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
      const normalizedLabels = parseLabels(formData.labels).join(', ');
      const parentReqId = formData.parent_req_id ?? null;

      if (
        editingRequirement &&
        wouldCreateCycle(requirementTree, editingRequirement.req_id, parentReqId)
      ) {
        toast({
          variant: 'destructive',
          title: 'Dipendenza non valida',
          description: 'Un requisito non può dipendere da sé stesso o da un proprio discendente.'
        });
        setFormSubmitting(false);
        return;
      }

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
        parent_req_id: parentReqId,
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
      const childrenCount = childCountByParent.get(requirementPendingDeletion.req_id) ?? 0;
      if (childrenCount > 0) {
        toast({
          variant: 'destructive',
          title: 'Impossibile eliminare il requisito',
          description: 'Rimuovi o riassegna prima i requisiti figli collegati.'
        });
        setDeleteLoading(false);
        return;
      }
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
    const summary = requirementEstimates[requirement.req_id];
    const estimateDays = summary?.estimationDays ?? 0;
    const hasEstimate = Boolean(estimateDays > 0 || requirement.last_estimated_on);
    const loading = estimatesLoading;
    const updatedOn = summary?.estimate?.created_on ?? requirement.last_estimated_on;

    const stateClasses = loading
      ? 'border-muted bg-muted/50 text-muted-foreground dark:text-muted'
      : hasEstimate
        ? 'border-emerald-400 bg-emerald-100/80 text-emerald-900 dark:border-emerald-400/70 dark:bg-emerald-500/30 dark:text-emerald-50'
        : 'border-amber-400 bg-amber-100/80 text-amber-900 dark:border-amber-400/70 dark:bg-amber-500/25 dark:text-amber-50';

    const label = loading
      ? 'Caricamento...'
      : hasEstimate
        ? `Stima ${formatEstimateDays(estimateDays)} gg`
        : 'Stima non ancora effettuata';

    const layoutClasses =
      variant === 'compact'
        ? 'flex flex-col gap-0.5 rounded px-1.5 py-1 text-[10px]'
        : 'flex flex-col gap-1.5 rounded-lg px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between';

    const iconClasses = variant === 'compact' ? 'h-3 w-3' : 'h-3.5 w-3.5';

    return (
      <div className={`${layoutClasses} border font-medium ${stateClasses}`}>
        <div className="flex items-center gap-1">
          <BarChart3 className={iconClasses} />
          <span className="leading-tight">{label}</span>
        </div>
        {hasEstimate && updatedOn && variant === 'compact' && (
          <span className="text-[9px] font-normal opacity-75 leading-tight">
            Agg. {new Date(updatedOn).toLocaleDateString('it-IT', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {hasEstimate && updatedOn && variant !== 'compact' && (
          <span className="text-[11px] font-normal opacity-80">
            Aggiornata {new Date(updatedOn).toLocaleDateString('it-IT')}
          </span>
        )}
      </div>
    );
  };

  const handleActionAreaEvent = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const renderRequirementActions = (requirement: Requirement) => {
    const hasChildren = (childCountByParent.get(requirement.req_id) ?? 0) > 0;

    return (
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
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label={`Azioni per ${requirement.title}`}
              onClick={handleActionAreaEvent}
              onMouseDown={handleActionAreaEvent}
              onPointerDown={handleActionAreaEvent}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
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
              disabled={hasChildren}
              className={`text-destructive focus:text-destructive ${hasChildren ? 'opacity-60 cursor-not-allowed' : ''}`}
              onSelect={(event) => {
                event.stopPropagation();
                if (hasChildren) {
                  return;
                }
                openDeleteRequirementDialog(requirement);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {hasChildren ? 'Rimuovi prima i figli' : 'Elimina'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-gray-950 overflow-hidden flex flex-col p-3">
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col gap-2">
        {/* Header Ultra-Compatto - singola riga */}
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border shadow-sm shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button variant="ghost" size="sm" onClick={onBack} className="h-7 w-7 p-0 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground shrink-0">Liste /</span>
            <h1 className="text-base font-bold truncate">{list.name}</h1>
            {list.description && (
              <span className="text-xs text-muted-foreground truncate hidden md:inline">{list.description}</span>
            )}
            {list.technology && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">
                {list.technology}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={openListEditDialog}>
              <PenSquare className="h-3 w-3" />
              <span className="hidden sm:inline">Modifica</span>
            </Button>
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="h-7 bg-muted/50">
                <TabsTrigger
                  value="list"
                  className="text-xs h-6 px-2 gap-1 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  aria-current={activeTab === 'list' ? 'page' : undefined}
                >
                  <ListIcon className="h-3 w-3" />
                  <span className="hidden sm:inline">Lista</span>
                </TabsTrigger>
                <TabsTrigger
                  value="dashboard"
                  className="text-xs h-6 px-2 gap-1 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  aria-current={activeTab === 'dashboard' ? 'page' : undefined}
                >
                  <BarChart3 className="h-3 w-3" />
                  <span className="hidden sm:inline">Dashboard</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Dialog open={isFormDialogOpen} onOpenChange={handleFormDialogOpenChange}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={handleOpenCreateDialog} className="h-7 text-xs px-2">
                  <Plus className="h-3 w-3 mr-1" />
                  Nuovo
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
                    parentOptions={parentSelectOptions}
                    parentHelperText={
                      <span className="text-[10px] text-muted-foreground">
                        Le dipendenze influenzano il critical path della lista
                      </span>
                    }
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

            <Dialog open={isEditListDialogOpen} onOpenChange={setIsEditListDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Modifica metadati lista</DialogTitle>
                  <DialogDescription>
                    Aggiorna tecnologia, owner e note. I requisiti esistenti non verranno modificati.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmitListUpdate} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium" htmlFor="list-owner-field">
                        Owner
                      </label>
                      <Input
                        id="list-owner-field"
                        value={listFormData.owner}
                        onChange={(event) => updateListFormField('owner', event.target.value)}
                        placeholder="Nome referente"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium" htmlFor="list-period-field">
                        Periodo
                      </label>
                      <Input
                        id="list-period-field"
                        value={listFormData.period}
                        onChange={(event) => updateListFormField('period', event.target.value)}
                        placeholder="es. Q1 2025"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-medium" htmlFor="list-technology-field">
                        Tecnologia
                      </label>
                      <Input
                        id="list-technology-field"
                        value={listFormData.technology}
                        onChange={(event) => updateListFormField('technology', event.target.value)}
                        placeholder="es. Power Platform, Dynamics, SAP"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium" htmlFor="list-status-field">
                        Status
                      </label>
                      <Select
                        value={listFormData.status}
                        onValueChange={(value: List['status']) => updateListFormField('status', value)}
                      >
                        <SelectTrigger id="list-status-field">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allowDraftStatus && <SelectItem value="Draft">Draft</SelectItem>}
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" htmlFor="list-notes-field">
                      Note interne
                    </label>
                    <Textarea
                      id="list-notes-field"
                      value={listFormData.notes}
                      onChange={(event) => updateListFormField('notes', event.target.value)}
                      placeholder="Annotazioni per il team"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditListDialogOpen(false)}>
                      Annulla
                    </Button>
                    <Button type="submit" disabled={listUpdating}>
                      {listUpdating ? 'Salvataggio...' : 'Salva modifiche'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Contenuto Tab */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 min-h-0 flex flex-col">
          <TabsContent value="list" className="flex-1 min-h-0 overflow-auto">
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
                      value={searchInput}
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
                    onToggle={(value: string) => {
                      if (value === 'High' || value === 'Med' || value === 'Low') {
                        handleTogglePriority(value);
                      }
                    }}
                    triggerClassName="w-[160px]"
                  />

                  <FilterPopover
                    buttonLabel="Stato"
                    title="Stato del requisito"
                    options={STATE_OPTIONS}
                    selectedValues={filters.states}
                    onToggle={(value: string) => {
                      if (value === 'Proposed' || value === 'Selected' || value === 'Scheduled' || value === 'Done') {
                        handleToggleState(value);
                      }
                    }}
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
                    onValueChange={(value) => {
                      if (value === 'all' || value === 'estimated' || value === 'missing') {
                        handleEstimateFilterChange(value);
                      }
                    }}
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

                  <Select
                    value={sortOption}
                    onValueChange={(value) => {
                      const validValues: SortOption[] = ['created-desc', 'created-asc', 'priority', 'title', 'estimate-desc', 'estimate-asc'];
                      if (validValues.includes(value as SortOption)) {
                        handleSortChange(value as SortOption);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[190px]">
                      <SelectValue placeholder="Ordinamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created-desc">PiÃ¹ recenti</SelectItem>
                      <SelectItem value="created-asc">Meno recenti</SelectItem>
                      <SelectItem value="priority">Priorita </SelectItem>
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

                {estimatesLoading ? (
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
                  <div
                    className={viewMode === 'grid' ? 'grid gap-3 h-[calc(100vh-280px)]' : 'flex flex-col gap-3'}
                    style={viewMode === 'grid' ? {
                      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, min(280px, 100%)))',
                      gridAutoRows: '1fr',
                      gridAutoFlow: 'dense'
                    } : undefined}
                  >
                    {visibleRequirements.map(({ requirement, labels, depth, parentId }) => {
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
                      const parentTitle = parentId ? requirementMetaMap.get(parentId)?.requirement.title : null;
                      const childrenCount = childCountByParent.get(requirement.req_id) ?? 0;

                      if (viewMode === 'grid') {
                        return (
                          <Card
                            key={requirement.req_id}
                            className={`cursor-pointer bg-card hover:shadow-lg transition-all duration-200 h-full ${cardAccentClasses}`}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (!target.closest('[role="menu"]') && !target.closest('button[aria-haspopup]')) {
                                onSelectRequirement(requirement);
                              }
                            }}
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
                            <div className="flex flex-col h-full p-2">
                              {/* Header: Badge compatti e Menu */}
                              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Badge className={`${prioritySolidBadge} text-white text-[9px] font-semibold px-1.5 py-0 h-4 border-0`}>
                                    {requirement.priority === 'High' ? 'Alta' : requirement.priority === 'Med' ? 'Media' : 'Bassa'}
                                  </Badge>
                                  <Badge className={`${stateSolidBadge} text-white text-[9px] font-semibold px-1.5 py-0 h-4 border-0`}>
                                    {requirement.state === 'Proposed' ? 'Proposto' :
                                      requirement.state === 'Selected' ? 'Selezionato' :
                                        requirement.state === 'Scheduled' ? 'Pianificato' : 'Completato'}
                                  </Badge>
                                  {childrenCount > 0 && (
                                    <Badge variant="outline" className="text-[8px] uppercase tracking-wide px-1.5 py-0.5 border-dashed">
                                      Padre di {childrenCount}
                                    </Badge>
                                  )}
                                </div>
                                {renderRequirementActions(requirement)}
                              </div>

                              {/* Titolo prominente - occupa spazio centrale */}
                              <div className="flex-1 flex items-center justify-start mb-1.5">
                                <h3 className="text-xl font-bold text-foreground leading-tight line-clamp-2">
                                  {requirement.title}
                                </h3>
                              </div>
                              {parentTitle && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                                  <ArrowDownRight className="h-3 w-3" />
                                  <span className="truncate">
                                    Figlio di <span className="font-medium text-foreground">{parentTitle}</span>
                                  </span>
                                </div>
                              )}

                              {/* Box Stima compatto in fondo */}
                              <div className="mt-auto">
                                {renderEstimateHighlight(requirement, 'compact')}
                              </div>
                            </div>
                          </Card>
                        );
                      }

                      return (
                        <Card
                          key={requirement.req_id}
                          className={`group cursor-pointer border bg-card/70 transition-all duration-150 ${cardAccentClasses} hover:border-primary/40 hover:bg-primary/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
                          style={{ marginLeft: depth * 16 }}
                          onClick={(e) => {
                            // Verifica che il click non sia sul menu dropdown
                            const target = e.target as HTMLElement;
                            if (!target.closest('[role="menu"]') && !target.closest('button[aria-haspopup]')) {
                              onSelectRequirement(requirement);
                            }
                          }}
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
                                {depth > 0 && (
                                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Livello {depth}
                                  </span>
                                )}
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
                              {childrenCount > 0 && (
                                <Badge variant="outline" className="text-[10px] border-dashed">
                                  Padre di {childrenCount}
                                </Badge>
                              )}
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
                              {parentTitle && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <ArrowDownRight className="h-3 w-3" />
                                  <span className="truncate">
                                    Figlio di <span className="font-semibold text-foreground">{parentTitle}</span>
                                  </span>
                                </div>
                              )}
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
                )
                }
              </div>
            )}
          </TabsContent>

          <TabsContent value="dashboard" className="flex-1 min-h-0 overflow-auto">
            <DashboardView
              list={list}
              requirements={visibleRequirementEntities}
              onBack={onBack}
              onSelectRequirement={onSelectRequirement}
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
                    L&#39;operazione Ã¨ irreversibile.
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
    </div>
  );
}










