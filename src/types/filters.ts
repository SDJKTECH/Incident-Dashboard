import type { IncidentStatus, Severity } from './incident';

export type SortKey = 'date' | 'severity';
export type SortDir = 'asc' | 'desc';

export interface FilterState {
  status?: IncidentStatus;
  severity?: Severity;
  assignee?: string;
  tag?: string;
  dateFrom?: string; // 'YYYY-MM-DD', inclusive
  dateTo?: string; // 'YYYY-MM-DD', inclusive
  query: string;
  sortKey: SortKey;
  sortDir: SortDir;
}
