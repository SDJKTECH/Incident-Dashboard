import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Incident } from '../types/incident';
import type { Task, TaskStatus } from '../types/task';
import type { AppData, LoadStatus, PersistenceAdapter } from '../types/store';
import type {
  CreateIncidentResult,
  CreateTaskResult,
  IncidentPatch,
  MutationResult,
  NewIncidentInput,
  NewTaskInput,
  TaskPatch,
} from '../types/inputs';
import { getSqliteAdapter } from '../lib/sqliteStorage';
import { incidentsReducer, type IncidentsAction } from '../lib/incidentsReducer';
import { newId as defaultNewId } from '../lib/format';

export interface UseIncidentsOptions {
  now?: () => string;
  newId?: () => string;
  adapter?: PersistenceAdapter;
}

export interface UseIncidentsApi {
  incidents: Incident[];
  tasks: Task[];
  loadStatus: LoadStatus;
  persistOk: boolean;
  /** True when legacy LocalStorage data was imported into SQLite on this load. */
  migrated: boolean;
  createIncident: (input: NewIncidentInput) => CreateIncidentResult;
  updateIncident: (id: string, patch: IncidentPatch) => MutationResult;
  deleteIncident: (id: string) => void;
  createTask: (input: NewTaskInput) => CreateTaskResult;
  updateTask: (id: string, patch: TaskPatch) => MutationResult;
  deleteTask: (id: string) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
}

const TITLE_ERROR = 'Title is required';
const NOT_FOUND_ERROR = 'Not found';
const LOADING_ERROR = 'Still loading';
const EMPTY_DATA: AppData = { incidents: [], tasks: [] };

function defaultNow(): string {
  return new Date().toISOString();
}

export function useIncidents(options: UseIncidentsOptions = {}): UseIncidentsApi {
  const now = options.now ?? defaultNow;
  const genId = options.newId ?? defaultNewId;

  const adapterRef = useRef<PersistenceAdapter>(options.adapter ?? getSqliteAdapter());
  const [data, dispatch] = useReducer(incidentsReducer, EMPTY_DATA);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [migrated, setMigrated] = useState<boolean>(false);
  const [persistOk, setPersistOk] = useState<boolean>(true);
  // Writes stay disabled until the user mutates (never overwrite hydrated or corrupt data).
  const canWrite = useRef<boolean>(false);
  const loadingRef = useRef<boolean>(true);
  // Synchronous mirror of the reducer state (reducer is pure, so this stays in sync).
  const dataRef = useRef<AppData>(data);
  // Serializes saves so they hit the adapter in order.
  const saveChain = useRef<Promise<void>>(Promise.resolve());

  // Applies an action to the mirror; dispatches and enables writes only if it changed something.
  const apply = useCallback((action: IncidentsAction): boolean => {
    if (loadingRef.current) return false;
    const next = incidentsReducer(dataRef.current, action);
    if (next === dataRef.current) return false;
    dataRef.current = next;
    canWrite.current = true;
    dispatch(action);
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    adapterRef.current
      .load()
      .catch((): { data: AppData; status: LoadStatus; migrated?: boolean } => ({
        data: EMPTY_DATA,
        status: 'unavailable',
      }))
      .then((result) => {
        if (cancelled) return;
        loadingRef.current = false;
        dataRef.current = result.data;
        dispatch({ type: 'hydrate', data: result.data });
        setLoadStatus(result.status);
        setMigrated(result.migrated === true);
        setPersistOk(result.status !== 'unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canWrite.current) return;
    const snapshot = data;
    saveChain.current = saveChain.current.then(async () => {
      let ok = false;
      try {
        ok = await adapterRef.current.save(snapshot);
      } catch {
        ok = false;
      }
      setPersistOk(ok);
    });
  }, [data]);

  const createIncident = useCallback(
    (input: NewIncidentInput): CreateIncidentResult => {
      if (loadingRef.current) return { ok: false, error: LOADING_ERROR };
      const title = input.title.trim();
      if (!title) return { ok: false, error: TITLE_ERROR };
      const ts = now();
      const status = input.status ?? 'open';
      const incident: Incident = {
        id: genId(),
        title,
        description: input.description ?? '',
        severity: input.severity ?? 'medium',
        status,
        assignee: input.assignee ?? '',
        tags: [...(input.tags ?? [])],
        createdAt: ts,
        updatedAt: ts,
        ...(status === 'resolved' ? { resolvedAt: ts } : {}),
      };
      apply({ type: 'incident/create', incident });
      return { ok: true, incident };
    },
    [now, genId, apply],
  );

  const updateIncident = useCallback(
    (id: string, patch: IncidentPatch): MutationResult => {
      let next = patch;
      if (patch.title !== undefined) {
        const title = patch.title.trim();
        if (!title) return { ok: false, error: TITLE_ERROR };
        next = { ...patch, title };
      }
      if (!apply({ type: 'incident/update', id, patch: next, now: now() })) {
        return { ok: false, error: NOT_FOUND_ERROR };
      }
      return { ok: true };
    },
    [now, apply],
  );

  const deleteIncident = useCallback((id: string): void => {
    apply({ type: 'incident/delete', id });
  }, [apply]);

  const createTask = useCallback(
    (input: NewTaskInput): CreateTaskResult => {
      if (loadingRef.current) return { ok: false, error: LOADING_ERROR };
      const title = input.title.trim();
      if (!title) return { ok: false, error: TITLE_ERROR };
      const task: Task = {
        id: genId(),
        title,
        status: input.status ?? 'todo',
        priority: input.priority ?? 'medium',
        createdAt: now(),
        ...(input.incidentId ? { incidentId: input.incidentId } : {}),
        ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      };
      apply({ type: 'task/create', task });
      return { ok: true, task };
    },
    [now, genId, apply],
  );

  const updateTask = useCallback((id: string, patch: TaskPatch): MutationResult => {
    let next = patch;
    if (patch.title !== undefined) {
      const title = patch.title.trim();
      if (!title) return { ok: false, error: TITLE_ERROR };
      next = { ...patch, title };
    }
    if (!apply({ type: 'task/update', id, patch: next })) {
      return { ok: false, error: NOT_FOUND_ERROR };
    }
    return { ok: true };
  }, [apply]);

  const deleteTask = useCallback((id: string): void => {
    apply({ type: 'task/delete', id });
  }, [apply]);

  const setTaskStatus = useCallback((id: string, status: TaskStatus): void => {
    apply({ type: 'task/setStatus', id, status });
  }, [apply]);

  return {
    incidents: data.incidents,
    tasks: data.tasks,
    loadStatus,
    persistOk,
    migrated,
    createIncident,
    updateIncident,
    deleteIncident,
    createTask,
    updateTask,
    deleteTask,
    setTaskStatus,
  };
}
