import type { IncidentStatus, Severity } from '../types/incident';
import type { TaskStatus } from '../types/task';

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const satisfies readonly Severity[];
export const INCIDENT_STATUSES = [
  'open',
  'investigating',
  'resolved',
  'closed',
] as const satisfies readonly IncidentStatus[];
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const satisfies readonly TaskStatus[];

// Compile-time exhaustiveness: every union member must appear in the arrays.
type AssertTrue<T extends true> = T;
export type SeveritiesComplete = AssertTrue<
  Severity extends (typeof SEVERITIES)[number] ? true : false
>;
export type IncidentStatusesComplete = AssertTrue<
  IncidentStatus extends (typeof INCIDENT_STATUSES)[number] ? true : false
>;
export type TaskStatusesComplete = AssertTrue<
  TaskStatus extends (typeof TASK_STATUSES)[number] ? true : false
>;

export const SEVERITY_RANK: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};
