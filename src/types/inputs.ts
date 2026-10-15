import type { Incident, IncidentStatus, Severity } from './incident';
import type { Task, TaskStatus } from './task';

/** Fields a caller supplies when creating an incident. */
export interface NewIncidentInput {
  title: string;
  description?: string;
  severity?: Severity; // default 'medium'
  status?: IncidentStatus; // default 'open'
  assignee?: string;
  tags?: string[];
}

/** Editable incident fields (id and timestamps are managed internally). */
export type IncidentPatch = Partial<
  Omit<Incident, 'id' | 'createdAt' | 'updatedAt' | 'resolvedAt'>
>;

/** Fields a caller supplies when creating a task. */
export interface NewTaskInput {
  title: string;
  incidentId?: string;
  status?: TaskStatus; // default 'todo'
  priority?: Severity; // default 'medium'
  dueDate?: string;
}

/** Editable task fields. incidentId/dueDate may be set to undefined to clear. */
export type TaskPatch = Partial<Omit<Task, 'id' | 'createdAt'>>;

export type CreateIncidentResult =
  | { ok: true; incident: Incident }
  | { ok: false; error: string };

export type CreateTaskResult =
  | { ok: true; task: Task }
  | { ok: false; error: string };

export type MutationResult = { ok: true } | { ok: false; error: string };

/** Result of submitting the incident form (create returns the incident; edit returns ok only). */
export type IncidentSubmitResult = CreateIncidentResult | MutationResult;
