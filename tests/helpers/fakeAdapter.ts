import { vi } from 'vitest'
import type { Mock } from 'vitest'
import type { AppData, LoadResult, PersistenceAdapter } from '../../src/types/store'

export interface FakeAdapter extends PersistenceAdapter {
  load: Mock<() => Promise<LoadResult>>
  save: Mock<(data: AppData) => Promise<boolean>>
  /** Data passed to the most recent save call. Throws if save was never called. */
  lastSaved: () => AppData
  /** Resolves a deferred load (only when created with deferLoad). */
  release: () => void
}

export interface FakeAdapterOptions {
  /** What load() resolves with. Default: empty data, status 'empty'. */
  initial?: LoadResult
  /** Result of save(). Default true. */
  saveOk?: boolean
  /** If true, load() stays pending until release() is called. */
  deferLoad?: boolean
  /** If true, load() rejects. */
  loadThrows?: boolean
  /** If true, save() rejects. */
  saveThrows?: boolean
}

export function emptyResult(): LoadResult {
  return { data: { incidents: [], tasks: [] }, status: 'empty' }
}

/**
 * In-memory PersistenceAdapter. After a successful save, a subsequent load() returns the
 * saved data with status 'ok' so remount/restore flows can be tested.
 */
export function createFakeAdapter(opts: FakeAdapterOptions = {}): FakeAdapter {
  let current: LoadResult = opts.initial ?? emptyResult()
  const saved: AppData[] = []
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  const load = vi.fn(async (): Promise<LoadResult> => {
    if (opts.loadThrows) throw new Error('load failed')
    if (opts.deferLoad) await gate
    return current
  })
  const save = vi.fn(async (data: AppData): Promise<boolean> => {
    if (opts.saveThrows) throw new Error('save failed')
    const snapshot: AppData = structuredClone(data)
    saved.push(snapshot)
    if (opts.saveOk === false) return false
    current = { data: snapshot, status: 'ok' }
    return true
  })

  return {
    load,
    save,
    lastSaved: (): AppData => {
      const last = saved[saved.length - 1]
      if (last === undefined) throw new Error('save was never called')
      return last
    },
    release,
  }
}
