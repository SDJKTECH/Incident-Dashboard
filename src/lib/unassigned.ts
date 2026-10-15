import type { Incident } from '../types/incident';

/**
 * Count of incidents with status `open` or `investigating` whose assignee is
 * empty or whitespace-only.
 */
export function countUnassignedOpen(incidents: readonly Incident[]): number {
  let n = 0;
  for (const inc of incidents) {
    if ((inc.status === 'open' || inc.status === 'investigating') && inc.assignee.trim() === '') {
      n += 1;
    }
  }
  return n;
}
