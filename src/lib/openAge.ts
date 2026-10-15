import type { Incident } from '../types/incident';

/**
 * Mean age in ms (now - createdAt) over incidents whose status is `open` or
 * `investigating`. Unparseable `createdAt` values are skipped; a `createdAt`
 * in the future counts as age 0. Returns null when no incident qualifies.
 */
export function meanOpenAgeMs(incidents: readonly Incident[], now: Date | number): number | null {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  let total = 0;
  let n = 0;
  for (const inc of incidents) {
    if (inc.status !== 'open' && inc.status !== 'investigating') continue;
    const created = Date.parse(inc.createdAt);
    if (Number.isNaN(created)) continue;
    total += Math.max(0, nowMs - created);
    n += 1;
  }
  return n === 0 ? null : total / n;
}
