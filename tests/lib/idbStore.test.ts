// @vitest-environment node
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { brokenFactory, readOnlyFactory } from '../helpers/idbFactories'
import { BLOB_KEY, DB_NAME, STORE_NAME, readDbBlob, writeDbBlob } from '../../src/lib/idbStore'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

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

describe('AC-04 idbStore: read/write round trip', () => {
  it('AC-04: reading before anything is stored returns ok with a null blob', async () => {
    expect(await readDbBlob()).toEqual({ ok: true, blob: null })
  })

  it('AC-04: a written blob is read back byte-for-byte', async () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 128])
    expect(await writeDbBlob(bytes)).toEqual({ ok: true })
    const res = await readDbBlob()
    expect(res.ok).toBe(true)
    if (res.ok) expect(Array.from(res.blob ?? [])).toEqual([0, 1, 2, 255, 128])
  })

  it('AC-04: a second write replaces the first', async () => {
    await writeDbBlob(new Uint8Array([1]))
    await writeDbBlob(new Uint8Array([2, 3]))
    const res = await readDbBlob()
    if (!res.ok) throw new Error('read failed')
    expect(Array.from(res.blob ?? [])).toEqual([2, 3])
  })

  it('AC-04: a zero-length stored blob is reported as corrupt with a null blob', async () => {
    await writeDbBlob(new Uint8Array(0))
    expect(await readDbBlob()).toEqual({ ok: true, blob: null, corrupt: true })
  })

  it('AC-04: a stored ArrayBuffer is returned as a Uint8Array', async () => {
    await putRaw(new Uint8Array([9, 8]).buffer)
    const res = await readDbBlob()
    if (!res.ok || res.blob === null) throw new Error('expected blob')
    expect(Array.from(res.blob)).toEqual([9, 8])
  })

  it.each([['string', 'not bytes'], ['number', 42], ['object', { a: 1 }], ['plain array', [1, 2]]])(
    'AC-04: a stored %s is reported as corrupt with a null blob, not a throw',
    async (_n, value) => {
      await putRaw(value)
      expect(await readDbBlob()).toEqual({ ok: true, blob: null, corrupt: true })
    },
  )

  it('AC-04: a missing key has no corrupt flag', async () => {
    const res = await readDbBlob()
    expect(res).toEqual({ ok: true, blob: null })
    expect('corrupt' in res).toBe(false)
  })

  it('AC-04: a valid non-empty blob has no corrupt flag', async () => {
    await writeDbBlob(new Uint8Array([1]))
    const res = await readDbBlob()
    expect(res.ok && res.corrupt).toBeFalsy()
  })
})

describe('AC-04 idbStore: failures never throw', () => {
  it('AC-04: indexedDB undefined => read and write resolve ok:false', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const r = await readDbBlob()
    expect(r.ok).toBe(false)
    const w = await writeDbBlob(new Uint8Array([1]))
    expect(w.ok).toBe(false)
    if (!w.ok) expect(w.error).toMatch(/not available/i)
  })

  it.each([['onerror'], ['onblocked'], ['throw']] as const)(
    'AC-04: open failing via %s => read and write resolve ok:false',
    async (kind) => {
      vi.stubGlobal('indexedDB', brokenFactory(kind))
      const r = await readDbBlob()
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toBeTruthy()
      const w = await writeDbBlob(new Uint8Array([1]))
      expect(w.ok).toBe(false)
    },
  )

  it('AC-04: a failing write transaction (quota) resolves ok:false and leaves reads working', async () => {
    const real = new IDBFactory()
    vi.stubGlobal('indexedDB', readOnlyFactory(real))
    const w = await writeDbBlob(new Uint8Array([1]))
    expect(w.ok).toBe(false)
    if (!w.ok) expect(w.error).toMatch(/quota/i)
    expect(await readDbBlob()).toEqual({ ok: true, blob: null })
  })
})
