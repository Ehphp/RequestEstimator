/**
 * Validation utilities for type-safe operations
 * Centralizes all type guards and validation logic
 */

import type { Estimate, Activity } from '../types';

// Valid enum values for Estimate fields
export const VALID_COMPLEXITY = ['Low', 'Medium', 'High'] as const;
export const VALID_ENVIRONMENTS = ['1 env', '2 env', '3 env'] as const;
export const VALID_REUSE = ['Low', 'Medium', 'High'] as const;
export const VALID_STAKEHOLDERS = ['1 team', '2-3 team', '4+ team'] as const;

export const VALID_PRIORITY = ['High', 'Med', 'Low'] as const;
export const VALID_STATE = ['Proposed', 'Selected', 'Scheduled', 'Done'] as const;
export const VALID_LIST_STATUS = ['Draft', 'Active', 'Archived'] as const;

// Type guards
export function isValidComplexity(value: string): value is Estimate['complexity'] {
    return (VALID_COMPLEXITY as readonly string[]).includes(value);
}

export function isValidEnvironments(value: string): value is Estimate['environments'] {
    return (VALID_ENVIRONMENTS as readonly string[]).includes(value);
}

export function isValidReuse(value: string): value is Estimate['reuse'] {
    return (VALID_REUSE as readonly string[]).includes(value);
}

export function isValidStakeholders(value: string): value is Estimate['stakeholders'] {
    return (VALID_STAKEHOLDERS as readonly string[]).includes(value);
}

/**
 * Validation options for estimate validation
 */
export interface EstimateValidationOptions {
    /** Whether to validate activities (default: true) */
    validateActivities?: boolean;
    /** Whether to use strict validation with detailed error messages (default: false) */
    strictMode?: boolean;
}

/**
 * UNIFIED VALIDATION: Validates all estimate inputs with flexible options
 * Consolidates logic from validateEstimateInputs and validateEstimateDrivers
 * 
 * @param complexity - Complexity driver value
 * @param environments - Environments driver value
 * @param reuse - Reuse driver value
 * @param stakeholders - Stakeholders driver value
 * @param selectedActivities - Array of selected activities (optional if validateActivities=false)
 * @param options - Validation options
 * @returns Array of error messages (empty if valid)
 */
export function validateEstimate(
    complexity: string,
    environments: string,
    reuse: string,
    stakeholders: string,
    selectedActivities?: Activity[],
    options: EstimateValidationOptions = {}
): string[] {
    const { validateActivities = true, strictMode = false } = options;
    const errors: string[] = [];




    // Validate complexity
    if (!complexity) {
        errors.push('Seleziona complessità');
    } else if (!isValidComplexity(complexity)) {
        errors.push(strictMode
            ? `Complexity non valida: deve essere ${VALID_COMPLEXITY.join(', ')}`
            : 'Complexity non valida'
        );
    }

    // Validate environments
    if (!environments) {
        errors.push('Seleziona ambienti');
    } else if (!isValidEnvironments(environments)) {
        errors.push(strictMode
            ? `Environments non valida: deve essere ${VALID_ENVIRONMENTS.join(', ')}`
            : 'Environments non valida'
        );
    }

    // Validate reuse
    if (!reuse) {
        errors.push('Seleziona livello di riutilizzo');
    } else if (!isValidReuse(reuse)) {
        errors.push(strictMode
            ? `Reuse non valida: deve essere ${VALID_REUSE.join(', ')}`
            : 'Reuse non valida'
        );
    }


    // Stakeholders optional, activities obbligatorie sempre
    if (strictMode) {
        if (!stakeholders) {
            // Stakeholders richiesto solo in strictMode
            errors.push('Seleziona numero stakeholder');
        } else if (!isValidStakeholders(stakeholders)) {
            errors.push(`Stakeholders non valida: deve essere ${VALID_STAKEHOLDERS.join(', ')}`);
        }
    } else {
        if (stakeholders && !isValidStakeholders(stakeholders)) {
            errors.push('Stakeholders non valida');
        }
    }
    // Attività sempre obbligatorie
    if (validateActivities) {
        if (!selectedActivities || selectedActivities.length === 0) {
            errors.push("Seleziona almeno un'attività");
        }
    }

    return errors;
}

/**
 * DEPRECATED: Use validateEstimate instead
 * @deprecated Use validateEstimate with strictMode: true
 */
export function validateEstimateDrivers(
    complexity: string,
    environments: string,
    reuse: string,
    stakeholders: string
): string[] {
    return validateEstimate(complexity, environments, reuse, stakeholders, undefined, {
        validateActivities: false,
        strictMode: true
    });
}

/**
 * Validates estimate data before save
 * @returns true if valid, throws Error if not
 */
export function assertValidEstimateForSave(estimate: Partial<Estimate>): asserts estimate is Estimate {
    const errors = validateEstimate(
        estimate.complexity || '',
        estimate.environments || '',
        estimate.reuse || '',
        estimate.stakeholders || '',
        undefined,
        { validateActivities: false, strictMode: true }
    );

    if (errors.length > 0) {
        throw new Error(`Validazione estimate fallita: ${errors.join(', ')}`);
    }
}
