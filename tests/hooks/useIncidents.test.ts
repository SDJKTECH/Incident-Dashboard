import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useIncidents } from '../../src/hooks/useIncidents'
import type { UseIncidentsApi } from '../../src/hooks/useIncidents'
import type { CreateIncidentResult, CreateTaskResult, MutationResult } from '../../src/types/inputs'
import { createFakeAdapter } from '../helpers/fakeAdapter'
import type { FakeAdapter } from '../helpers/fakeAdapter'

async function setup(): Promise<{ result: { current: UseIncidentsApi }; adapter: FakeAdapter }> {
  let n = 0
  let t = 0
  const newId = (): string => `id-${++n}`
  const now = (): string => new Date(Date.UTC(2026, 0, 1, 0, 0, ++t)).toISOString()
  const adapter = createFakeAdapter()
  const { result } = renderHook(() => useIncidents({ now, newId, adapter }))
  await waitFor(() => expect(result.current.loadStatus).not.toBe('loading'))
  return { result, adapter }
}

describe('AC-03 create incident', async () => {
  it('AC-03: assigns unique id, createdAt and updatedAt; applies defaults', async () => {
    const { result } = await setup()
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    await act(async () => { result.current.createIncident({ title: 'B' }) })
    const [a, b] = result.current.incidents
    expect(a.id).not.toBe(b.id)
    expect(a.createdAt).toBeTruthy()
    expect(a.updatedAt).toBe(a.createdAt)
    expect(a.severity).toBe('medium')
    expect(a.status).toBe('open')
    expect(a.resolvedAt).toBeUndefined()
  })

  it('AC-03: trims title and returns ok with the incident', async () => {
    const { result } = await setup()
    let res: CreateIncidentResult | undefined
    await act(async () => { res = result.current.createIncident({ title: '  Hello  ' }) })
    expect(res?.ok).toBe(true)
    expect(result.current.incidents[0].title).toBe('Hello')
  })

  it.each([[''], ['   '], ['\t\n']])('AC-03: title %j rejected, not stored or saved', async (title) => {
    const { result, adapter } = await setup()
    let res: CreateIncidentResult | undefined
    await act(async () => { res = result.current.createIncident({ title }) })
    expect(res?.ok).toBe(false)
    if (res && !res.ok) expect(res.error).toBeTruthy()
    expect(result.current.incidents).toHaveLength(0)
    expect(adapter.save).not.toHaveBeenCalled()
  })

  it('AC-03: creating directly as resolved sets resolvedAt', async () => {
    const { result } = await setup()
    await act(async () => { result.current.createIncident({ title: 'A', status: 'resolved' }) })
    expect(result.current.incidents[0].resolvedAt).toBe(result.current.incidents[0].createdAt)
  })
})

describe('AC-03 update / resolve / reopen', async () => {
  it('AC-03: update persists changes and bumps updatedAt, createdAt unchanged', async () => {
    const { result, adapter } = await setup()
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    const orig = result.current.incidents[0]
    let res: MutationResult | undefined
    await act(async () => { res = result.current.updateIncident(orig.id, { title: 'New', severity: 'critical' }) })
    expect(res).toEqual({ ok: true })
    const upd = result.current.incidents[0]
    expect(upd.title).toBe('New')
    expect(upd.severity).toBe('critical')
    expect(upd.updatedAt > orig.updatedAt).toBe(true)
    expect(upd.createdAt).toBe(orig.createdAt)
    expect(adapter.lastSaved().incidents[0].title).toBe('New')
  })

  it('AC-03: update with empty title is rejected and leaves incident unchanged', async () => {
    const { result } = await setup()
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    const orig = result.current.incidents[0]
    let res: MutationResult | undefined
    await act(async () => { res = result.current.updateIncident(orig.id, { title: '  ' }) })
    expect(res?.ok).toBe(false)
    expect(result.current.incidents[0]).toEqual(orig)
  })

  it('AC-03: resolving sets resolvedAt; reopening clears it', async () => {
    const { result, adapter } = await setup()
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    const id = result.current.incidents[0].id
    await act(async () => { result.current.updateIncident(id, { status: 'resolved' }) })
    expect(result.current.incidents[0].resolvedAt).toBeTruthy()
    expect(adapter.lastSaved().incidents[0].resolvedAt).toBeTruthy()
    await act(async () => { result.current.updateIncident(id, { status: 'open' }) })
    expect(result.current.incidents[0].resolvedAt).toBeUndefined()
    expect(adapter.lastSaved().incidents[0].resolvedAt).toBeUndefined()
  })

  it('AC-03: resolved -> closed keeps resolvedAt', async () => {
    const { result } = await setup()
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    const id = result.current.incidents[0].id
    await act(async () => { result.current.updateIncident(id, { status: 'resolved' }) })
    const r = result.current.incidents[0].resolvedAt
    await act(async () => { result.current.updateIncident(id, { status: 'closed' }) })
    expect(result.current.incidents[0].resolvedAt).toBe(r)
  })

  it('AC-03: updateIncident on unknown id returns ok:false Not found and changes nothing', async () => {
    const { result, adapter } = await setup()
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    const before = result.current.incidents
    const savesBefore = adapter.save.mock.calls.length
    let res: MutationResult | undefined
    await act(async () => { res = result.current.updateIncident('does-not-exist', { title: 'X' }) })
    expect(res).toEqual({ ok: false, error: 'Not found' })
    expect(result.current.incidents).toBe(before)
    expect(adapter.save.mock.calls.length).toBe(savesBefore)
  })

  it('AC-03: updateTask on unknown id returns ok:false Not found and changes nothing', async () => {
    const { result, adapter } = await setup()
    await act(async () => { result.current.createTask({ title: 'T' }) })
    const before = result.current.tasks
    const savesBefore = adapter.save.mock.calls.length
    let res: MutationResult | undefined
    await act(async () => { res = result.current.updateTask('does-not-exist', { title: 'X' }) })
    expect(res).toEqual({ ok: false, error: 'Not found' })
    expect(result.current.tasks).toBe(before)
    expect(adapter.save.mock.calls.length).toBe(savesBefore)
  })

  it('AC-03: undefined incident patch keys do not clobber required fields', async () => {
    const { result } = await setup()
    await act(async () => {
      result.current.createIncident({
        title: 'A', description: 'd', severity: 'high', status: 'investigating', assignee: 'bob', tags: ['x'],
      })
    })
    const orig = result.current.incidents[0]
    await act(async () => {
      result.current.updateIncident(orig.id, {
        title: undefined, description: undefined, severity: undefined,
        status: undefined, assignee: undefined, tags: undefined,
      })
    })
    const u = result.current.incidents[0]
    expect(u.title).toBe('A')
    expect(u.description).toBe('d')
    expect(u.severity).toBe('high')
    expect(u.status).toBe('investigating')
    expect(u.assignee).toBe('bob')
    expect(u.tags).toEqual(['x'])
  })

  it('AC-03: undefined task title/status/priority do not clobber; incidentId/dueDate undefined clear', async () => {
    const { result, adapter } = await setup()
    await act(async () => { result.current.createTask({ title: 'T', priority: 'high', incidentId: 'inc', dueDate: '2026-02-02' }) })
    const id = result.current.tasks[0].id
    await act(async () => { result.current.setTaskStatus(id, 'in_progress') })
    await act(async () => {
      result.current.updateTask(id, { title: undefined, status: undefined, priority: undefined })
    })
    let t = result.current.tasks[0]
    expect(t.title).toBe('T')
    expect(t.status).toBe('in_progress')
    expect(t.priority).toBe('high')
    expect(t.incidentId).toBe('inc')
    expect(t.dueDate).toBe('2026-02-02')
    await act(async () => { result.current.updateTask(id, { incidentId: undefined, dueDate: undefined }) })
    t = result.current.tasks[0]
    expect(t.incidentId).toBeUndefined()
    expect(t.dueDate).toBeUndefined()
    expect(adapter.lastSaved().tasks[0].dueDate).toBeUndefined()
  })

  it('AC-03: tags passed to createIncident are copied, later input mutation does not affect state', async () => {
    const { result } = await setup()
    const tags = ['a', 'b']
    await act(async () => { result.current.createIncident({ title: 'A', tags }) })
    tags.push('c')
    tags[0] = 'zzz'
    expect(result.current.incidents[0].tags).toEqual(['a', 'b'])
    expect(result.current.incidents[0].tags).not.toBe(tags)
  })

  it('AC-03: tags passed to updateIncident are copied', async () => {
    const { result } = await setup()
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    const tags = ['a']
    await act(async () => { result.current.updateIncident(result.current.incidents[0].id, { tags }) })
    tags.push('b')
    expect(result.current.incidents[0].tags).toEqual(['a'])
  })
})

describe('AC-03 delete', async () => {
  it('AC-03: deleting an incident removes it from state and storage', async () => {
    const { result, adapter } = await setup()
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    await act(async () => { result.current.createIncident({ title: 'B' }) })
    const [a, b] = result.current.incidents
    await act(async () => { result.current.deleteIncident(a.id) })
    expect(result.current.incidents.map((i) => i.id)).toEqual([b.id])
    expect(adapter.lastSaved().incidents.map((i) => i.id)).toEqual([b.id])
  })

  it('AC-03: deleting an incident unlinks its tasks without deleting them', async () => {
    const { result, adapter } = await setup()
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    const id = result.current.incidents[0].id
    await act(async () => { result.current.createTask({ title: 'T1', incidentId: id }) })
    await act(async () => { result.current.createTask({ title: 'T2', incidentId: id }) })
    await act(async () => { result.current.createTask({ title: 'T3' }) })
    await act(async () => { result.current.deleteIncident(id) })
    expect(result.current.tasks).toHaveLength(3)
    for (const t of result.current.tasks) expect('incidentId' in t).toBe(false)
    const s = adapter.lastSaved()
    expect(s.tasks).toHaveLength(3)
    expect(s.tasks.every((t) => t.incidentId === undefined)).toBe(true)
  })

  it('AC-03: deleting an incident leaves tasks linked to other incidents intact', async () => {
    const { result } = await setup()
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    await act(async () => { result.current.createIncident({ title: 'B' }) })
    const [a, b] = result.current.incidents
    await act(async () => { result.current.createTask({ title: 'T', incidentId: b.id }) })
    await act(async () => { result.current.deleteIncident(a.id) })
    expect(result.current.tasks[0].incidentId).toBe(b.id)
  })

  it('AC-03: deleteTask removes task from state and storage', async () => {
    const { result, adapter } = await setup()
    await act(async () => { result.current.createTask({ title: 'T' }) })
    const id = result.current.tasks[0].id
    await act(async () => { result.current.deleteTask(id) })
    expect(result.current.tasks).toHaveLength(0)
    expect(adapter.lastSaved().tasks).toHaveLength(0)
  })
})

describe('AC-03 tasks', async () => {
  it('AC-03: task created without incidentId has no link and defaults', async () => {
    const { result } = await setup()
    let res: CreateTaskResult | undefined
    await act(async () => { res = result.current.createTask({ title: 'T' }) })
    expect(res?.ok).toBe(true)
    const t = result.current.tasks[0]
    expect(t.incidentId).toBeUndefined()
    expect(t.status).toBe('todo')
    expect(t.priority).toBe('medium')
    expect(t.id).toBeTruthy()
    expect(t.createdAt).toBeTruthy()
  })

  it('AC-03: task created with incidentId is linked', async () => {
    const { result, adapter } = await setup()
    await act(async () => { result.current.createIncident({ title: 'A' }) })
    const id = result.current.incidents[0].id
    await act(async () => { result.current.createTask({ title: 'T', incidentId: id }) })
    expect(result.current.tasks[0].incidentId).toBe(id)
    expect(adapter.lastSaved().tasks[0].incidentId).toBe(id)
  })

  it('AC-03: tasks get unique ids', async () => {
    const { result } = await setup()
    await act(async () => { result.current.createTask({ title: 'T1' }) })
    await act(async () => { result.current.createTask({ title: 'T2' }) })
    expect(result.current.tasks[0].id).not.toBe(result.current.tasks[1].id)
  })

  it.each([[''], ['  ']])('AC-03: task with title %j rejected, not stored or saved', async (title) => {
    const { result, adapter } = await setup()
    let res: CreateTaskResult | undefined
    await act(async () => { res = result.current.createTask({ title }) })
    expect(res?.ok).toBe(false)
    expect(result.current.tasks).toHaveLength(0)
    expect(adapter.save).not.toHaveBeenCalled()
  })

  it('AC-03: task status moves among todo / in_progress / done', async () => {
    const { result, adapter } = await setup()
    await act(async () => { result.current.createTask({ title: 'T' }) })
    const id = result.current.tasks[0].id
    for (const s of ['in_progress', 'done', 'todo', 'done', 'in_progress'] as const) {
      await act(async () => { result.current.setTaskStatus(id, s) })
      expect(result.current.tasks[0].status).toBe(s)
      expect(adapter.lastSaved().tasks[0].status).toBe(s)
    }
  })

  it('AC-03: updateTask can clear incidentId and changes persist', async () => {
    const { result } = await setup()
    await act(async () => { result.current.createTask({ title: 'T', incidentId: 'x' }) })
    const id = result.current.tasks[0].id
    await act(async () => { result.current.updateTask(id, { incidentId: undefined, priority: 'high' }) })
    expect(result.current.tasks[0].incidentId).toBeUndefined()
    expect(result.current.tasks[0].priority).toBe('high')
  })

  it('AC-03: updateTask with empty title is rejected', async () => {
    const { result } = await setup()
    await act(async () => { result.current.createTask({ title: 'T' }) })
    let res: MutationResult | undefined
    await act(async () => { res = result.current.updateTask(result.current.tasks[0].id, { title: ' ' }) })
    expect(res?.ok).toBe(false)
    expect(result.current.tasks[0].title).toBe('T')
  })
})
