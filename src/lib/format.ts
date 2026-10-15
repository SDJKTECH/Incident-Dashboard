const HOUR_MS = 60 * 60 * 1000;

/** Formats a duration: 'N/A' for null/invalid, hours below 48h ('5.5 h'), else days ('2.3 d'). */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return 'N/A';
  const hours = ms / HOUR_MS;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

let counter = 0;

/** Returns a unique id; uses crypto.randomUUID when available. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  counter += 1;
  return `id-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}
