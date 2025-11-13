import { describe, it, expect } from 'vitest';
import { buildActivityMapFromCatalogs, mergeActivitiesWithOverrides } from '../lib/utils';
import type { Activity, ListActivityCatalog } from '../types';

describe('utils.buildActivityMapFromCatalogs & mergeActivitiesWithOverrides', () => {
    const globalActivities: Activity[] = [
        { activity_code: 'A1', display_name: 'Global A1', driver_group: 'G1', base_days: 1, helper_short: '', helper_long: '', status: 'Active' },
        { activity_code: 'A2', display_name: 'Global A2', driver_group: 'G2', base_days: 2, helper_short: '', helper_long: '', status: 'Active' }
    ];

    it('applies per-list catalog entries overriding global ones', () => {
        const listCatalog: ListActivityCatalog = {
            list_id: 'L1',
            technology: 'T1',
            catalog: {
                groups: [
                    { group: 'G1', activities: [{ activity_code: 'A1', display_name: 'List A1', driver_group: 'G1', base_days: 3, helper_short: '', helper_long: '', status: 'Active' }] }
                ]
            }
        };

        const map = buildActivityMapFromCatalogs(listCatalog, globalActivities);
        expect(map.get('A1')?.display_name).toBe('List A1');
        expect(map.get('A1')?.base_days).toBe(3);
        // A2 should come from global
        expect(map.get('A2')?.display_name).toBe('Global A2');
    });

    it('mergeActivitiesWithOverrides uses override_days when provided', () => {
        const map = buildActivityMapFromCatalogs(null, globalActivities);
        const activities = mergeActivitiesWithOverrides(map, ['A1', 'A2'], [
            { activity_code: 'A1', override_days: 4 }
        ]);

        const a1 = activities.find(a => a.activity_code === 'A1');
        expect(a1).toBeDefined();
        expect(a1!.base_days).toBe(4);
        const a2 = activities.find(a => a.activity_code === 'A2');
        expect(a2!.base_days).toBe(2);
    });

    it('creates placeholder for missing activity code using override name/days if provided', () => {
        const map = buildActivityMapFromCatalogs(null, globalActivities);
        const activities = mergeActivitiesWithOverrides(map, ['MISSING_CODE'], [
            { activity_code: 'MISSING_CODE', override_name: 'Custom X', override_days: 1.5, override_group: 'CustomGroup' }
        ]);

        expect(activities).toHaveLength(1);
        expect(activities[0].activity_code).toBe('MISSING_CODE');
        expect(activities[0].display_name).toBe('Custom X');
        expect(activities[0].base_days).toBe(1.5);
        expect(activities[0].driver_group).toBe('CustomGroup');
    });
});
