import { describe, it, expect } from 'vitest';
import {
    validateEstimate,
    isValidComplexity,
    isValidEnvironments,
    isValidReuse,
    isValidStakeholders,
    assertValidEstimateForSave,
    VALID_COMPLEXITY,
    VALID_ENVIRONMENTS,
    VALID_REUSE,
    VALID_STAKEHOLDERS
} from '../validation';
import type { Activity, Estimate } from '../../types';

describe('validation.ts', () => {
    describe('Type Guards', () => {
        describe('isValidComplexity', () => {
            it('should accept valid complexity values', () => {
                expect(isValidComplexity('Low')).toBe(true);
                expect(isValidComplexity('Medium')).toBe(true);
                expect(isValidComplexity('High')).toBe(true);
            });

            it('should reject invalid complexity values', () => {
                expect(isValidComplexity('Invalid')).toBe(false);
                expect(isValidComplexity('')).toBe(false);
                expect(isValidComplexity('low')).toBe(false); // case sensitive
            });
        });

        describe('isValidEnvironments', () => {
            it('should accept valid environment values', () => {
                expect(isValidEnvironments('1 env')).toBe(true);
                expect(isValidEnvironments('2 env')).toBe(true);
                expect(isValidEnvironments('3 env')).toBe(true);
            });

            it('should reject invalid environment values', () => {
                expect(isValidEnvironments('4 env')).toBe(false);
                expect(isValidEnvironments('Invalid')).toBe(false);
            });
        });

        describe('isValidReuse', () => {
            it('should accept valid reuse values', () => {
                expect(isValidReuse('Low')).toBe(true);
                expect(isValidReuse('Medium')).toBe(true);
                expect(isValidReuse('High')).toBe(true);
            });

            it('should reject invalid reuse values', () => {
                expect(isValidReuse('None')).toBe(false);
                expect(isValidReuse('')).toBe(false);
            });
        });

        describe('isValidStakeholders', () => {
            it('should accept valid stakeholder values', () => {
                expect(isValidStakeholders('1 team')).toBe(true);
                expect(isValidStakeholders('2-3 team')).toBe(true);
                expect(isValidStakeholders('4+ team')).toBe(true);
            });

            it('should reject invalid stakeholder values', () => {
                expect(isValidStakeholders('5 team')).toBe(false);
                expect(isValidStakeholders('Invalid')).toBe(false);
            });
        });
    });

    describe('validateEstimate', () => {
        const mockActivities: Activity[] = [
            {
                activity_code: 'TEST',
                display_name: 'Test',
                driver_group: 'Test',
                base_days: 1,
                helper_short: 'Test',
                helper_long: 'Test',
                status: 'Active'
            }
        ];

        describe('Basic validation', () => {
            it('should pass with all valid inputs', () => {
                const errors = validateEstimate(
                    'Medium',
                    '2 env',
                    'Medium',
                    '2-3 team',
                    mockActivities
                );
                expect(errors).toEqual([]);
            });

            it('should fail when complexity is missing', () => {
                const errors = validateEstimate(
                    '',
                    '2 env',
                    'Medium',
                    '2-3 team',
                    mockActivities
                );
                expect(errors).toContain('Seleziona complessità');
            });

            it('should fail when environments is missing', () => {
                const errors = validateEstimate(
                    'Medium',
                    '',
                    'Medium',
                    '2-3 team',
                    mockActivities
                );
                expect(errors).toContain('Seleziona ambienti');
            });

            it('should fail when reuse is missing', () => {
                const errors = validateEstimate(
                    'Medium',
                    '2 env',
                    '',
                    '2-3 team',
                    mockActivities
                );
                expect(errors).toContain('Seleziona livello di riutilizzo');
            });

            it('should fail when stakeholders is missing', () => {
                const errors = validateEstimate(
                    'Medium',
                    '2 env',
                    'Medium',
                    '',
                    mockActivities
                );
                expect(errors).toContain('Seleziona numero stakeholder');
            });

            it('should fail when activities are missing', () => {
                const errors = validateEstimate(
                    'Medium',
                    '2 env',
                    'Medium',
                    '2-3 team',
                    []
                );
                expect(errors).toContain('Seleziona almeno un\'attività');
            });

            it('should accumulate multiple errors', () => {
                const errors = validateEstimate('', '', '', '', []);
                expect(errors.length).toBeGreaterThanOrEqual(4);
            });
        });

        describe('Strict mode', () => {
            it('should provide detailed error messages in strict mode', () => {
                const errors = validateEstimate(
                    'Invalid',
                    '2 env',
                    'Medium',
                    '2-3 team',
                    mockActivities,
                    { strictMode: true }
                );

                expect(errors[0]).toContain('deve essere');
                expect(errors[0]).toContain(VALID_COMPLEXITY.join(', '));
            });

            it('should provide simple error messages in normal mode', () => {
                const errors = validateEstimate(
                    'Invalid',
                    '2 env',
                    'Medium',
                    '2-3 team',
                    mockActivities,
                    { strictMode: false }
                );

                expect(errors[0]).toBe('Complexity non valida');
            });
        });

        describe('Options', () => {
            it('should skip activity validation when validateActivities=false', () => {
                const errors = validateEstimate(
                    'Medium',
                    '2 env',
                    'Medium',
                    '2-3 team',
                    [],
                    { validateActivities: false }
                );

                expect(errors).toEqual([]);
            });

            it('should validate activities when validateActivities=true (default)', () => {
                const errors = validateEstimate(
                    'Medium',
                    '2 env',
                    'Medium',
                    '2-3 team',
                    []
                );

                expect(errors).toContain('Seleziona almeno un\'attività');
            });
        });
    });

    describe('assertValidEstimateForSave', () => {
        it('should pass with valid complete estimate', () => {
            const estimate: Partial<Estimate> = {
                complexity: 'Medium',
                environments: '2 env',
                reuse: 'Medium',
                stakeholders: '2-3 team'
            };

            expect(() => {
                assertValidEstimateForSave(estimate);
            }).not.toThrow();
        });

        it('should throw with invalid complexity', () => {
            const estimate: Partial<Estimate> = {
                complexity: 'Invalid' as unknown as Estimate['complexity'],
                environments: '2 env',
                reuse: 'Medium',
                stakeholders: '2-3 team'
            };

            expect(() => {
                assertValidEstimateForSave(estimate);
            }).toThrow('Validazione estimate fallita');
        });

        it('should throw with missing fields', () => {
            const estimate: Partial<Estimate> = {
                complexity: 'Medium'
                // Missing other required fields
            };

            expect(() => {
                assertValidEstimateForSave(estimate);
            }).toThrow('Validazione estimate fallita');
        });

        it('should include all errors in message', () => {
            const estimate: Partial<Estimate> = {};

            try {
                assertValidEstimateForSave(estimate);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toContain('Complexity');
                expect((error as Error).message).toContain('Environments');
                expect((error as Error).message).toContain('Reuse');
                expect((error as Error).message).toContain('Stakeholders');
            }
        });
    });
});
