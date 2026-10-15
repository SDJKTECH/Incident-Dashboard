import { describe, expect, it } from 'vitest'
import { applyStatusChange, unlinkTasks } from '../../src/lib/incidentRules'
import type { Incident } from '../../src/types/incident'
import type { Task } from '../../src/types/task'

const NOW = '2026-05-05T10:00:00.000Z'
const base: Incident = {
  id: 'i1',
  title: 'T',
  description: '',
  severity: 'low',
  status: 'open',
  assignee: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('AC-03 applyStatusChange', () => {
  it('AC-03: resolving sets resolvedAt to now', () => {
    expect(applyStatusChange(base, 'resolved', NOW).resolvedAt).toBe(NOW)
  })

  it('AC-03: re-resolving an already resolved incident keeps original resolvedAt', () => {
    const resolved: Incident = { ...base, status: 'resolved', resolvedAt: '2026-02-02T00:00:00.000Z' }
    expect(applyStatusChange(resolved, 'resolved', NOW).resolvedAt).toBe(resolved.resolvedAt)
  })

  it.each(['open', 'investigating'] as const)('AC-03: reopening to %s clears resolvedAt', (s) => {
    const resolved: Incident = { ...base, status: 'resolved', resolvedAt: NOW }
    const next = applyStatusChange(resolved, s, '2026-06-06T00:00:00.000Z')
    expect(next.status).toBe(s)
    expect(next.resolvedAt).toBeUndefined()
    expect('resolvedAt' in next).toBe(false)
  })

  it('AC-03: resolved -> closed keeps resolvedAt', () => {
    const resolved: Incident = { ...base, status: 'resolved', resolvedAt: NOW }
    const next = applyStatusChange(resolved, 'closed', '2027-01-01T00:00:00.000Z')
    expect(next.status).toBe('closed')
    expect(next.resolvedAt).toBe(NOW)
  })

  it('AC-03: does not mutate input and does not touch updatedAt', () => {
    const resolved: Incident = Object.freeze({ ...base, status: 'resolved', resolvedAt: NOW })
    const snapshot = { ...resolved }
    const next = applyStatusChange(resolved, 'open', NOW)
    expect(resolved).toEqual(snapshot)
    expect(next).not.toBe(resolved)
    expect(next.updatedAt).toBe(base.updatedAt)
    const frozenOpen: Incident = Object.freeze({ ...base })
    expect(() => applyStatusChange(frozenOpen, 'resolved', NOW)).not.toThrow()
    expect(frozenOpen.resolvedAt).toBeUndefined()
  })
})

describe('AC-03 unlinkTasks', () => {
  const mk = (id: string, incidentId?: string): Task => ({
    id,
    title: id,
    status: 'todo',
    priority: 'medium',
    createdAt: NOW,
    ...(incidentId ? { incidentId } : {}),
  })

  it('AC-03: removes incidentId only for the given incident and keeps every task', () => {
    const tasks = [mk('a', 'i1'), mk('b', 'i2'), mk('c'), mk('d', 'i1')]
    const out = unlinkTasks(tasks, 'i1')
    expect(out).toHaveLength(4)
    expect(out.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd'])
    expect('incidentId' in out[0]).toBe(false)
    expect('incidentId' in out[3]).toBe(false)
    expect(out[1].incidentId).toBe('i2')
    expect(out[2].incidentId).toBeUndefined()
    expect(out[0].title).toBe('a')
  })

  it('AC-03: does not mutate input tasks', () => {
    const tasks = [Object.freeze(mk('a', 'i1'))]
    const out = unlinkTasks(tasks, 'i1')
    expect(tasks[0].incidentId).toBe('i1')
    expect(out[0]).not.toBe(tasks[0])
  })

  it('AC-03: empty list and unknown incident are no-ops', () => {
    expect(unlinkTasks([], 'x')).toEqual([])
    const tasks = [mk('a', 'i1')]
    expect(unlinkTasks(tasks, 'nope')).toEqual(tasks)
  })
})
