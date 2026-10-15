import { describe, expect, it } from 'vitest'
import type { Database } from 'sql.js'
import {
  LATEST_SCHEMA_VERSION,
  META_SCHEMA_VERSION,
  MIGRATIONS,
  getMeta,
  getSchemaVersion,
  runMigrations,
  setMeta,
} from '../../src/lib/sqliteSchema'
import { newDb } from '../helpers/sqlJs'

function tableNames(db: Database): string[] {
  const res = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  return (res[0]?.values ?? []).map((r) => String(r[0]))
}

describe('AC-04 sqliteSchema: versioned migrations', () => {
  it('AC-04: LATEST_SCHEMA_VERSION equals the number of migrations (at least 1)', () => {
    expect(LATEST_SCHEMA_VERSION).toBe(MIGRATIONS.length)
    expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(1)
  })

  it('AC-04: a fresh database is migrated to the latest version with meta, incidents and tasks tables', async () => {
    const db = await newDb()
    runMigrations(db)
    expect(tableNames(db)).toEqual(expect.arrayContaining(['incidents', 'meta', 'tasks']))
    expect(getSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION)
    expect(getMeta(db, META_SCHEMA_VERSION)).toBe(String(LATEST_SCHEMA_VERSION))
    db.close()
  })

  it('AC-04: running migrations again is idempotent and keeps existing rows', async () => {
    const db = await newDb()
    runMigrations(db)
    db.run(
      "INSERT INTO tasks (id, incident_id, title, status, priority, due_date, created_at) VALUES ('t', NULL, 'T', 'todo', 'low', NULL, 'x')",
    )
    expect(() => runMigrations(db)).not.toThrow()
    expect(getSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION)
    expect(db.exec('SELECT COUNT(*) FROM tasks')[0].values[0][0]).toBe(1)
    db.close()
  })

  it('AC-04: a database with a newer schema_version is rejected with an error', async () => {
    const db = await newDb()
    runMigrations(db)
    setMeta(db, META_SCHEMA_VERSION, String(LATEST_SCHEMA_VERSION + 1))
    expect(() => runMigrations(db)).toThrow(/schema_version/i)
    // Version is untouched (no downgrade).
    expect(getMeta(db, META_SCHEMA_VERSION)).toBe(String(LATEST_SCHEMA_VERSION + 1))
    db.close()
  })

  it.each([['abc'], ['-1'], ['1.5'], ['']])('AC-04: invalid stored schema_version %j throws', async (raw) => {
    const db = await newDb()
    runMigrations(db)
    setMeta(db, META_SCHEMA_VERSION, raw)
    expect(() => runMigrations(db)).toThrow()
    db.close()
  })

  it('AC-04: a failing migration rolls back the transaction (no meta table left behind)', async () => {
    const db = await newDb()
    // Pre-existing conflicting table makes migration 1 fail on CREATE TABLE incidents.
    db.run('CREATE TABLE incidents (x TEXT)')
    expect(() => runMigrations(db)).toThrow()
    expect(tableNames(db)).not.toContain('meta')
    expect(tableNames(db)).not.toContain('tasks')
    db.close()
  })

  it('AC-04: database remains usable after a failed migration (transaction closed)', async () => {
    const db = await newDb()
    db.run('CREATE TABLE incidents (x TEXT)')
    expect(() => runMigrations(db)).toThrow()
    expect(() => db.run('CREATE TABLE other (y TEXT)')).not.toThrow()
    db.close()
  })
})

describe('AC-04 sqliteSchema: meta helpers', () => {
  it('AC-04: getMeta returns null for a missing key', async () => {
    const db = await newDb()
    runMigrations(db)
    expect(getMeta(db, 'nope')).toBeNull()
    db.close()
  })

  it('AC-04: setMeta inserts and overwrites', async () => {
    const db = await newDb()
    runMigrations(db)
    setMeta(db, 'k', 'a')
    expect(getMeta(db, 'k')).toBe('a')
    setMeta(db, 'k', 'b')
    expect(getMeta(db, 'k')).toBe('b')
    db.close()
  })
})
