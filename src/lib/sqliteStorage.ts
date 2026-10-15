import type { Database, SqlJsStatic } from 'sql.js';
import type { AppData, LoadResult, PersistenceAdapter } from '../types/store';
import type { Incident } from '../types/incident';
import type { Task } from '../types/task';
import { isIncident, isTask } from './validation';
import { readDbBlob, writeDbBlob } from './idbStore';
import {
  INCIDENT_COLUMNS,
  INSERT_INCIDENT,
  INSERT_TASK,
  TASK_COLUMNS,
  incidentToRow,
  rowToIncident,
  rowToTask,
  taskToRow,
} from './sqliteMapping';
import { META_LEGACY_MIGRATED, getMeta, runMigrations, setMeta } from './sqliteSchema';
import { migrateLegacy } from './migrateLegacy';
import { loadState } from './storage';

let sqlPromise: Promise<SqlJsStatic> | null = null;

/** Lazily loads sql.js and its WASM binary. Retries on the next call after a failure. */
function getSql(): Promise<SqlJsStatic> {
  if (sqlPromise === null) {
    sqlPromise = (async (): Promise<SqlJsStatic> => {
      const [mod, wasm] = await Promise.all([
        import('sql.js'),
        import('sql.js/dist/sql-wasm.wasm?url'),
      ]);
      const wasmUrl = wasm.default;
      return mod.default({ locateFile: () => wasmUrl });
    })();
    sqlPromise.catch(() => {
      sqlPromise = null;
    });
  }
  return sqlPromise;
}

function emptyData(): AppData {
  return { incidents: [], tasks: [] };
}

function isEmpty(data: AppData): boolean {
  return data.incidents.length === 0 && data.tasks.length === 0;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** Reads and validates every row. Throws if any row is invalid. */
function readAll(db: Database): AppData {
  const incidents: Incident[] = [];
  const tasks: Task[] = [];
  const incRes = db.exec(`SELECT ${INCIDENT_COLUMNS} FROM incidents ORDER BY rowid`);
  for (const row of incRes[0]?.values ?? []) {
    const obj = rowToIncident(row);
    if (!isIncident(obj)) throw new Error('Invalid incident row');
    incidents.push(obj);
  }
  const taskRes = db.exec(`SELECT ${TASK_COLUMNS} FROM tasks ORDER BY rowid`);
  for (const row of taskRes[0]?.values ?? []) {
    const obj = rowToTask(row);
    if (!isTask(obj)) throw new Error('Invalid task row');
    tasks.push(obj);
  }
  return { incidents, tasks };
}

/** Replaces all rows in a single transaction. */
function writeAll(db: Database, data: AppData): void {
  db.run('BEGIN');
  try {
    db.run('DELETE FROM incidents');
    db.run('DELETE FROM tasks');
    for (const i of data.incidents) db.run(INSERT_INCIDENT, incidentToRow(i));
    for (const t of data.tasks) db.run(INSERT_TASK, taskToRow(t));
    db.run('COMMIT');
  } catch (err) {
    try {
      db.run('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw err;
  }
}

export function createSqliteAdapter(): PersistenceAdapter {
  let db: Database | null = null;
  let loadPromise: Promise<LoadResult> | null = null;
  let readFailed = false;

  async function ensureDb(): Promise<Database> {
    if (db === null) {
      const SQL = await getSql();
      const fresh = new SQL.Database();
      runMigrations(fresh);
      db = fresh;
    }
    return db;
  }

  /** Exports and writes the blob; resolves true only if the write succeeded. */
  async function flush(target: Database, verify: boolean): Promise<boolean> {
    const bytes = target.export();
    const w = await writeDbBlob(bytes);
    if (!w.ok) return false;
    if (!verify) return true;
    const r = await readDbBlob();
    return r.ok && r.blob !== null && sameBytes(r.blob, bytes);
  }

  /** Storage is unusable: surface any legacy LocalStorage data in memory only. */
  function unavailableWithLegacy(): LoadResult {
    return { data: loadState().data, status: 'unavailable' };
  }

  async function loadOnce(): Promise<LoadResult> {
    let SQL: SqlJsStatic;
    try {
      SQL = await getSql();
    } catch {
      readFailed = true;
      return unavailableWithLegacy();
    }
    const read = await readDbBlob();
    if (!read.ok) {
      readFailed = true;
      return unavailableWithLegacy();
    }
    if (read.corrupt === true) {
      // Wrong-type or zero-length stored value: keep it until the next mutation.
      try {
        const fresh = new SQL.Database();
        runMigrations(fresh);
        db = fresh;
      } catch {
        return { data: emptyData(), status: 'unavailable' };
      }
      return { data: emptyData(), status: 'corrupt' };
    }

    let loaded: Database | null = null;
    let data: AppData = emptyData();
    let hadBlob = false;
    try {
      if (read.blob !== null) {
        hadBlob = true;
        loaded = new SQL.Database(read.blob);
        const check = loaded.exec('PRAGMA quick_check');
        if (check[0]?.values[0]?.[0] !== 'ok') throw new Error('Integrity check failed');
        runMigrations(loaded);
        data = readAll(loaded);
      } else {
        loaded = new SQL.Database();
        runMigrations(loaded);
      }
    } catch {
      // Corrupt blob or invalid rows: start empty, keep the stored blob until the next mutation.
      try {
        loaded?.close();
      } catch {
        // ignore
      }
      const fresh = new SQL.Database();
      try {
        runMigrations(fresh);
      } catch {
        return { data: emptyData(), status: 'unavailable' };
      }
      db = fresh;
      return { data: emptyData(), status: 'corrupt' };
    }
    db = loaded;

    if (!isEmpty(data)) return { data, status: 'ok' };

    // New/empty database: attempt the one-time legacy import.
    let alreadyMigrated = false;
    try {
      alreadyMigrated = getMeta(loaded, META_LEGACY_MIGRATED) !== null;
    } catch {
      alreadyMigrated = false;
    }
    if (alreadyMigrated) return { data, status: hadBlob ? 'ok' : 'empty' };

    const target = loaded;
    const outcome = await migrateLegacy({
      persist: async (legacy): Promise<boolean> => {
        writeAll(target, legacy);
        return flush(target, true);
      },
      markDone: async (): Promise<boolean> => {
        setMeta(target, META_LEGACY_MIGRATED, '1');
        return flush(target, false);
      },
    });

    switch (outcome.kind) {
      case 'migrated':
        return { data: outcome.data, status: 'ok', migrated: true };
      case 'failed':
        // Could not durably write; keep the legacy data in memory only.
        return { data: outcome.data, status: 'unavailable' };
      case 'corrupt':
        return { data: emptyData(), status: 'corrupt' };
      case 'skipped':
        return { data, status: hadBlob ? 'ok' : 'empty' };
    }
  }

  async function save(data: AppData): Promise<boolean> {
    // Never overwrite a stored blob we failed to read.
    if (readFailed) return false;
    try {
      const target = await ensureDb();
      writeAll(target, data);
      return await flush(target, false);
    } catch {
      return false;
    }
  }

  /** Memoized so repeated calls (e.g. StrictMode double effects) never import twice. */
  function load(): Promise<LoadResult> {
    if (loadPromise === null) loadPromise = loadOnce();
    return loadPromise;
  }

  return { load, save };
}

let defaultAdapter: PersistenceAdapter | null = null;

/** Shared app-wide adapter instance. */
export function getSqliteAdapter(): PersistenceAdapter {
  if (defaultAdapter === null) defaultAdapter = createSqliteAdapter();
  return defaultAdapter;
}
