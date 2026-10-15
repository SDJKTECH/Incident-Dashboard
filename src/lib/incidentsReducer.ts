import type { Incident } from '../types/incident';
import type { Task, TaskStatus } from '../types/task';
import type { AppData } from '../types/store';
import type { IncidentPatch, TaskPatch } from '../types/inputs';
import { applyStatusChange, unlinkTasks } from './incidentRules';

export type IncidentsAction =
  | { type: 'hydrate'; data: AppData }
  | { type: 'incident/create'; incident: Incident }
  | { type: 'incident/update'; id: string; patch: IncidentPatch; now: string }
  | { type: 'incident/delete'; id: string }
  | { type: 'task/create'; task: Task }
  | { type: 'task/update'; id: string; patch: TaskPatch }
  | { type: 'task/delete'; id: string }
  | { type: 'task/setStatus'; id: string; status: TaskStatus };

function stripUndefined<T extends object>(patch: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(patch) as (keyof T)[]) {
    if (patch[key] !== undefined) out[key] = patch[key];
  }
  return out;
}

/** Strips undefined for required task keys; incidentId/dueDate may stay undefined to clear. */
function sanitizeTaskPatch(patch: TaskPatch): TaskPatch {
  const { incidentId, dueDate, ...required } = patch;
  const out: TaskPatch = stripUndefined(required);
  if ('incidentId' in patch) out.incidentId = incidentId;
  if ('dueDate' in patch) out.dueDate = dueDate;
  return out;
}

/** Returns the same `state` reference when the action changes nothing. */
export function incidentsReducer(state: AppData, action: IncidentsAction): AppData {
  switch (action.type) {
    case 'hydrate':
      return { incidents: action.data.incidents, tasks: action.data.tasks };
    case 'incident/create':
      return {
        ...state,
        incidents: [...state.incidents, { ...action.incident, tags: [...action.incident.tags] }],
      };
    case 'incident/update': {
      if (!state.incidents.some((i) => i.id === action.id)) return state;
      const patch = stripUndefined(action.patch);
      if (patch.tags) patch.tags = [...patch.tags];
      return {
        ...state,
        incidents: state.incidents.map((inc) => {
          if (inc.id !== action.id) return inc;
          let next: Incident = { ...inc, ...patch };
          if (patch.status !== undefined && patch.status !== inc.status) {
            next = applyStatusChange(next, patch.status, action.now);
          }
          return { ...next, updatedAt: action.now };
        }),
      };
    }
    case 'incident/delete':
      if (!state.incidents.some((i) => i.id === action.id)) return state;
      return {
        incidents: state.incidents.filter((i) => i.id !== action.id),
        tasks: unlinkTasks(state.tasks, action.id),
      };
    case 'task/create':
      return { ...state, tasks: [...state.tasks, action.task] };
    case 'task/update': {
      if (!state.tasks.some((t) => t.id === action.id)) return state;
      const patch = sanitizeTaskPatch(action.patch);
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...patch } : t)),
      };
    }
    case 'task/delete':
      if (!state.tasks.some((t) => t.id === action.id)) return state;
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case 'task/setStatus':
      if (!state.tasks.some((t) => t.id === action.id)) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, status: action.status } : t,
        ),
      };
  }
}
