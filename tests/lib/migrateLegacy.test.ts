import { afterEach, describe, expect, it, vi } from 'vitest'
import { migrateLegacy } from '../../src/lib/migrateLegacy'
import type { LegacyMigrationDeps } from '../../src/lib/migrateLegacy'
import { STORAGE_KEY } from '../../src/lib/storage'
import type { AppData } from '../../src/types/store'
import { makeIncident, makeTask } from '../helpers/factories'

function deps(over: Partial<LegacyMigrationDeps> = {}): {
  d: LegacyMigrationDeps
  persist: ReturnType<typeof vi.fn<(data: AppData) => Promise<boolean>>>
  markDone: ReturnType<typeof vi.fn<() => Promise<boolean>>>
} {
  const persist = vi.fn<(data: AppData) => Promise<boolean>>(async () => true)
  const markDone = vi.fn<() => Promise<boolean>>(async () => true)
  return { d: { persist, markDone, ...over }, persist, markDone }
}

const valid: AppData = {
  incidents: [makeIncident({ tags: ['a'], resolvedAt: '2026-01-01T00:00:00.000Z' })],
  tasks: [makeTask({ dueDate: '2026-02-02' })],
}

function seedRaw(raw: string): void {
  localStorage.setItem(STORAGE_KEY, raw)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AC-04 migrateLegacy: valid legacy import', () => {
  it('AC-04: valid legacy data is persisted then marked done, returning migrated with the data', async () => {
    seedRaw(JSON.stringify(valid))
    const { d, persist, markDone } = deps()
    const out = await migrateLegacy(d)
    expect(out).toEqual({ kind: 'migrated', data: valid })
    expect(persist).toHaveBeenCalledTimes(1)
    expect(persist.mock.calls[0][0]).toEqual(valid)
    expect(markDone).toHaveBeenCalledTimes(1)
    expect(persist.mock.invocationCallOrder[0]).toBeLessThan(markDone.mock.invocationCallOrder[0])
  })

  it('AC-04: the legacy key is kept byte-for-byte as a backup after migration', async () => {
    const raw = JSON.stringify(valid)
    seedRaw(raw)
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem')
    const setSpy = vi.spyOn(Storage.prototype, 'setItem')
    await migrateLegacy(deps().d)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
    expect(removeSpy).not.toHaveBeenCalled()
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('AC-04: legacy data with only tasks (no incidents) is still imported', async () => {
    seedRaw(JSON.stringify({ incidents: [], tasks: [makeTask()] }))
    const out = await migrateLegacy(deps().d)
    expect(out.kind).toBe('migrated')
  })
})

describe('AC-04 migrateLegacy: nothing to import', () => {
  it('AC-04: no legacy key => skipped, persist never called', async () => {
    const { d, persist, markDone } = deps()
    expect(await migrateLegacy(d)).toEqual({ kind: 'skipped' })
    expect(persist).not.toHaveBeenCalled()
    expect(markDone).not.toHaveBeenCalled()
  })

  it('AC-04: empty legacy data => skipped', async () => {
    seedRaw(JSON.stringify({ incidents: [], tasks: [] }))
    const { d, persist } = deps()
    expect(await migrateLegacy(d)).toEqual({ kind: 'skipped' })
    expect(persist).not.toHaveBeenCalled()
  })

  it('AC-04: LocalStorage unavailable => skipped without throwing', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { d, persist } = deps()
    expect(await migrateLegacy(d)).toEqual({ kind: 'skipped' })
    expect(persist).not.toHaveBeenCalled()
  })
})

describe('AC-04 migrateLegacy: invalid legacy data is not imported', () => {
  it.each([
    ['malformed JSON', '{bad'],
    ['wrong top-level type', '[]'],
    ['bad enum value', JSON.stringify({ incidents: [{ ...makeIncident(), severity: 'urgent' }], tasks: [] })],
    ['tasks not an array', JSON.stringify({ incidents: [], tasks: 'x' })],
    ['one invalid among valid', JSON.stringify({ incidents: [makeIncident(), { id: 1 }], tasks: [] })],
  ])('AC-04: %s => corrupt, nothing persisted, legacy key retained', async (_n, raw) => {
    seedRaw(raw)
    const { d, persist, markDone } = deps()
    expect(await migrateLegacy(d)).toEqual({ kind: 'corrupt' })
    expect(persist).not.toHaveBeenCalled()
    expect(markDone).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
  })
})

describe('AC-04 migrateLegacy: durability failures', () => {
  it('AC-04: persist resolving false => failed with the legacy data (in-memory), markDone not called', async () => {
    seedRaw(JSON.stringify(valid))
    const { d, markDone } = deps({ persist: async () => false })
    expect(await migrateLegacy(d)).toEqual({ kind: 'failed', data: valid })
    expect(markDone).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('AC-04: persist throwing => failed, does not throw', async () => {
    seedRaw(JSON.stringify(valid))
    const { d, markDone } = deps({
      persist: async () => {
        throw new Error('disk full')
      },
    })
    expect(await migrateLegacy(d)).toEqual({ kind: 'failed', data: valid })
    expect(markDone).not.toHaveBeenCalled()
  })

  it('AC-04: markDone failing (reject or false) still reports migrated because data is durable', async () => {
    seedRaw(JSON.stringify(valid))
    const rejecting = deps({
      markDone: async () => {
        throw new Error('flag write failed')
      },
    })
    expect((await migrateLegacy(rejecting.d)).kind).toBe('migrated')
    const falsy = deps({ markDone: async () => false })
    expect((await migrateLegacy(falsy.d)).kind).toBe('migrated')
  })
})

describe('AC-04 migrateLegacy: idempotence at this layer', () => {
  it('AC-04: re-running with the same valid legacy data never mutates or removes the legacy key', async () => {
    const raw = JSON.stringify(valid)
    seedRaw(raw)
    const first = await migrateLegacy(deps().d)
    const second = await migrateLegacy(deps().d)
    expect(first).toEqual(second)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
  })
})
