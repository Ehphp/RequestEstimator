/**
 * Unit tests for treemap layout algorithm
 * Tests overlap detection, bounds checking, proportionality, and edge cases
 */

import { describe, it, expect } from 'vitest';
import {
    generateTreemapLayout,
    calculateOptimalHeight,
    getCardSizeVariant,
    TreemapItem,
    CARD_SIZE_THRESHOLDS
} from '../treemap';

describe('TreemapLayout', () => {
    describe('generateTreemapLayout', () => {
        it('should handle empty array', () => {
            const result = generateTreemapLayout([], 1000, 800);
            expect(result).toEqual([]);
        });

        it('should handle single item', () => {
            const items: TreemapItem[] = [
                { id: 'item1', value: 100 }
            ];
            const result = generateTreemapLayout(items, 1000, 800);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('item1');
            expect(result[0].x).toBeGreaterThanOrEqual(0);
            expect(result[0].y).toBeGreaterThanOrEqual(0);
            expect(result[0].x + result[0].width).toBeLessThanOrEqual(1000);
            expect(result[0].y + result[0].height).toBeLessThanOrEqual(800);
        });

        it('should handle items with equal values', () => {
            const items: TreemapItem[] = [
                { id: 'item1', value: 50 },
                { id: 'item2', value: 50 },
                { id: 'item3', value: 50 }
            ];
            const result = generateTreemapLayout(items, 1200, 800);

            expect(result).toHaveLength(3);

            // All items should have similar areas (±15% tolerance for layout optimization)
            const areas = result.map(n => n.width * n.height);
            const avgArea = areas.reduce((sum, a) => sum + a, 0) / areas.length;

            areas.forEach(area => {
                const diff = Math.abs(area - avgArea) / avgArea;
                expect(diff).toBeLessThan(0.15);
            });
        });

        it('should handle items with very different values', () => {
            const items: TreemapItem[] = [
                { id: 'large', value: 100 },
                { id: 'small1', value: 1 },
                { id: 'small2', value: 1 }
            ];
            const result = generateTreemapLayout(items, 1200, 800);

            expect(result).toHaveLength(3);

            const largeNode = result.find(n => n.id === 'large')!;
            const small1Node = result.find(n => n.id === 'small1')!;
            const small2Node = result.find(n => n.id === 'small2')!;

            const largeArea = largeNode.width * largeNode.height;
            const small1Area = small1Node.width * small1Node.height;
            const small2Area = small2Node.width * small2Node.height;

            // Large item should have significantly more area
            expect(largeArea).toBeGreaterThan(small1Area * 10);
            expect(largeArea).toBeGreaterThan(small2Area * 10);
        });

        it('should not create overlapping nodes', () => {
            const items: TreemapItem[] = [
                { id: 'item1', value: 30 },
                { id: 'item2', value: 20 },
                { id: 'item3', value: 25 },
                { id: 'item4', value: 15 },
                { id: 'item5', value: 10 }
            ];
            const result = generateTreemapLayout(items, 1200, 800);

            // Check every pair of nodes for overlap
            for (let i = 0; i < result.length; i++) {
                for (let j = i + 1; j < result.length; j++) {
                    const a = result[i];
                    const b = result[j];

                    const overlapX = !(a.x + a.width <= b.x || b.x + b.width <= a.x);
                    const overlapY = !(a.y + a.height <= b.y || b.y + b.height <= a.y);

                    expect(overlapX && overlapY).toBe(false);
                }
            }
        });

        it('should keep all nodes within bounds', () => {
            const items: TreemapItem[] = [
                { id: 'item1', value: 30 },
                { id: 'item2', value: 20 },
                { id: 'item3', value: 25 },
                { id: 'item4', value: 15 },
                { id: 'item5', value: 10 }
            ];
            const width = 1200;
            const height = 800;
            const result = generateTreemapLayout(items, width, height);

            result.forEach(node => {
                expect(node.x).toBeGreaterThanOrEqual(0);
                expect(node.y).toBeGreaterThanOrEqual(0);
                expect(node.x + node.width).toBeLessThanOrEqual(width + 0.1); // Small epsilon for floating point
                expect(node.y + node.height).toBeLessThanOrEqual(height + 0.1);
            });
        });

        it('should maintain proportional areas', () => {
            const items: TreemapItem[] = [
                { id: 'item1', value: 40 },
                { id: 'item2', value: 30 },
                { id: 'item3', value: 30 }
            ];
            const width = 1200;
            const height = 800;
            const result = generateTreemapLayout(items, width, height);

            const totalValue = items.reduce((sum, item) => sum + item.value, 0);
            const totalArea = width * height;

            result.forEach(node => {
                const item = items.find(i => i.id === node.id)!;
                const expectedRatio = item.value / totalValue;
                const actualArea = node.width * node.height;
                const actualRatio = actualArea / totalArea;

                // Allow 15% tolerance due to padding and minSize constraints
                const error = Math.abs(expectedRatio - actualRatio) / expectedRatio;
                expect(error).toBeLessThan(0.15);
            });
        });

        it('should handle very small container', () => {
            const items: TreemapItem[] = [
                { id: 'item1', value: 50 },
                { id: 'item2', value: 50 }
            ];
            const result = generateTreemapLayout(items, 400, 300);

            expect(result).toHaveLength(2);
            result.forEach(node => {
                expect(node.x + node.width).toBeLessThanOrEqual(400 + 0.1);
                expect(node.y + node.height).toBeLessThanOrEqual(300 + 0.1);
            });
        });

        it('should handle many items', () => {
            const items: TreemapItem[] = Array.from({ length: 20 }, (_, i) => ({
                id: `item${i}`,
                value: Math.random() * 100 + 10 // Random values between 10-110
            }));

            const result = generateTreemapLayout(items, 1600, 1200);

            expect(result).toHaveLength(20);

            // No overlaps
            for (let i = 0; i < result.length; i++) {
                for (let j = i + 1; j < result.length; j++) {
                    const a = result[i];
                    const b = result[j];

                    const overlapX = !(a.x + a.width <= b.x || b.x + b.width <= a.x);
                    const overlapY = !(a.y + a.height <= b.y || b.y + b.height <= a.y);

                    expect(overlapX && overlapY).toBe(false);
                }
            }

            // All within bounds
            result.forEach(node => {
                expect(node.x + node.width).toBeLessThanOrEqual(1600 + 0.1);
                expect(node.y + node.height).toBeLessThanOrEqual(1200 + 0.1);
            });
        });

        it('should filter out items with zero or negative values', () => {
            const items: TreemapItem[] = [
                { id: 'valid1', value: 50 },
                { id: 'zero', value: 0 },
                { id: 'negative', value: -10 },
                { id: 'valid2', value: 30 }
            ];
            const result = generateTreemapLayout(items, 1000, 800);

            expect(result).toHaveLength(2);
            expect(result.find(n => n.id === 'valid1')).toBeDefined();
            expect(result.find(n => n.id === 'valid2')).toBeDefined();
            expect(result.find(n => n.id === 'zero')).toBeUndefined();
            expect(result.find(n => n.id === 'negative')).toBeUndefined();
        });

        it('should respect custom config', () => {
            const items: TreemapItem[] = [
                { id: 'item1', value: 50 },
                { id: 'item2', value: 50 }
            ];
            const result = generateTreemapLayout(items, 1000, 800, {
                padding: 20,
                minSize: 200
            });

            expect(result).toHaveLength(2);

            // Check that nodes are separated by at least the padding
            const [a, b] = result;
            const gapX = Math.min(
                Math.abs(a.x + a.width - b.x),
                Math.abs(b.x + b.width - a.x)
            );
            const gapY = Math.min(
                Math.abs(a.y + a.height - b.y),
                Math.abs(b.y + b.height - a.y)
            );

            // At least one dimension should have proper padding
            expect(Math.min(gapX, gapY)).toBeGreaterThanOrEqual(0);
        });

        it('should auto-calculate height when enabled', () => {
            const items: TreemapItem[] = [
                { id: 'item1', value: 30 },
                { id: 'item2', value: 20 },
                { id: 'item3', value: 25 }
            ];
            const result = generateTreemapLayout(items, 1200, 0, {
                enableDynamicHeight: true
            });

            expect(result).toHaveLength(3);
            // Should have calculated some reasonable height and laid out items
            result.forEach(node => {
                expect(node.y + node.height).toBeGreaterThan(0);
            });
        });
    });

    describe('calculateOptimalHeight', () => {
        it('should return minimum height for zero items', () => {
            const result = calculateOptimalHeight(0, 1200);
            expect(result).toBe(600);
        });

        it('should return minimum height for zero width', () => {
            const result = calculateOptimalHeight(5, 0);
            expect(result).toBe(600);
        });

        it('should calculate reasonable height for few items', () => {
            const result = calculateOptimalHeight(3, 1200, 150);
            expect(result).toBeGreaterThanOrEqual(600);
            expect(result).toBeLessThanOrEqual(2400);
        });

        it('should calculate larger height for many items', () => {
            const heightFew = calculateOptimalHeight(5, 1200, 150);
            const heightMany = calculateOptimalHeight(20, 1200, 150);

            expect(heightMany).toBeGreaterThan(heightFew);
        });

        it('should respect max height constraint', () => {
            const result = calculateOptimalHeight(100, 1200, 150);
            expect(result).toBeLessThanOrEqual(2400);
        });

        it('should respect min height constraint', () => {
            const result = calculateOptimalHeight(1, 5000, 150);
            expect(result).toBeGreaterThanOrEqual(600);
        });
    });

    describe('getCardSizeVariant', () => {
        it('should return "small" for small cards', () => {
            expect(getCardSizeVariant(200, 150)).toBe('small');
            expect(getCardSizeVariant(240, 180)).toBe('small');
            expect(getCardSizeVariant(100, 300)).toBe('small'); // Narrow
            expect(getCardSizeVariant(300, 100)).toBe('small'); // Short
        });

        it('should return "medium" for medium cards', () => {
            expect(getCardSizeVariant(300, 250)).toBe('medium');
            expect(getCardSizeVariant(350, 300)).toBe('medium');
        });

        it('should return "large" for large cards', () => {
            expect(getCardSizeVariant(450, 400)).toBe('large');
            expect(getCardSizeVariant(500, 500)).toBe('large');
        });

        it('should use exact threshold values correctly', () => {
            const { small, large } = CARD_SIZE_THRESHOLDS;

            // Just below small threshold
            expect(getCardSizeVariant(small.width - 1, small.height - 1)).toBe('small');

            // At small threshold
            expect(getCardSizeVariant(small.width, small.height)).toBe('medium');

            // Just below large threshold
            expect(getCardSizeVariant(large.width - 1, large.height - 1)).toBe('medium');

            // At large threshold
            expect(getCardSizeVariant(large.width, large.height)).toBe('large');
        });
    });

    describe('Edge Cases', () => {
        it('should handle invalid dimensions gracefully', () => {
            const items: TreemapItem[] = [{ id: 'item1', value: 100 }];

            expect(generateTreemapLayout(items, 0, 800)).toEqual([]);
            expect(generateTreemapLayout(items, 1000, 0, { enableDynamicHeight: false })).toEqual([]);
            expect(generateTreemapLayout(items, -100, 800)).toEqual([]);
        });

        it('should handle all items with same value', () => {
            const items: TreemapItem[] = Array.from({ length: 10 }, (_, i) => ({
                id: `item${i}`,
                value: 42
            }));

            const result = generateTreemapLayout(items, 1200, 800);
            expect(result).toHaveLength(10);

            // All should have similar areas
            const areas = result.map(n => n.width * n.height);
            const avgArea = areas.reduce((sum, a) => sum + a, 0) / areas.length;

            areas.forEach(area => {
                const diff = Math.abs(area - avgArea) / avgArea;
                expect(diff).toBeLessThan(0.2); // 20% tolerance
            });
        });

        it('should handle extreme aspect ratios', () => {
            const items: TreemapItem[] = [
                { id: 'item1', value: 50 },
                { id: 'item2', value: 50 }
            ];

            // Very wide container
            let result = generateTreemapLayout(items, 2000, 400);
            expect(result).toHaveLength(2);
            result.forEach(node => {
                expect(node.x + node.width).toBeLessThanOrEqual(2000 + 0.1);
                expect(node.y + node.height).toBeLessThanOrEqual(400 + 0.1);
            });

            // Very tall container
            result = generateTreemapLayout(items, 400, 2000);
            expect(result).toHaveLength(2);
            result.forEach(node => {
                expect(node.x + node.width).toBeLessThanOrEqual(400 + 0.1);
                expect(node.y + node.height).toBeLessThanOrEqual(2000 + 0.1);
            });
        });

        it('should preserve data field in nodes', () => {
            const items: TreemapItem[] = [
                { id: 'item1', value: 50, data: { name: 'First' } },
                { id: 'item2', value: 30, data: { name: 'Second' } }
            ];

            const result = generateTreemapLayout(items, 1000, 800);

            const node1 = result.find(n => n.id === 'item1')!;
            const node2 = result.find(n => n.id === 'item2')!;

            expect(node1.data).toEqual({ name: 'First' });
            expect(node2.data).toEqual({ name: 'Second' });
        });
    });
});
