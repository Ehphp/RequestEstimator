import { useState } from 'react';
import { DefaultSource } from '@/types';

/**
 * Custom hook for managing default sources and field override tracking
 * Extracted from duplicated pattern in EstimateEditor and RequirementsList
 * 
 * @returns Object with state and helpers for default tracking
 */
export function useDefaultTracking() {
    const [defaultSources, setDefaultSources] = useState<DefaultSource[]>([]);
    const [overriddenFields, setOverriddenFields] = useState<Record<string, boolean>>({});

    /**
     * Mark a field as manually overridden by the user
     */
    const markAsOverridden = (field: string) => {
        setOverriddenFields(prev => ({ ...prev, [field]: true }));
    };

    /**
     * Reset override status for a field (return to default)
     */
    const resetOverride = (field: string) => {
        setOverriddenFields(prev => {
            const updated = { ...prev };
            delete updated[field];
            return updated;
        });
    };

    /**
     * Check if a field is currently overridden
     */
    const isOverridden = (field: string): boolean => {
        return overriddenFields[field] === true;
    };

    /**
     * Get the default source for a specific field
     */
    const getDefaultSource = (field: string): DefaultSource | undefined => {
        return defaultSources.find(src => src.field === field);
    };

    return {
        defaultSources,
        setDefaultSources,
        overriddenFields,
        setOverriddenFields,
        markAsOverridden,
        resetOverride,
        isOverridden,
        getDefaultSource
    };
}
