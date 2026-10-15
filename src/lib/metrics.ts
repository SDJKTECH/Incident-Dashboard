import type { Incident, Severity } from '../types/incident';
import type { Task } from '../types/task';
import { SEVERITIES } from './constants';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Count of incidents with status `open` or `investigating`, per severity. */
export function openBySeverity(incidents: readonly Incident[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const s of SEVERITIES) counts[s] = 0;
  for (const inc of incidents) {
    if (inc.status === 'open' || inc.status === 'investigating') {
      counts[inc.severity] += 1;
    }
  }
  return counts;
}

/**
 * Mean of (resolvedAt - createdAt) in ms over incidents that have a valid
 * resolvedAt. Returns null when there are none.
 */
export function meanTimeToResolveMs(incidents: readonly Incident[]): number | null {
  let total = 0;
  let n = 0;
  for (const inc of incidents) {
    if (!inc.resolvedAt) continue;
    const d = Date.parse(inc.resolvedAt) - Date.parse(inc.createdAt);
    if (Number.isNaN(d)) continue;
    total += d;
    n += 1;
  }
  return n === 0 ? null : total / n;
}

/** `completed` = done; `pending` = todo + in_progress. */
export function taskCounts(tasks: readonly Task[]): { completed: number; pending: number } {
  let completed = 0;
  let pending = 0;
  for (const t of tasks) {
    if (t.status === 'done') completed += 1;
    else pending += 1;
  }
  return { completed, pending };
}

/**
 * Incidents created within the rolling window [now - days, now].
 * Boundary: an incident created exactly `days` days ago IS counted.
 * Incidents created in the future (after `now`) are not counted.
 */
export function createdInLastDays(
  incidents: readonly Incident[],
  now: Date | number,
  days: number,
): number {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const cutoff = nowMs - days * DAY_MS;
  let count = 0;
  for (const inc of incidents) {
    const t = Date.parse(inc.createdAt);
    if (!Number.isNaN(t) && t >= cutoff && t <= nowMs) count += 1;
  }
  return count;
}
