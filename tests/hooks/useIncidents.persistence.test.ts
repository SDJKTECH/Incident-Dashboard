import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useIncidents } from '../../src/hooks/useIncidents'
import type { UseIncidentsApi, UseIncidentsOptions } from '../../src/hooks/useIncidents'
import type { AppData, LoadResult } from '../../src/types/store'
import { createFakeAdapter } from '../helpers/fakeAdapter'
import type { FakeAdapter, FakeAdapterOptions } from '../helpers/fakeAdapter'
import { makeIncident, makeTask } from '../helpers/factories'

function opts(adapter: FakeAdapter): UseIncidentsOptions {
  let n = 0
  let t = 0
  return {
    adapter,
    newId: (): string => `id-${++n}-${Math.random()}`,
    now: (): string => new Date(Date.UTC(2026, 0, 1, 0, 0, ++t)).toISOString(),
  }
}

async function mount(
  adapterOpts: FakeAdapterOptions = {},
  existing?: FakeAdapter,
): Promise<{ result: { current: UseIncidentsApi }; adapter: FakeAdapter; unmount: () => void }> {
  const adapter = existing ?? createFakeAdapter(adapterOpts)
  const o = opts(adapter)
  const { result, unmount } = renderHook(() => useIncidents(o))
  await waitFor(() => expect(result.current.loadStatus).not.toBe('loading'))
  return { result, adapter, unmount }
}

function loaded(data: AppData, status: LoadResult['status'] = 'ok'): LoadResult {
  return { data, status }
}

const CORRUPT: LoadResult = { data: { incidents: [], tasks: [] }, status: 'corrupt' }

describe('AC-04 async loading', () => {
  it('AC-04: loadStatus is loading until the adapter resolves, then hydrates', async () => {
    const adapter = createFakeAdapter({
      deferLoad: true,
      initial: loaded({ incidents: [makeIncident({ id: 'a', title: 'Seeded' })], tasks: [] }),
    })
    const { result } = renderHook(() => useIncidents(opts(adapter)))
    expect(result.current.loadStatus).toBe('loading')
    expect(result.current.incidents).toEqual([])
    await act(async () => { adapter.release() })
    await waitFor(() => expect(result.current.loadStatus).toBe('ok'))
    expect(result.current.incidents.map((i) => i.title)).toEqual(['Seeded'])
  })

  it('AC-04: create mutations during loading are rejected with Still loading and nothing is saved', async () => {
    const adapter = createFakeAdapter({ deferLoad: true })
    const { result } = renderHook(() => useIncidents(opts(adapter)))
    let ri: unknown
    let rt: unknown
    act(() => { ri = result.current.createIncident({ title: 'Too early' }) })
    act(() => { rt = result.current.createTask({ title: 'Too early' }) })
    expect(ri).toEqual({ ok: false, error: 'Still loading' })
    expect(rt).toEqual({ ok: false, error: 'Still loading' })
    expect(result.current.incidents).toEqual([])
    await act(async () => { adapter.release() })
    await waitFor(() => expect(result.current.loadStatus).toBe('empty'))
    expect(adapter.save).not.toHaveBeenCalled()
  })

  it('AC-04: other mutations during loading are no-ops and never save', async () => {
    const adapter = createFakeAdapter({ deferLoad: true })
    const { result } = renderHook(() => useIncidents(opts(adapter)))
    act(() => {
      result.current.updateIncident('x', { title: 'Y' })
      result.current.updateTask('x', { title: 'Y' })
      result.current.deleteIncident('x')
      result.current.deleteTask('x')
      result.current.setTaskStatus('x', 'done')
    })
    await act(async () => { adapter.release() })
    await waitFor(() => expect(result.current.loadStatus).not.toBe('loading'))
    expect(adapter.save).not.toHaveBeenCalled()
  })

  it('AC-04: an adapter whose load() rejects yields unavailable, persistOk false, still usable', async () => {
    const { result } = await mount({ loadThrows: true })
    expect(result.current.loadStatus).toBe('unavailable')
    expect(result.current.persistOk).toBe(false)
    await act(async () => { result.current.createIncident({ title: 'Mem' }) })
    expect(result.current.incidents.map((i) => i.title)).toEqual(['Mem'])
  })

  it('AC-04: migrated flag from the load result is exposed', async () => {
    const { result } = await mount({
      initial: { data: { incidents: [makeIncident()], tasks: [] }, status: 'ok', migrated: true },
    })
    expect(result.current.migrated).toBe(true)
  })

  it('AC-04: migrated defaults to false', async () => {
    const { result } = await mount()
    expect(result.current.migrated).toBe(false)
  })
})

describe('AC-04 writes after every change', () => {
  it('AC-04: every mutation triggers a save with the latest state', async () => {
    const { result, adapter } = await mount()
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    expect(adapter.lastSaved().incidents).toHaveLength(1)
    const iid = result.current.incidents[0].id
    await act(async () => { result.current.updateIncident(iid, { title: 'A2' }) })
    expect(adapter.lastSaved().incidents[0].title).toBe('A2')
    await act(async () => { result.current.createTask({ title: 'T', incidentId: iid }) })
    expect(adapter.lastSaved().tasks).toHaveLength(1)
    const tid = result.current.tasks[0].id
    await act(async () => { result.current.updateTask(tid, { priority: 'critical' }) })
    expect(adapter.lastSaved().tasks[0].priority).toBe('critical')
    await act(async () => { result.current.setTaskStatus(tid, 'done') })
    expect(adapter.lastSaved().tasks[0].status).toBe('done')
    await act(async () => { result.current.deleteIncident(iid) })
    expect(adapter.lastSaved().incidents).toHaveLength(0)
    expect(adapter.lastSaved().tasks[0].incidentId).toBeUndefined()
    await act(async () => { result.current.deleteTask(tid) })
    expect(adapter.lastSaved().tasks).toHaveLength(0)
    expect(adapter.save).toHaveBeenCalledTimes(7)
  })

  it('AC-04: saves reach the adapter in mutation order', async () => {
    const { result, adapter } = await mount()
    await act(async () => {
      result.current.createIncident({ title: 'One' })
    })
    await act(async () => {
      result.current.createIncident({ title: 'Two' })
    })
    await waitFor(() => expect(adapter.lastSaved().incidents.length).toBe(2))
    const sizes = adapter.save.mock.calls.map(([d]) => d.incidents.length)
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes)
  })

  it('AC-04: persistOk stays true when saves succeed', async () => {
    const { result } = await mount()
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    expect(result.current.persistOk).toBe(true)
  })

  it('AC-04: save returning false flips persistOk to false; state stays in memory', async () => {
    const { result } = await mount({ saveOk: false })
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    expect(result.current.persistOk).toBe(false)
    expect(result.current.incidents).toHaveLength(1)
  })

  it('AC-04: save rejecting flips persistOk to false and does not throw', async () => {
    const { result } = await mount({ saveThrows: true })
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    expect(result.current.persistOk).toBe(false)
    expect(result.current.incidents).toHaveLength(1)
  })
})

describe('AC-04 restore on remount', () => {
  it('AC-04: unmount and remount restores identical incidents and tasks', async () => {
    const first = await mount()
    await act(async () => { first.result.current.createIncident({ title: 'A', severity: 'high', tags: ['x'] }) })
    await act(async () => { first.result.current.createTask({ title: 'T', incidentId: first.result.current.incidents[0].id }) })
    await act(async () => { first.result.current.updateIncident(first.result.current.incidents[0].id, { status: 'resolved' }) })
    const incs = first.result.current.incidents
    const tasks = first.result.current.tasks
    first.unmount()

    const second = await mount({}, first.adapter)
    expect(second.result.current.loadStatus).toBe('ok')
    expect(second.result.current.incidents).toEqual(incs)
    expect(second.result.current.tasks).toEqual(tasks)
    expect(second.result.current.persistOk).toBe(true)
  })

  it('AC-04: fresh start with no data reports loadStatus empty', async () => {
    const { result } = await mount()
    expect(result.current.loadStatus).toBe('empty')
    expect(result.current.incidents).toEqual([])
    expect(result.current.tasks).toEqual([])
    expect(result.current.persistOk).toBe(true)
  })

  it('AC-04: hydration alone does not write (no write until first mutation)', async () => {
    const { adapter, result } = await mount({
      initial: loaded({ incidents: [makeIncident()], tasks: [makeTask()] }),
    })
    expect(result.current.incidents).toHaveLength(1)
    expect(adapter.save).not.toHaveBeenCalled()
  })
})

describe('AC-04 corrupt data', () => {
  it('AC-04: corrupt load yields empty data, status corrupt, and no write before first mutation', async () => {
    const { result, adapter } = await mount({ initial: CORRUPT })
    expect(result.current.loadStatus).toBe('corrupt')
    expect(result.current.incidents).toEqual([])
    expect(result.current.tasks).toEqual([])
    expect(result.current.persistOk).toBe(true)
    expect(adapter.save).not.toHaveBeenCalled()
  })

  it('AC-04: rejected (invalid) mutations on corrupt data do not save', async () => {
    const { result, adapter } = await mount({ initial: CORRUPT })
    await act(async () => { result.current.createIncident({ title: '  ' }) })
    await act(async () => { result.current.createTask({ title: '' }) })
    expect(adapter.save).not.toHaveBeenCalled()
  })

  it.each([
    ['updateIncident', (r: UseIncidentsApi) => { r.updateIncident('nope', { title: 'X' }) }],
    ['updateTask', (r: UseIncidentsApi) => { r.updateTask('nope', { title: 'X' }) }],
    ['deleteIncident', (r: UseIncidentsApi) => { r.deleteIncident('nope') }],
    ['deleteTask', (r: UseIncidentsApi) => { r.deleteTask('nope') }],
    ['setTaskStatus', (r: UseIncidentsApi) => { r.setTaskStatus('nope', 'done') }],
  ])('AC-04: no-op %s does not save; a real mutation afterwards does', async (_n, noop) => {
    const { result, adapter } = await mount({ initial: CORRUPT })
    await act(async () => { noop(result.current) })
    expect(adapter.save).not.toHaveBeenCalled()
    await act(async () => { result.current.createIncident({ title: 'Real' }) })
    expect(adapter.lastSaved().incidents.map((i) => i.title)).toEqual(['Real'])
  })

  it('AC-04: unknown-id updates return Not found', async () => {
    const { result } = await mount()
    let r1: unknown
    let r2: unknown
    await act(async () => { r1 = result.current.updateIncident('nope', { title: 'X' }) })
    await act(async () => { r2 = result.current.updateTask('nope', { title: 'X' }) })
    expect(r1).toEqual({ ok: false, error: 'Not found' })
    expect(r2).toEqual({ ok: false, error: 'Not found' })
  })

  it('AC-04: first user mutation after corrupt load saves valid data; loadStatus stays corrupt', async () => {
    const { result, adapter } = await mount({ initial: CORRUPT })
    await act(async () => { result.current.createIncident({ title: 'Fresh' }) })
    expect(adapter.lastSaved().incidents.map((i) => i.title)).toEqual(['Fresh'])
    expect(result.current.loadStatus).toBe('corrupt')
  })
})

describe('AC-04 unavailable storage', () => {
  it('AC-04: unavailable load => persistOk false, but works in memory', async () => {
    const { result } = await mount({
      saveOk: false,
      initial: { data: { incidents: [], tasks: [] }, status: 'unavailable' },
    })
    expect(result.current.loadStatus).toBe('unavailable')
    expect(result.current.persistOk).toBe(false)
    await act(async () => { result.current.createIncident({ title: 'Mem' }) })
    await act(async () => { result.current.createTask({ title: 'T' }) })
    expect(result.current.incidents.map((i) => i.title)).toEqual(['Mem'])
    expect(result.current.tasks).toHaveLength(1)
    expect(result.current.persistOk).toBe(false)
    await act(async () => { result.current.deleteIncident(result.current.incidents[0].id) })
    expect(result.current.incidents).toHaveLength(0)
  })

  it('AC-04: unavailable hydration with in-memory legacy data keeps that data', async () => {
    const inc = makeIncident({ title: 'Legacy' })
    const { result } = await mount({ initial: { data: { incidents: [inc], tasks: [] }, status: 'unavailable' } })
    expect(result.current.incidents).toEqual([inc])
    expect(result.current.persistOk).toBe(false)
  })
})
