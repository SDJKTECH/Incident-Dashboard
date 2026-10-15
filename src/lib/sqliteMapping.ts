import type { Incident } from '../types/incident';
import type { Task } from '../types/task';

export type SqlParam = string | null;

export const INCIDENT_COLUMNS =
  'id, title, description, severity, status, assignee, tags, created_at, updated_at, resolved_at';
export const TASK_COLUMNS = 'id, incident_id, title, status, priority, due_date, created_at';

export const INSERT_INCIDENT = `INSERT INTO incidents (${INCIDENT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
export const INSERT_TASK = `INSERT INTO tasks (${TASK_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`;

function orNull(v: string | undefined): string | null {
  return v === undefined ? null : v;
}

function orAbsent(v: unknown): unknown {
  return v === null ? undefined : v;
}

export function incidentToRow(i: Incident): SqlParam[] {
  return [
    i.id,
    i.title,
    i.description,
    i.severity,
    i.status,
    i.assignee,
    JSON.stringify(i.tags),
    i.createdAt,
    i.updatedAt,
    orNull(i.resolvedAt),
  ];
}

export function taskToRow(t: Task): SqlParam[] {
  return [t.id, orNull(t.incidentId), t.title, t.status, t.priority, orNull(t.dueDate), t.createdAt];
}

function parseTags(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Maps a row (column order of INCIDENT_COLUMNS) to an unvalidated object.
 * NULL optional columns become absent keys. Callers must validate with isIncident.
 */
export function rowToIncident(row: readonly unknown[]): unknown {
  const resolvedAt = orAbsent(row[9]);
  return {
    id: row[0],
    title: row[1],
    description: row[2],
    severity: row[3],
    status: row[4],
    assignee: row[5],
    tags: parseTags(row[6]),
    createdAt: row[7],
    updatedAt: row[8],
    ...(resolvedAt !== undefined ? { resolvedAt } : {}),
  };
}

/** Maps a row (column order of TASK_COLUMNS) to an unvalidated object. */
export function rowToTask(row: readonly unknown[]): unknown {
  const incidentId = orAbsent(row[1]);
  const dueDate = orAbsent(row[5]);
  return {
    id: row[0],
    ...(incidentId !== undefined ? { incidentId } : {}),
    title: row[2],
    status: row[3],
    priority: row[4],
    ...(dueDate !== undefined ? { dueDate } : {}),
    createdAt: row[6],
  };
}
