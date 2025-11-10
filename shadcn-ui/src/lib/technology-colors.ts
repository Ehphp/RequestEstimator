export const TECHNOLOGY_COLOR_PALETTE = [
  '#2563EB',
  '#0EA5E9',
  '#0891B2',
  '#14B8A6',
  '#10B981',
  '#84CC16',
  '#F59E0B',
  '#F97316',
  '#F43F5E',
  '#D946EF',
  '#8B5CF6',
  '#6366F1',
];

export function getTechnologyColor(rawTechnology: string): string {
  const technology = rawTechnology?.trim().toLowerCase() || '';
  if (!technology) {
    return TECHNOLOGY_COLOR_PALETTE[0];
  }

  const hash = technology.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return TECHNOLOGY_COLOR_PALETTE[hash % TECHNOLOGY_COLOR_PALETTE.length];
}

