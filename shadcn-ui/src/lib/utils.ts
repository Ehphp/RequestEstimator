import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Restituisce le classi CSS per il colore del badge di priorità
 * @param priority - Livello di priorità ('High' | 'Med' | 'Low')
 * @returns Classi Tailwind CSS per il badge
 */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'High':
      return 'bg-red-100 text-red-800';
    case 'Med':
      return 'bg-yellow-100 text-yellow-800';
    case 'Low':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
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
