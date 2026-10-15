import type { Database } from 'sql.js';

/** Ordered migrations. Entry i upgrades schema version i to i + 1. */
export const MIGRATIONS: readonly (readonly string[])[] = [
  [
    `CREATE TABLE incidents (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      assignee TEXT NOT NULL,
      tags TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    )`,
    `CREATE TABLE tasks (
      id TEXT PRIMARY KEY NOT NULL,
      incident_id TEXT,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      due_date TEXT,
      created_at TEXT NOT NULL
    )`,
  ],
];

export const LATEST_SCHEMA_VERSION: number = MIGRATIONS.length;

export const META_SCHEMA_VERSION = 'schema_version';
export const META_LEGACY_MIGRATED = 'legacy_migrated';

const CREATE_META =
  'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)';

export function getMeta(db: Database, key: string): string | null {
  const res = db.exec('SELECT value FROM meta WHERE key = ?', [key]);
  const value = res[0]?.values[0]?.[0];
  return typeof value === 'string' ? value : null;
}

export function setMeta(db: Database, key: string, value: string): void {
  db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
}

export function getSchemaVersion(db: Database): number {
  const raw = getMeta(db, META_SCHEMA_VERSION);
  if (raw === null) return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error('Invalid schema_version');
  return n;
}

/**
 * Brings the database up to the latest schema version inside a transaction.
 * Throws if the stored version is invalid or newer than this build supports.
 */
export function runMigrations(db: Database): void {
  db.run('BEGIN');
  try {
    db.run(CREATE_META);
    const current = getSchemaVersion(db);
    if (current > LATEST_SCHEMA_VERSION) throw new Error('Unsupported schema_version');
    for (let v = current; v < LATEST_SCHEMA_VERSION; v += 1) {
      for (const stmt of MIGRATIONS[v]) db.run(stmt);
      setMeta(db, META_SCHEMA_VERSION, String(v + 1));
    }
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
