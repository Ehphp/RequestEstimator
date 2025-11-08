import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const PRIORITY_PALETTE = {
  High: {
    chipClass: 'bg-[#3b1e26] text-[#fb7185] border-[#fb7185]/40',
    solidClass: 'bg-[#fb7185] text-[#0b0f14]',
    chartColor: '#fb7185',
  },
  Med: {
    chipClass: 'bg-[#3a2c16] text-[#fbbf24] border-[#fbbf24]/40',
    solidClass: 'bg-[#fbbf24] text-[#0b0f14]',
    chartColor: '#fbbf24',
  },
  Low: {
    chipClass: 'bg-[#1b2a44] text-[#60a5fa] border-[#60a5fa]/40',
    solidClass: 'bg-[#60a5fa] text-[#0b0f14]',
    chartColor: '#60a5fa',
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
