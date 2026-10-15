import type { AppData } from '../types/store';
import { loadState } from './storage';

export type LegacyOutcome =
  | { kind: 'skipped' }
  | { kind: 'corrupt' }
  | { kind: 'migrated'; data: AppData }
  /** Legacy data is valid but could not be durably written; use it in memory only. */
  | { kind: 'failed'; data: AppData };

export interface LegacyMigrationDeps {
  /** Writes the data into the database and persists it durably; resolves true only when verified. */
  persist: (data: AppData) => Promise<boolean>;
  /** Records the migration as done. Called only after a verified persist. */
  markDone: () => Promise<boolean>;
}

/**
 * One-time import of the legacy LocalStorage payload. The caller must only invoke this
 * when the database is new/empty and not already marked as migrated (idempotency).
 * The legacy key is never modified or removed.
 */
export async function migrateLegacy(deps: LegacyMigrationDeps): Promise<LegacyOutcome> {
  const legacy = loadState();
  if (legacy.status === 'corrupt') return { kind: 'corrupt' };
  if (legacy.status !== 'ok') return { kind: 'skipped' };
  const { incidents, tasks } = legacy.data;
  if (incidents.length === 0 && tasks.length === 0) return { kind: 'skipped' };

  let persisted = false;
  try {
    persisted = await deps.persist(legacy.data);
  } catch {
    persisted = false;
  }
  if (!persisted) return { kind: 'failed', data: legacy.data };

  try {
    await deps.markDone();
  } catch {
    // Data is already durable; a later load sees a non-empty database and will not re-import.
  }
  return { kind: 'migrated', data: legacy.data };
}
