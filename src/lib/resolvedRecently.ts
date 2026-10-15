import type { Incident } from '../types/incident';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Incidents resolved within the rolling window [now - days, now].
 * Boundary: an incident resolved exactly `days` days ago IS counted.
 * Missing/unparseable `resolvedAt` and future dates (after `now`) are skipped.
 * Incident status is ignored (a closed incident keeping `resolvedAt` counts).
 */
export function resolvedInLastDays(
  incidents: readonly Incident[],
  now: Date | number,
  days: number,
): number {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const cutoff = nowMs - days * DAY_MS;
  let count = 0;
  for (const inc of incidents) {
    if (!inc.resolvedAt) continue;
    const t = Date.parse(inc.resolvedAt);
    if (!Number.isNaN(t) && t >= cutoff && t <= nowMs) count += 1;
  }
  return count;
}
