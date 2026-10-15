import type { Incident, IncidentStatus, Severity } from '../types/incident';
import type { FilterState, SortDir, SortKey } from '../types/filters';
import { INCIDENT_STATUSES, SEVERITIES } from '../lib/constants';
import { uniqueAssignees, uniqueTags } from '../lib/filtering';

interface FilterBarProps {
  filters: FilterState;
  incidents: readonly Incident[];
  onChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClear: () => void;
}

const CONTROL =
  'w-full rounded-md border border-gray-400 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700';
const LABEL = 'mb-1 block text-xs font-medium text-gray-700';

function isStatus(v: string): v is IncidentStatus {
  return (INCIDENT_STATUSES as readonly string[]).includes(v);
}
function isSeverity(v: string): v is Severity {
  return (SEVERITIES as readonly string[]).includes(v);
}

export function FilterBar({ filters, incidents, onChange, onClear }: FilterBarProps): JSX.Element {
  const assignees = uniqueAssignees(incidents);
  const tags = uniqueTags(incidents);
  return (
    <section aria-label="Filters" className="rounded-lg border border-gray-300 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <label htmlFor="filter-search" className={LABEL}>
            Search
          </label>
          <input
            id="filter-search"
            type="search"
            value={filters.query}
            onChange={(e) => onChange('query', e.target.value)}
            className={CONTROL}
          />
        </div>
        <div>
          <label htmlFor="filter-status" className={LABEL}>
            Status
          </label>
          <select
            id="filter-status"
            value={filters.status ?? ''}
            onChange={(e) => onChange('status', isStatus(e.target.value) ? e.target.value : undefined)}
            className={CONTROL}
          >
            <option value="">All</option>
            {INCIDENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-severity" className={LABEL}>
            Severity
          </label>
          <select
            id="filter-severity"
            value={filters.severity ?? ''}
            onChange={(e) =>
              onChange('severity', isSeverity(e.target.value) ? e.target.value : undefined)
            }
            className={CONTROL}
          >
            <option value="">All</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-assignee" className={LABEL}>
            Assignee
          </label>
          <select
            id="filter-assignee"
            value={filters.assignee ?? ''}
            onChange={(e) => onChange('assignee', e.target.value || undefined)}
            className={CONTROL}
          >
            <option value="">All</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-tag" className={LABEL}>
            Tag
          </label>
          <select
            id="filter-tag"
            value={filters.tag ?? ''}
            onChange={(e) => onChange('tag', e.target.value || undefined)}
            className={CONTROL}
          >
            <option value="">All</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-date-from" className={LABEL}>
            Created from
          </label>
          <input
            id="filter-date-from"
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => onChange('dateFrom', e.target.value || undefined)}
            className={CONTROL}
          />
        </div>
        <div>
          <label htmlFor="filter-date-to" className={LABEL}>
            Created to
          </label>
          <input
            id="filter-date-to"
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => onChange('dateTo', e.target.value || undefined)}
            className={CONTROL}
          />
        </div>
        <div>
          <label htmlFor="filter-sort-key" className={LABEL}>
            Sort by
          </label>
          <select
            id="filter-sort-key"
            value={filters.sortKey}
            onChange={(e) => onChange('sortKey', e.target.value as SortKey)}
            className={CONTROL}
          >
            <option value="date">Date</option>
            <option value="severity">Severity</option>
          </select>
        </div>
        <div>
          <label htmlFor="filter-sort-dir" className={LABEL}>
            Direction
          </label>
          <select
            id="filter-sort-dir"
            value={filters.sortDir}
            onChange={(e) => onChange('sortDir', e.target.value as SortDir)}
            className={CONTROL}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-gray-400 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
        >
          Clear filters
        </button>
      </div>
    </section>
  );
}
