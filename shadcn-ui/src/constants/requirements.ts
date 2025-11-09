import { Requirement } from '@/types';

export const PRIORITY_OPTIONS: { value: Requirement['priority']; label: string }[] = [
  { value: 'High', label: 'Alta' },
  { value: 'Med', label: 'Media' },
  { value: 'Low', label: 'Bassa' }
];

export const STATE_OPTIONS: { value: Requirement['state']; label: string }[] = [
  { value: 'Proposed', label: 'Proposto' },
  { value: 'Selected', label: 'Selezionato' },
  { value: 'Scheduled', label: 'Pianificato' },
  { value: 'Done', label: 'Completato' }
];
