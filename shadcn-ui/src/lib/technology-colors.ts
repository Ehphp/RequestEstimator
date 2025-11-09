export const TECHNOLOGY_COLOR_PALETTE = ['#2563eb', '#16a34a', '#a855f7', '#f97316', '#0ea5e9', '#ec4899', '#facc15', '#8b5cf6', '#ea580c', '#14b8a6'];

export function getTechnologyColor(rawTechnology: string): string {
  const technology = rawTechnology?.trim().toLowerCase() || '';
  if (!technology) {
    return TECHNOLOGY_COLOR_PALETTE[0];
  }

  const hash = technology.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return TECHNOLOGY_COLOR_PALETTE[hash % TECHNOLOGY_COLOR_PALETTE.length];
}

