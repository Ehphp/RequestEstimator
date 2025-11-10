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
