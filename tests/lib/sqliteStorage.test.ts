// @vitest-environment node
/// <reference types="node" />
// Runs in node (not jsdom) so that Uint8Array values stored/cloned by fake-indexeddb share a realm
// with the code under test. Real sql.js (WASM) is used; only the WASM loading step is adapted.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSqliteAdapter } from '../../src/lib/sqliteStorage'
import { BLOB_KEY, DB_NAME, STORE_NAME, readDbBlob, writeDbBlob } from '../../src/lib/idbStore'
import { META_LEGACY_MIGRATED, META_SCHEMA_VERSION, LATEST_SCHEMA_VERSION, getMeta, runMigrations, setMeta } from '../../src/lib/sqliteSchema'
import { INSERT_INCIDENT, incidentToRow } from '../../src/lib/sqliteMapping'
import { STORAGE_KEY } from '../../src/lib/storage'
import type { AppData } from '../../src/types/store'
import type { Database } from 'sql.js'
import { makeIncident, makeTask } from '../helpers/factories'
import { newDb } from '../helpers/sqlJs'
import { brokenFactory, readOnlyFactory } from '../helpers/idbFactories'

const ctl = vi.hoisted(() => ({ failWasm: false }))

vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({ default: 'mock-wasm-url' }))
vi.mock('sql.js', async () => {
  const actual = await vi.importActual<typeof import('sql.js')>('sql.js')
  const fs = await import('node:fs')
  const { createRequire } = await import('node:module')
  const buf = fs.readFileSync(createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm'))
  const wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return {
    default: async (cfg?: object) => {
      if (ctl.failWasm) throw new Error('wasm load failed')
      return actual.default({ ...cfg, wasmBinary })
    },
  }
})

/** Minimal in-memory Storage so the legacy reader (window.localStorage) works under node. */
class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string): string | null {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v)
  }
  removeItem(k: string): void {
    this.m.delete(k)
  }
  clear(): void {
    this.m.clear()
  }
}

let ls: MemoryStorage

beforeEach(() => {
  ctl.failWasm = false
  vi.stubGlobal('indexedDB', new IDBFactory())
  ls = new MemoryStorage()
  vi.stubGlobal('window', { localStorage: ls })
})

const incident = makeIncident({ id: 'i1', title: 'DB down', tags: ['db', 'prod'], resolvedAt: '2026-01-02T00:00:00.000Z', status: 'resolved' })
const task = makeTask({ id: 't1', incidentId: 'i1', dueDate: '2026-02-01', status: 'in_progress' })
const bare = makeIncident({ id: 'i2', title: 'Bare', description: '', assignee: '', tags: [] })
const bareTask = makeTask({ id: 't2' })
const sample: AppData = { incidents: [incident, bare], tasks: [task, bareTask] }
const EMPTY: AppData = { incidents: [], tasks: [] }

async function seedDb(mutate: (db: Database) => void, migrate = true): Promise<Uint8Array> {
  const db = await newDb()
  if (migrate) runMigrations(db)
  mutate(db)
  const bytes = db.export()
  db.close()
  const w = await writeDbBlob(bytes)
  if (!w.ok) throw new Error('seed failed')
  return bytes
}

/** Puts a raw value under the blob key, bypassing writeDbBlob. */
async function putRaw(value: unknown): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (): void => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = (): void => resolve(req.result)
    req.onerror = (): void => reject(req.error)
  })
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, BLOB_KEY)
    tx.oncomplete = (): void => resolve()
    tx.onerror = (): void => reject(tx.error)
  })
  db.close()
}

async function rawStored(): Promise<unknown> {
  const req = indexedDB.open(DB_NAME, 1)
  return new Promise<unknown>((resolve) => {
    req.onsuccess = (): void => {
      const g = req.result.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(BLOB_KEY)
      g.onsuccess = (): void => {
        req.result.close()
        resolve(g.result)
      }
    }
  })
}

async function storedBytes(): Promise<number[] | null> {
  const r = await readDbBlob()
  if (!r.ok) throw new Error('read failed')
  return r.blob === null ? null : Array.from(r.blob)
}

describe('AC-04 sqliteStorage: missing database', () => {
  it('AC-04: nothing stored => empty status, empty data, and nothing written', async () => {
    const res = await createSqliteAdapter().load()
    expect(res).toEqual({ data: EMPTY, status: 'empty' })
    expect(await storedBytes()).toBeNull()
  })
})

describe('AC-04 sqliteStorage: save/load round trip', () => {
  it('AC-04: saved incidents and tasks are restored by a new adapter (optional fields intact)', async () => {
    const a = createSqliteAdapter()
    await a.load()
    expect(await a.save(sample)).toBe(true)
    const res = await createSqliteAdapter().load()
    expect(res.status).toBe('ok')
    expect(res.data).toEqual(sample)
    expect(res.migrated).toBeUndefined()
  })

  it('AC-04: row order is preserved', async () => {
    const a = createSqliteAdapter()
    await a.load()
    const many: AppData = { incidents: [1, 2, 3, 4, 5].map((n) => makeIncident({ id: `z${n}` })), tasks: [] }
    await a.save(many)
    const res = await createSqliteAdapter().load()
    expect(res.data.incidents.map((i) => i.id)).toEqual(['z1', 'z2', 'z3', 'z4', 'z5'])
  })

  it('AC-04: each save fully replaces the previous contents (deletes persist)', async () => {
    const a = createSqliteAdapter()
    await a.load()
    await a.save(sample)
    await a.save({ incidents: [bare], tasks: [] })
    const res = await createSqliteAdapter().load()
    expect(res.data).toEqual({ incidents: [bare], tasks: [] })
  })

  it('AC-04: saving empty data then reloading yields ok with empty data', async () => {
    const a = createSqliteAdapter()
    await a.load()
    expect(await a.save(EMPTY)).toBe(true)
    const res = await createSqliteAdapter().load()
    expect(res).toEqual({ data: EMPTY, status: 'ok' })
  })

  it('AC-04: persisted blob is a SQLite database with schema_version in the meta table', async () => {
    const a = createSqliteAdapter()
    await a.load()
    await a.save(sample)
    const r = await readDbBlob()
    if (!r.ok || r.blob === null) throw new Error('no blob')
    const db = await newDb(r.blob)
    expect(getMeta(db, META_SCHEMA_VERSION)).toBe(String(LATEST_SCHEMA_VERSION))
    expect(db.exec('SELECT COUNT(*) FROM incidents')[0].values[0][0]).toBe(2)
    db.close()
  })

  it('AC-04: save works even if load was never called', async () => {
    expect(await createSqliteAdapter().save(sample)).toBe(true)
    expect((await createSqliteAdapter().load()).data).toEqual(sample)
  })

  it('AC-04: load() is memoized (same promise for repeated calls)', async () => {
    const a = createSqliteAdapter()
    const p1 = a.load()
    const p2 = a.load()
    expect(p1).toBe(p2)
    await p1
  })
})

describe('AC-04 sqliteStorage: corrupt database', () => {
  it('AC-04: garbage blob => corrupt status, empty data, no throw', async () => {
    await writeDbBlob(new Uint8Array(300).fill(7))
    const res = await createSqliteAdapter().load()
    expect(res).toEqual({ data: EMPTY, status: 'corrupt' })
  })

  it('AC-04: truncated valid database => corrupt or recovered but never throws', async () => {
    const full = await seedDb((db) => db.run(INSERT_INCIDENT, incidentToRow(incident)))
    await writeDbBlob(full.slice(0, Math.floor(full.length / 2)))
    const res = await createSqliteAdapter().load()
    expect(['corrupt', 'ok', 'empty']).toContain(res.status)
  })

  it('AC-04: corrupt blob is not overwritten by load', async () => {
    const garbage = new Uint8Array(300).fill(7)
    await writeDbBlob(garbage)
    await createSqliteAdapter().load()
    expect(await storedBytes()).toEqual(Array.from(garbage))
  })

  it('AC-04: the next save after a corrupt load overwrites the blob and subsequent loads are ok', async () => {
    await writeDbBlob(new Uint8Array(300).fill(7))
    const a = createSqliteAdapter()
    expect((await a.load()).status).toBe('corrupt')
    expect(await a.save(sample)).toBe(true)
    const res = await createSqliteAdapter().load()
    expect(res.status).toBe('ok')
    expect(res.data).toEqual(sample)
  })

  it('AC-04: wrong-type stored value => corrupt, empty data, stored value untouched, no legacy migration', async () => {
    ls.setItem(STORAGE_KEY, JSON.stringify(sample))
    await putRaw('not bytes')
    const res = await createSqliteAdapter().load()
    expect(res).toEqual({ data: EMPTY, status: 'corrupt' })
    const stored = await rawStored()
    expect(stored).toBe('not bytes')
  })

  it('AC-04: zero-length stored blob => corrupt, empty data, no legacy migration, key retained', async () => {
    const raw = JSON.stringify(sample)
    ls.setItem(STORAGE_KEY, raw)
    await writeDbBlob(new Uint8Array(0))
    const res = await createSqliteAdapter().load()
    expect(res).toEqual({ data: EMPTY, status: 'corrupt' })
    expect(res.migrated).toBeUndefined()
    expect(Array.from((await rawStored()) as Uint8Array)).toEqual([])
    expect(ls.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('AC-04: the next save after a wrong-type/empty corrupt load overwrites it and later loads are ok', async () => {
    await writeDbBlob(new Uint8Array(0))
    const a = createSqliteAdapter()
    expect((await a.load()).status).toBe('corrupt')
    expect(await a.save(sample)).toBe(true)
    const res = await createSqliteAdapter().load()
    expect(res.status).toBe('ok')
    expect(res.data).toEqual(sample)
  })

  it('AC-04: PRAGMA quick_check failure (damaged page content) => corrupt, never throws, blob untouched', async () => {
    const many: AppData = {
      incidents: Array.from({ length: 200 }, (_v, n) => makeIncident({ id: `q${n}`, description: 'x'.repeat(200) })),
      tasks: [],
    }
    const a = createSqliteAdapter()
    await a.load()
    await a.save(many)
    const r = await readDbBlob()
    if (!r.ok || r.blob === null) throw new Error('no blob')
    const damaged = new Uint8Array(r.blob)
    // Overwrite a run of bytes inside later data pages, leaving the header intact.
    for (let i = Math.floor(damaged.length / 2); i < Math.floor(damaged.length / 2) + 2048; i += 1) damaged[i] = 0xff
    await writeDbBlob(damaged)
    const res = await createSqliteAdapter().load()
    expect(res).toEqual({ data: EMPTY, status: 'corrupt' })
    expect(await storedBytes()).toEqual(Array.from(damaged))
  })

  it('AC-04: database with a newer schema_version => corrupt (not downgraded or overwritten)', async () => {
    const bytes = await seedDb((db) => setMeta(db, META_SCHEMA_VERSION, String(LATEST_SCHEMA_VERSION + 5)))
    const res = await createSqliteAdapter().load()
    expect(res.status).toBe('corrupt')
    expect(res.data).toEqual(EMPTY)
    expect(await storedBytes()).toEqual(Array.from(bytes))
  })

  it('AC-04: an empty (zero-byte) SQLite export with no tables is treated as corrupt, not migrated', async () => {
    await seedDb(() => undefined, false)
    const res = await createSqliteAdapter().load()
    expect(res).toEqual({ data: EMPTY, status: 'corrupt' })
  })

  it('AC-04: valid SQLite database without app tables is migrated and treated as empty', async () => {
    await seedDb((db) => db.run('CREATE TABLE other (x INTEGER)'), false)
    const res = await createSqliteAdapter().load()
    expect(res.data).toEqual(EMPTY)
    expect(['ok', 'empty']).toContain(res.status)
  })
})

describe('AC-04 sqliteStorage: wrong-shape rows', () => {
  const badIncident = incidentToRow(makeIncident({ id: 'bad' }))
  it.each([
    ['bad severity', 3, 'urgent'],
    ['bad status', 4, 'nope'],
    ['tags not JSON', 6, '{oops'],
    ['tags JSON but not an array', 6, '"str"'],
    ['tags array of non-strings', 6, '[1,2]'],
  ])('AC-04: incident row with %s => corrupt, empty data, blob untouched', async (_n, idx, value) => {
    const row = [...badIncident]
    row[idx] = value
    const bytes = await seedDb((db) => {
      db.run(INSERT_INCIDENT, incidentToRow(incident))
      db.run(INSERT_INCIDENT, row)
    })
    const res = await createSqliteAdapter().load()
    expect(res).toEqual({ data: EMPTY, status: 'corrupt' })
    expect(await storedBytes()).toEqual(Array.from(bytes))
  })

  it.each([
    ['bad status', 'status', 'blocked'],
    ['bad priority', 'priority', 'p0'],
  ])('AC-04: task row with %s => corrupt even when incidents are valid', async (_n, col, value) => {
    await seedDb((db) => {
      db.run(INSERT_INCIDENT, incidentToRow(incident))
      db.run(
        `INSERT INTO tasks (id, incident_id, title, status, priority, due_date, created_at) VALUES ('t', NULL, 'T', ${col === 'status' ? '?' : "'todo'"}, ${col === 'priority' ? '?' : "'low'"}, NULL, 'c')`,
        [value],
      )
    })
    const res = await createSqliteAdapter().load()
    expect(res).toEqual({ data: EMPTY, status: 'corrupt' })
  })

  it('AC-04: a NULL in a NOT NULL column is rejected by SQLite itself, so shape errors cannot sneak in', async () => {
    const db = await newDb()
    runMigrations(db)
    expect(() => db.run("INSERT INTO incidents (id, title) VALUES ('x', 'y')")).toThrow()
    db.close()
  })

  it('AC-04: corrupt rows do not stop the legacy backup from being retained', async () => {
    ls.setItem(STORAGE_KEY, JSON.stringify(sample))
    await seedDb((db) => db.run(INSERT_INCIDENT, [...badIncident.slice(0, 3), 'urgent', ...badIncident.slice(4)]))
    const res = await createSqliteAdapter().load()
    expect(res.status).toBe('corrupt')
    expect(ls.getItem(STORAGE_KEY)).toBe(JSON.stringify(sample))
  })
})

describe('AC-04 sqliteStorage: WASM unavailable', () => {
  // The module caches the loaded sql.js instance, so each test gets a fresh copy of the module.
  async function freshModule(): Promise<typeof import('../../src/lib/sqliteStorage')> {
    vi.resetModules()
    return import('../../src/lib/sqliteStorage')
  }

  it('AC-04: WASM load failure => unavailable, empty data, no throw', async () => {
    const m = await freshModule()
    ctl.failWasm = true
    const res = await m.createSqliteAdapter().load()
    expect(res).toEqual({ data: EMPTY, status: 'unavailable' })
  })

  it('AC-04: WASM load failure with legacy data => legacy data in memory with status unavailable', async () => {
    const m = await freshModule()
    ctl.failWasm = true
    ls.setItem(STORAGE_KEY, JSON.stringify(sample))
    const res = await m.createSqliteAdapter().load()
    expect(res).toEqual({ data: sample, status: 'unavailable' })
    expect(await storedBytes()).toBeNull()
  })

  it('AC-04: after a WASM load failure save() returns false without writing', async () => {
    const m = await freshModule()
    ctl.failWasm = true
    const a = m.createSqliteAdapter()
    await a.load()
    ctl.failWasm = false
    expect(await a.save(sample)).toBe(false)
    expect(await storedBytes()).toBeNull()
  })

  it('AC-04: save returns false (never throws) when WASM is unavailable', async () => {
    const m = await freshModule()
    ctl.failWasm = true
    expect(await m.createSqliteAdapter().save(sample)).toBe(false)
  })

  it('AC-04: WASM failure does not touch stored data and a later adapter recovers (retry)', async () => {
    await createSqliteAdapter().save(sample)
    const before = await storedBytes()
    const m = await freshModule()
    ctl.failWasm = true
    expect((await m.createSqliteAdapter().load()).status).toBe('unavailable')
    expect(await storedBytes()).toEqual(before)
    ctl.failWasm = false
    const res = await m.createSqliteAdapter().load()
    expect(res.status).toBe('ok')
    expect(res.data).toEqual(sample)
  })

  it('AC-04: WASM failure with valid legacy data does not delete the legacy key', async () => {
    const m = await freshModule()
    ctl.failWasm = true
    const raw = JSON.stringify(sample)
    ls.setItem(STORAGE_KEY, raw)
    await m.createSqliteAdapter().load()
    expect(ls.getItem(STORAGE_KEY)).toBe(raw)
  })
})

describe('AC-04 sqliteStorage: IndexedDB unavailable', () => {
  it('AC-04: indexedDB undefined => load unavailable with empty data, save false', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const a = createSqliteAdapter()
    expect(await a.load()).toEqual({ data: EMPTY, status: 'unavailable' })
    expect(await a.save(sample)).toBe(false)
  })

  it('AC-04: indexedDB undefined with legacy data => legacy data in memory with status unavailable', async () => {
    ls.setItem(STORAGE_KEY, JSON.stringify(sample))
    vi.stubGlobal('indexedDB', undefined)
    expect(await createSqliteAdapter().load()).toEqual({ data: sample, status: 'unavailable' })
  })

  it('AC-04: invalid legacy data with indexedDB undefined => empty data, unavailable', async () => {
    ls.setItem(STORAGE_KEY, '{bad')
    vi.stubGlobal('indexedDB', undefined)
    expect(await createSqliteAdapter().load()).toEqual({ data: EMPTY, status: 'unavailable' })
  })

  it('AC-04: failed read then save() returns false immediately and the existing blob is untouched', async () => {
    const real = new IDBFactory()
    vi.stubGlobal('indexedDB', real)
    await createSqliteAdapter().save(sample)
    const before = await storedBytes()
    vi.stubGlobal('indexedDB', brokenFactory('onerror'))
    const a = createSqliteAdapter()
    expect((await a.load()).status).toBe('unavailable')
    vi.stubGlobal('indexedDB', real)
    expect(await a.save({ incidents: [], tasks: [] })).toBe(false)
    expect(await storedBytes()).toEqual(before)
  })

  it.each([['onerror'], ['onblocked'], ['throw']] as const)(
    'AC-04: IndexedDB open failing (%s) => unavailable, save false',
    async (kind) => {
      vi.stubGlobal('indexedDB', brokenFactory(kind))
      const a = createSqliteAdapter()
      expect((await a.load()).status).toBe('unavailable')
      expect(await a.save(sample)).toBe(false)
    },
  )

  it('AC-04: quota exceeded on write => save returns false, load of existing data still works', async () => {
    const real = new IDBFactory()
    vi.stubGlobal('indexedDB', real)
    await createSqliteAdapter().save(sample)
    vi.stubGlobal('indexedDB', readOnlyFactory(real))
    const a = createSqliteAdapter()
    const res = await a.load()
    expect(res.status).toBe('ok')
    expect(res.data).toEqual(sample)
    expect(await a.save({ incidents: [], tasks: [] })).toBe(false)
  })
})

describe('AC-04 sqliteStorage: legacy LocalStorage migration', () => {
  it('AC-04: valid legacy data is imported into a new database, flagged migrated, key retained', async () => {
    const raw = JSON.stringify(sample)
    ls.setItem(STORAGE_KEY, raw)
    const res = await createSqliteAdapter().load()
    expect(res.status).toBe('ok')
    expect(res.migrated).toBe(true)
    expect(res.data).toEqual(sample)
    expect(ls.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('AC-04: migrated data is durable in SQLite and a new load does not report migrated again', async () => {
    ls.setItem(STORAGE_KEY, JSON.stringify(sample))
    await createSqliteAdapter().load()
    const r = await readDbBlob()
    if (!r.ok || r.blob === null) throw new Error('no blob')
    const db = await newDb(r.blob)
    expect(getMeta(db, META_LEGACY_MIGRATED)).not.toBeNull()
    db.close()
    const again = await createSqliteAdapter().load()
    expect(again.status).toBe('ok')
    expect(again.data).toEqual(sample)
    expect(again.migrated).toBeUndefined()
  })

  it('AC-04: idempotent: after the user deletes everything the legacy copy is not re-imported', async () => {
    ls.setItem(STORAGE_KEY, JSON.stringify(sample))
    const a = createSqliteAdapter()
    await a.load()
    expect(await a.save(EMPTY)).toBe(true)
    const res = await createSqliteAdapter().load()
    expect(res.data).toEqual(EMPTY)
    expect(res.migrated).toBeUndefined()
    expect(ls.getItem(STORAGE_KEY)).toBe(JSON.stringify(sample))
  })

  it('AC-04: idempotent: later changes to the legacy key never overwrite non-empty SQLite data', async () => {
    ls.setItem(STORAGE_KEY, JSON.stringify(sample))
    await createSqliteAdapter().load()
    ls.setItem(STORAGE_KEY, JSON.stringify({ incidents: [makeIncident({ id: 'other' })], tasks: [] }))
    const res = await createSqliteAdapter().load()
    expect(res.data).toEqual(sample)
  })

  it('AC-04: existing non-empty SQLite data wins over a legacy key (no import)', async () => {
    await createSqliteAdapter().save({ incidents: [bare], tasks: [] })
    ls.setItem(STORAGE_KEY, JSON.stringify(sample))
    const res = await createSqliteAdapter().load()
    expect(res.data).toEqual({ incidents: [bare], tasks: [] })
    expect(res.migrated).toBeUndefined()
  })

  it.each([
    ['malformed JSON', '{bad'],
    ['wrong shape', JSON.stringify({ incidents: [{ id: 1 }], tasks: [] })],
  ])('AC-04: invalid legacy data (%s) is not imported: corrupt, empty, key retained, nothing written', async (_n, raw) => {
    ls.setItem(STORAGE_KEY, raw)
    const res = await createSqliteAdapter().load()
    expect(res).toEqual({ data: EMPTY, status: 'corrupt' })
    expect(ls.getItem(STORAGE_KEY)).toBe(raw)
    expect(await storedBytes()).toBeNull()
  })

  it('AC-04: no legacy key and no database => empty, no migration', async () => {
    const res = await createSqliteAdapter().load()
    expect(res.migrated).toBeUndefined()
    expect(res.status).toBe('empty')
  })

  it('AC-04: empty legacy payload is not treated as a migration', async () => {
    ls.setItem(STORAGE_KEY, JSON.stringify(EMPTY))
    const res = await createSqliteAdapter().load()
    expect(res.migrated).toBeUndefined()
    expect(res.data).toEqual(EMPTY)
  })

  it('AC-04: repeated load() on the same adapter imports only once', async () => {
    ls.setItem(STORAGE_KEY, JSON.stringify(sample))
    const a = createSqliteAdapter()
    const [r1, r2] = await Promise.all([a.load(), a.load()])
    expect(r1).toBe(r2)
    expect(r1.migrated).toBe(true)
  })

  it('AC-04: if the migrated copy cannot be written, legacy data is used in memory as unavailable and the key is kept', async () => {
    const real = new IDBFactory()
    vi.stubGlobal('indexedDB', readOnlyFactory(real))
    const raw = JSON.stringify(sample)
    ls.setItem(STORAGE_KEY, raw)
    const res = await createSqliteAdapter().load()
    expect(res.status).toBe('unavailable')
    expect(res.data).toEqual(sample)
    expect(res.migrated).toBeUndefined()
    expect(ls.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('AC-04: a legacy-migrated database is retried on the next load when the first write failed', async () => {
    const real = new IDBFactory()
    vi.stubGlobal('indexedDB', readOnlyFactory(real))
    ls.setItem(STORAGE_KEY, JSON.stringify(sample))
    await createSqliteAdapter().load()
    vi.stubGlobal('indexedDB', real)
    const res = await createSqliteAdapter().load()
    expect(res.migrated).toBe(true)
    expect(res.data).toEqual(sample)
  })
})
