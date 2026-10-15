import type { Incident } from './incident';
import type { Task } from './task';

export interface AppData {
  incidents: Incident[];
  tasks: Task[];
}

export type LoadStatus = 'loading' | 'ok' | 'empty' | 'corrupt' | 'unavailable';

export interface LoadResult {
  data: AppData;
  status: LoadStatus;
  /** True when legacy LocalStorage data was imported into the database on this load. */
  migrated?: boolean;
}

export interface PersistenceAdapter {
  load(): Promise<LoadResult>;
  save(data: AppData): Promise<boolean>;
}
