import { describe, it, expect } from 'vitest';
import {
    roundHalfUp,
    calculateDriverMultiplier,
    calculateRiskScore,
    getContingencyPercentage,
    calculateEstimate
} from '../calculations';
import type { Activity } from '../../types';

describe('calculations.ts', () => {
    describe('roundHalfUp', () => {
        it('should round up at 0.5', () => {
            expect(roundHalfUp(2.5, 0)).toBe(3);
            expect(roundHalfUp(1.5, 0)).toBe(2);
        });

        it('should round normally below 0.5', () => {
            expect(roundHalfUp(2.4, 0)).toBe(2);
            expect(roundHalfUp(1.3, 0)).toBe(1);
        });

        it('should respect decimal places', () => {
            expect(roundHalfUp(2.555, 2)).toBe(2.56);
            expect(roundHalfUp(3.1415, 3)).toBe(3.142);
        });
    });

    describe('calculateDriverMultiplier', () => {
        it('should calculate baseline multiplier (all Medium/standard)', () => {
            const result = calculateDriverMultiplier('Medium', '2 env', 'Medium', '2-3 team');
            expect(result).toBe(1.0 * 1.0 * 1.0 * 1.0); // 1.0
        });

        it('should calculate high complexity multiplier', () => {
            const result = calculateDriverMultiplier('High', '3 env', 'Low', '4+ team');
            // High=1.5, 3env=1.3, Low reuse=1.2, 4+team=1.3
            expect(result).toBeCloseTo(1.5 * 1.3 * 1.2 * 1.3, 3);
        });

        it('should calculate low complexity multiplier', () => {
            const result = calculateDriverMultiplier('Low', '1 env', 'High', '1 team');
            // Low=0.8, 1env=0.7, High reuse=0.7, 1team=0.8
            expect(result).toBeCloseTo(0.8 * 0.7 * 0.7 * 0.8, 3);
        });

        it('should throw error for invalid driver values', () => {
            expect(() => {
                calculateDriverMultiplier('Invalid', '2 env', 'Medium', '2-3 team');
            }).toThrow('Driver mancanti per il calcolo');
        });
    });

    describe('calculateRiskScore', () => {
        it('should return 0 for no risks', () => {
            expect(calculateRiskScore([])).toBe(0);
        });

        it('should sum risk weights correctly', () => {
            // Assuming catalog has risks with known weights
            // R001=3, R002=5, R003=4, R004=5, R005=4 (from catalog.ts)
            expect(calculateRiskScore(['R001'])).toBe(3);
            expect(calculateRiskScore(['R001', 'R002'])).toBe(8);
            expect(calculateRiskScore(['R001', 'R002', 'R003'])).toBe(12);
        });

        it('should handle non-existent risk IDs gracefully', () => {
            expect(calculateRiskScore(['NON_EXISTENT'])).toBe(0);
        });
    });

    describe('getContingencyPercentage', () => {
        it('should return 0% for zero risk', () => {
            expect(getContingencyPercentage(0)).toBe(0);
        });

        it('should return 10% for low risk (1-10)', () => {
            expect(getContingencyPercentage(1)).toBe(0.10);
            expect(getContingencyPercentage(5)).toBe(0.10);
            expect(getContingencyPercentage(10)).toBe(0.10);
        });

        it('should return 20% for medium risk (11-20)', () => {
            expect(getContingencyPercentage(11)).toBe(0.20);
            expect(getContingencyPercentage(15)).toBe(0.20);
            expect(getContingencyPercentage(20)).toBe(0.20);
        });

        it('should return 35% for high risk (21+)', () => {
            expect(getContingencyPercentage(21)).toBe(0.35);
            expect(getContingencyPercentage(30)).toBe(0.35);
            expect(getContingencyPercentage(100)).toBe(0.35);
        });

        it('should cap at 50% maximum', () => {
            // Even if catalog is modified to return > 50%, it should cap
            expect(getContingencyPercentage(1000)).toBeLessThanOrEqual(0.50);
        });
    });

    describe('calculateEstimate', () => {
        const mockActivities: Activity[] = [
            {
                activity_code: 'TEST_001',
                display_name: 'Test Activity 1',
                driver_group: 'Test',
                base_days: 2.0,
                helper_short: 'Test',
                helper_long: 'Test description',
                status: 'Active'
            },
            {
                activity_code: 'TEST_002',
                display_name: 'Test Activity 2',
                driver_group: 'Test',
                base_days: 3.0,
                helper_short: 'Test',
                helper_long: 'Test description',
                status: 'Active'
            }
        ];

        it('should calculate complete estimate with baseline values', () => {
            const result = calculateEstimate(
                mockActivities,
                'Medium',
                '2 env',
                'Medium',
                '2-3 team',
                [],
                false
            );

            expect(result.activities_base_days).toBe(5.0); // 2 + 3
            expect(result.driver_multiplier).toBe(1.0); // baseline
            expect(result.subtotal_days).toBe(5.0); // 5 * 1.0
            expect(result.risk_score).toBe(0);
            expect(result.contingency_pct).toBe(0);
            expect(result.contingency_days).toBe(0);
            expect(result.total_days).toBe(5.0);
        });

        it('should calculate estimate with high complexity', () => {
            const result = calculateEstimate(
                mockActivities,
                'High',
                '3 env',
                'Low',
                '4+ team',
                [],
                false
            );

            const expectedMultiplier = 1.5 * 1.3 * 1.2 * 1.3; // 3.042
            const expectedSubtotal = 5.0 * expectedMultiplier; // 15.21

            expect(result.activities_base_days).toBe(5.0);
            expect(result.driver_multiplier).toBeCloseTo(expectedMultiplier, 2);
            expect(result.subtotal_days).toBeCloseTo(expectedSubtotal, 2);
        });

        it('should calculate estimate with risks', () => {
            const result = calculateEstimate(
                mockActivities,
                'Medium',
                '2 env',
                'Medium',
                '2-3 team',
                ['R001', 'R002'], // Total weight = 8
                false
            );

            expect(result.risk_score).toBe(8);
            expect(result.contingency_pct).toBe(0.10); // Low risk band
            expect(result.contingency_days).toBeCloseTo(0.5, 1); // 10% of 5 days
            expect(result.total_days).toBeCloseTo(5.5, 1);
        });

        it('should include version information', () => {
            const result = calculateEstimate(
                mockActivities,
                'Medium',
                '2 env',
                'Medium',
                '2-3 team',
                [],
                false
            );

            expect(result.catalog_version).toBe('v1.0');
            expect(result.drivers_version).toBe('v1.0');
            expect(result.riskmap_version).toBe('v1.0');
        });
    });
});
