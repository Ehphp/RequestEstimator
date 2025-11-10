import { Requirement } from '@/types';
import { logger } from './logger';

/**
 * Type-safe requirement filters with strong typing
 */
export type RequirementFilters = {
    search: string;
    priorities: Requirement['priority'][];
    states: Requirement['state'][];
    owners: string[];
    labels: string[];
    estimate: EstimateFilterValue;
};

export type EstimateFilterValue = 'all' | 'estimated' | 'missing';

export type SortOption =
    | 'created-desc'
    | 'created-asc'
    | 'priority'
    | 'title'
    | 'estimate-desc'
    | 'estimate-asc';

export const ESTIMATE_OPTIONS = [
    { value: 'all' as const, label: 'Tutti' },
    { value: 'estimated' as const, label: 'Solo stimati' },
    { value: 'missing' as const, label: 'Da stimare' }
] as const;

export const INITIAL_FILTERS: RequirementFilters = {
    search: '',
    priorities: [],
    states: [],
    owners: [],
    labels: [],
    estimate: 'all'
};

/**
 * Type-safe array toggle utility with proper TypeScript inference
 */
export function toggleArrayValue<T>(array: readonly T[], value: T): T[] {
    if (!Array.isArray(array)) {
        logger.warn('toggleArrayValue received non-array:', array);
        return [value];
    }
    return array.includes(value)
        ? array.filter((item) => item !== value)
        : [...array, value];
}

/**
 * Creates a type-safe filter update function
 */
export function createFilterUpdater<K extends keyof RequirementFilters>(
    key: K,
    setter: React.Dispatch<React.SetStateAction<RequirementFilters>>
) {
    return (value: RequirementFilters[K]) => {
        setter((prev) => ({ ...prev, [key]: value }));
    };
}

/**
 * Creates a type-safe array toggle handler for filters
 */
export function createToggleHandler<K extends keyof RequirementFilters>(
    key: K,
    setter: React.Dispatch<React.SetStateAction<RequirementFilters>>
) {
    return (value: RequirementFilters[K] extends (infer U)[] ? U : never) => {
        setter((prev) => ({
            ...prev,
            [key]: toggleArrayValue(prev[key] as unknown[], value) as RequirementFilters[K]
        }));
    };
}

/**
 * Counts active filters (excluding search)
 */
export function countActiveFilters(filters: RequirementFilters): number {
    return (
        filters.priorities.length +
        filters.states.length +
        filters.owners.length +
        filters.labels.length +
        (filters.estimate !== 'all' ? 1 : 0)
    );
}

/**
 * Checks if any filter is active
 */
export function hasActiveFilters(filters: RequirementFilters): boolean {
    return (
        Boolean(filters.search.trim()) ||
        countActiveFilters(filters) > 0
    );
}

/**
 * Normalizes search string for comparison
 */
export function normalizeSearchString(str: string): string {
    return str.trim().toLowerCase();
}
