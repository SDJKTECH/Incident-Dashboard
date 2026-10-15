import type { Incident } from '../types/incident';
import type { FilterState } from '../types/filters';
import { SEVERITY_RANK } from './constants';

export const DEFAULT_FILTERS: FilterState = {
  query: '',
  sortKey: 'date',
  sortDir: 'desc',
};

/** Local calendar day of an ISO timestamp as 'YYYY-MM-DD', or null if invalid. */
function localDay(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Applies status/severity/assignee/tag/date-range filters (AND). The date
 * range is inclusive on both boundary days, compared by the local calendar
 * day of `createdAt`. Empty-string values are treated as unset.
 */
export function filterIncidents(
  incidents: readonly Incident[],
  filters: FilterState,
): Incident[] {
  const { status, severity, assignee, tag, dateFrom, dateTo } = filters;
  return incidents.filter((inc) => {
    if (status && inc.status !== status) return false;
    if (severity && inc.severity !== severity) return false;
    if (assignee && inc.assignee !== assignee) return false;
    if (tag && !inc.tags.includes(tag)) return false;
    if (dateFrom || dateTo) {
      const day = localDay(inc.createdAt);
      if (day === null) return false;
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
    }
    return true;
  });
}

/** Case-insensitive substring match over title and description. */
export function searchIncidents(incidents: readonly Incident[], query: string): Incident[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...incidents];
  return incidents.filter(
    (inc) => inc.title.toLowerCase().includes(q) || inc.description.toLowerCase().includes(q),
  );
}

/** Stable, non-mutating sort by createdAt or severity rank. */
export function sortIncidents(
  incidents: readonly Incident[],
  sortKey: FilterState['sortKey'],
  sortDir: FilterState['sortDir'],
): Incident[] {
  const sign = sortDir === 'asc' ? 1 : -1;
  const value = (inc: Incident): number =>
    sortKey === 'severity' ? SEVERITY_RANK[inc.severity] : Date.parse(inc.createdAt);
  return incidents
    .map((inc, index) => ({ inc, index, v: value(inc) }))
    .sort((a, b) => {
      const av = Number.isNaN(a.v) ? 0 : a.v;
      const bv = Number.isNaN(b.v) ? 0 : b.v;
      return sign * (av - bv) || a.index - b.index;
    })
    .map((x) => x.inc);
}

/** filter -> search -> sort. */
export function applyView(incidents: readonly Incident[], filters: FilterState): Incident[] {
  return sortIncidents(
    searchIncidents(filterIncidents(incidents, filters), filters.query),
    filters.sortKey,
    filters.sortDir,
  );
}

function sortedUnique(values: readonly string[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const t = v.trim();
    if (t !== '') set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Sorted distinct non-blank assignees. */
export function uniqueAssignees(incidents: readonly Incident[]): string[] {
  return sortedUnique(incidents.map((i) => i.assignee));
}

/** Sorted distinct non-blank tags. */
export function uniqueTags(incidents: readonly Incident[]): string[] {
  return sortedUnique(incidents.flatMap((i) => i.tags));
}
