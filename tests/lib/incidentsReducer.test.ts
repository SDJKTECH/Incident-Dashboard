import { describe, expect, it } from 'vitest'
import { incidentsReducer } from '../../src/lib/incidentsReducer'
import type { AppData } from '../../src/types/store'
import type { Incident } from '../../src/types/incident'
import type { Task } from '../../src/types/task'

const T0 = '2026-01-01T00:00:00.000Z'
const T1 = '2026-01-02T00:00:00.000Z'
const inc: Incident = {
  id: 'i1', title: 'A', description: '', severity: 'low', status: 'open',
  assignee: '', tags: [], createdAt: T0, updatedAt: T0,
}
const task: Task = { id: 't1', incidentId: 'i1', title: 'x', status: 'todo', priority: 'low', createdAt: T0 }
const state: AppData = { incidents: [inc], tasks: [task] }

describe('AC-03 incidentsReducer', () => {
  it('AC-03: incident/update bumps updatedAt and applies patch', () => {
    const s = incidentsReducer(state, { type: 'incident/update', id: 'i1', patch: { title: 'B' }, now: T1 })
    expect(s.incidents[0].title).toBe('B')
    expect(s.incidents[0].updatedAt).toBe(T1)
    expect(s.incidents[0].createdAt).toBe(T0)
  })

  it('AC-03: status patch to resolved sets resolvedAt, back to open clears it', () => {
    const r = incidentsReducer(state, { type: 'incident/update', id: 'i1', patch: { status: 'resolved' }, now: T1 })
    expect(r.incidents[0].resolvedAt).toBe(T1)
    const o = incidentsReducer(r, { type: 'incident/update', id: 'i1', patch: { status: 'open' }, now: '2026-01-03T00:00:00.000Z' })
    expect(o.incidents[0].resolvedAt).toBeUndefined()
  })

  it('AC-03: incident/delete removes incident and unlinks (not deletes) tasks', () => {
    const s = incidentsReducer(state, { type: 'incident/delete', id: 'i1' })
    expect(s.incidents).toHaveLength(0)
    expect(s.tasks).toHaveLength(1)
    expect('incidentId' in s.tasks[0]).toBe(false)
  })

  it('AC-03: task/setStatus changes status; task/delete removes', () => {
    const s = incidentsReducer(state, { type: 'task/setStatus', id: 't1', status: 'done' })
    expect(s.tasks[0].status).toBe('done')
    expect(incidentsReducer(s, { type: 'task/delete', id: 't1' }).tasks).toHaveLength(0)
  })

  it('AC-03: does not mutate previous state', () => {
    const frozen: AppData = Object.freeze({
      incidents: Object.freeze([inc]) as unknown as Incident[],
      tasks: Object.freeze([task]) as unknown as Task[],
    })
    expect(() => incidentsReducer(frozen, { type: 'incident/delete', id: 'i1' })).not.toThrow()
    expect(frozen.incidents).toHaveLength(1)
  })

  it('AC-03: unknown id on update is a no-op on data', () => {
    const s = incidentsReducer(state, { type: 'incident/update', id: 'zzz', patch: { title: 'Q' }, now: T1 })
    expect(s).toEqual(state)
  })

  it('AC-03: unknown id returns the identical state reference for every id-based action', () => {
    expect(incidentsReducer(state, { type: 'incident/update', id: 'zzz', patch: { title: 'Q' }, now: T1 })).toBe(state)
    expect(incidentsReducer(state, { type: 'incident/delete', id: 'zzz' })).toBe(state)
    expect(incidentsReducer(state, { type: 'task/update', id: 'zzz', patch: { title: 'Q' } })).toBe(state)
    expect(incidentsReducer(state, { type: 'task/delete', id: 'zzz' })).toBe(state)
    expect(incidentsReducer(state, { type: 'task/setStatus', id: 'zzz', status: 'done' })).toBe(state)
  })

  it('AC-03: known id returns a new state reference', () => {
    expect(incidentsReducer(state, { type: 'task/setStatus', id: 't1', status: 'done' })).not.toBe(state)
  })

  it('AC-03: incident/update ignores undefined patch values for required fields', () => {
    const s = incidentsReducer(state, {
      type: 'incident/update', id: 'i1', now: T1,
      patch: { title: undefined, description: undefined, severity: undefined, status: undefined, assignee: undefined, tags: undefined },
    })
    expect(s.incidents[0]).toEqual({ ...inc, updatedAt: T1 })
  })

  it('AC-03: task/update ignores undefined title/status/priority but clears incidentId/dueDate', () => {
    const withDue: AppData = { incidents: [inc], tasks: [{ ...task, dueDate: '2026-03-03' }] }
    const kept = incidentsReducer(withDue, {
      type: 'task/update', id: 't1', patch: { title: undefined, status: undefined, priority: undefined },
    })
    expect(kept.tasks[0]).toEqual(withDue.tasks[0])
    const cleared = incidentsReducer(withDue, {
      type: 'task/update', id: 't1', patch: { incidentId: undefined, dueDate: undefined },
    })
    expect(cleared.tasks[0].incidentId).toBeUndefined()
    expect(cleared.tasks[0].dueDate).toBeUndefined()
    expect(cleared.tasks[0].title).toBe('x')
  })

  it('AC-03: tags are copied on incident create and update', () => {
    const tags = ['a']
    const c = incidentsReducer({ incidents: [], tasks: [] }, { type: 'incident/create', incident: { ...inc, tags } })
    tags.push('b')
    expect(c.incidents[0].tags).toEqual(['a'])
    const ptags = ['p']
    const u = incidentsReducer(state, { type: 'incident/update', id: 'i1', patch: { tags: ptags }, now: T1 })
    ptags.push('q')
    expect(u.incidents[0].tags).toEqual(['p'])
  })
})
