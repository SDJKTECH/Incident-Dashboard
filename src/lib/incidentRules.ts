import type { Incident, IncidentStatus } from '../types/incident';
import type { Task } from '../types/task';

/**
 * Returns a new incident with the status changed and resolvedAt maintained:
 * -> resolved sets resolvedAt (kept if already resolved); -> open/investigating
 * clears it; -> closed leaves it as-is. Does not touch updatedAt.
 */
export function applyStatusChange(
  incident: Incident,
  newStatus: IncidentStatus,
  nowIso: string,
): Incident {
  const next: Incident = { ...incident, status: newStatus };
  if (newStatus === 'resolved') {
    next.resolvedAt =
      incident.status === 'resolved' && incident.resolvedAt
        ? incident.resolvedAt
        : nowIso;
  } else if (newStatus === 'open' || newStatus === 'investigating') {
    delete next.resolvedAt;
  }
  return next;
}

/** Removes the link to incidentId from all tasks; every task is kept. */
export function unlinkTasks(tasks: Task[], incidentId: string): Task[] {
  return tasks.map((t) => {
    if (t.incidentId !== incidentId) return t;
    const next: Task = { ...t };
    delete next.incidentId;
    return next;
  });
}
