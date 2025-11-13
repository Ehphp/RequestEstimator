import { Activity, ListActivityCatalog } from '../types';

/**
 * Costruisce una mappa activity_code -> Activity a partire dal catalogo per-lista
 * (se fornito) e dal catalogo globale (fallback). Le attività del catalogo per-lista
 * sovrascrivono quelle globali.
 */
export function buildActivityMapFromCatalogs(
  listCatalog: ListActivityCatalog | null,
  globalActivities: Activity[]
): Map<string, Activity> {
  const map = new Map<string, Activity>();

  if (listCatalog?.catalog?.groups) {
    for (const group of listCatalog.catalog.groups) {
      for (const act of group.activities || []) {
        // garantiamo che driver_group rifletta il group container se presente
        map.set(act.activity_code, { ...act, driver_group: group.group });
      }
    }
  }

  for (const ga of globalActivities || []) {
    if (!map.has(ga.activity_code)) {
      map.set(ga.activity_code, ga);
    }
  }

  return map;
}

export type ActivityOverride = {
  activity_code: string;
  override_name?: string;
  override_days?: number;
  override_group?: string;
};

/**
 * Dato un map di attività e una lista di codici + override, ritorna l'array di
 * Activity pronto per il calcolo. Se un codice non è presente nel map viene
 * creato un placeholder con base_days = 0 (ma il nome può venire dall'override).
 */
export function mergeActivitiesWithOverrides(
  activityMap: Map<string, Activity>,
  includedActivityCodes: string[],
  includedOverrides?: ActivityOverride[]
): Activity[] {
  const overrideMap = new Map<string, ActivityOverride>();
  (includedOverrides || []).forEach(o => overrideMap.set(o.activity_code, o));

  const result: Activity[] = [];
  for (const code of includedActivityCodes) {
    const base = activityMap.get(code);
    const override = overrideMap.get(code);

    if (!base) {
      result.push({
        activity_code: code,
        display_name: override?.override_name || code,
        driver_group: override?.override_group || 'Custom',
        base_days: override?.override_days ?? 0,
        helper_short: override?.override_name ? `Override: ${override.override_name}` : 'Placeholder activity',
        helper_long: '',
        status: 'Active'
      });
      continue;
    }

    const merged: Activity = { ...base };
    if (override?.override_name) merged.display_name = override.override_name;
    if (override?.override_group) merged.driver_group = override.override_group;
    if (typeof override?.override_days === 'number') merged.base_days = override.override_days;

    result.push(merged);
  }

  return result;
}

export default {
  buildActivityMapFromCatalogs,
  mergeActivitiesWithOverrides
};
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Requirement } from '../types';

const PRIORITY_PALETTE = {
  High: {
    chipClass: 'bg-[#31151a] text-[#ffb4a2] border-[#ffb4a2]/40',
    solidClass: 'bg-[#b42318] text-white',
    chartColor: '#b42318',
    strokeColor: '#7f1d1d',
  },
  Med: {
    chipClass: 'bg-[#35220c] text-[#ffe6a7] border-[#ffe6a7]/40',
    solidClass: 'bg-[#c26d0e] text-white',
    chartColor: '#c26d0e',
    strokeColor: '#7a3f07',
  },
  Low: {
    chipClass: 'bg-[#102335] text-[#9ad0ff] border-[#9ad0ff]/40',
    solidClass: 'bg-[#1d4ed8] text-white',
    chartColor: '#1d4ed8',
    strokeColor: '#12357f',
  },
} as const;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Restituisce le classi CSS per il badge di priorità in palette brand
 * @param priority - Livello di priorità ('High' | 'Med' | 'Low')
 */
export function getPriorityColor(priority: string): string {
  return PRIORITY_PALETTE[priority as keyof typeof PRIORITY_PALETTE]?.chipClass ?? 'bg-muted text-muted-foreground';
}

/**
 * Restituisce le classi CSS per il colore del badge di stato
 * @param state - Stato del requisito ('Proposed' | 'Selected' | 'Scheduled' | 'Done')
 * @returns Classi Tailwind CSS per il badge
 */
export function getStateColor(state: string): string {
  switch (state) {
    case 'Proposed':
      return 'bg-blue-100 text-blue-800';
    case 'Selected':
      return 'bg-purple-100 text-purple-800';
    case 'Scheduled':
      return 'bg-orange-100 text-orange-800';
    case 'Done':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

const STATE_HEX_COLORS: Record<Requirement['state'], string> = {
  Proposed: '#3b82f6',
  Selected: '#a855f7',
  Scheduled: '#f97316',
  Done: '#16a34a'
};

export function getStateHexColor(state: string): string {
  return STATE_HEX_COLORS[state as Requirement['state']] ?? '#64748b';
}

/**
 * Restituisce il colore solido per priorità (per grafici e elementi accentati)
 * @param priority - Livello di priorità ('High' | 'Med' | 'Low')
 */
export function getPrioritySolidColor(priority: string): string {
  return PRIORITY_PALETTE[priority as keyof typeof PRIORITY_PALETTE]?.chartColor ?? '#6b7280';
}

/**
 * Restituisce la classe CSS per badge con colore solido di priorità
 * @param priority - Livello di priorità ('High' | 'Med' | 'Low')
 */
export function getPrioritySolidClass(priority: string): string {
  return PRIORITY_PALETTE[priority as keyof typeof PRIORITY_PALETTE]?.solidClass ?? 'bg-muted text-foreground';
}

export function getPriorityStrokeColor(priority: string): string {
  return PRIORITY_PALETTE[priority as keyof typeof PRIORITY_PALETTE]?.strokeColor ?? '#374151';
}

export function parseLabels(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(label => label.trim())
    .filter(label => label.length > 0);
}
