import type { Incident } from '../types/incident';
import type { Task } from '../types/task';
import type { AppData } from '../types/store';
import { INCIDENT_STATUSES, SEVERITIES, TASK_STATUSES } from './constants';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isOneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

function isOptionalString(v: unknown): boolean {
  return v === undefined || typeof v === 'string';
}

export function isIncident(v: unknown): v is Incident {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.description === 'string' &&
    isOneOf(SEVERITIES, v.severity) &&
    isOneOf(INCIDENT_STATUSES, v.status) &&
    typeof v.assignee === 'string' &&
    Array.isArray(v.tags) &&
    v.tags.every((t) => typeof t === 'string') &&
    typeof v.createdAt === 'string' &&
    typeof v.updatedAt === 'string' &&
    isOptionalString(v.resolvedAt)
  );
}

export function isTask(v: unknown): v is Task {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    isOneOf(TASK_STATUSES, v.status) &&
    isOneOf(SEVERITIES, v.priority) &&
    typeof v.createdAt === 'string' &&
    isOptionalString(v.incidentId) &&
    isOptionalString(v.dueDate)
  );
}

export function isAppData(v: unknown): v is AppData {
  return (
    isRecord(v) &&
    Array.isArray(v.incidents) &&
    v.incidents.every(isIncident) &&
    Array.isArray(v.tasks) &&
    v.tasks.every(isTask)
  );
}
