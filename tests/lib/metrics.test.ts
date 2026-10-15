import { describe, expect, it } from 'vitest'
import {
  createdInLastDays,
  meanTimeToResolveMs,
  openBySeverity,
  taskCounts,
} from '../../src/lib/metrics'
import { makeIncident, makeTask } from '../helpers/factories'

const HOUR = 3600_000
const DAY = 24 * HOUR
const NOW = Date.parse('2025-06-15T12:00:00.000Z')
const ago = (ms: number): string => new Date(NOW - ms).toISOString()

describe('AC-01 openBySeverity', () => {
  it('AC-01: counts only open and investigating incidents per severity', () => {
    const incidents = [
      makeIncident({ severity: 'critical', status: 'open' }),
      makeIncident({ severity: 'critical', status: 'investigating' }),
      makeIncident({ severity: 'critical', status: 'resolved' }),
      makeIncident({ severity: 'high', status: 'closed' }),
      makeIncident({ severity: 'high', status: 'open' }),
      makeIncident({ severity: 'low', status: 'resolved' }),
    ]
    expect(openBySeverity(incidents)).toEqual({ low: 0, medium: 0, high: 1, critical: 2 })
  })

  it('AC-01: returns zeros for empty input', () => {
    expect(openBySeverity([])).toEqual({ low: 0, medium: 0, high: 0, critical: 0 })
  })
})

describe('AC-01 meanTimeToResolveMs', () => {
  it('AC-01: returns null when no incident has resolvedAt', () => {
    expect(meanTimeToResolveMs([makeIncident(), makeIncident({ status: 'closed' })])).toBeNull()
    expect(meanTimeToResolveMs([])).toBeNull()
  })

  it('AC-01: is the arithmetic mean of resolution durations, ignoring unresolved', () => {
    const incidents = [
      makeIncident({ createdAt: ago(10 * HOUR), resolvedAt: ago(8 * HOUR) }), // 2h
      makeIncident({ createdAt: ago(10 * HOUR), resolvedAt: ago(4 * HOUR) }), // 6h
      makeIncident(),
    ]
    expect(meanTimeToResolveMs(incidents)).toBe(4 * HOUR)
  })

  it('AC-01: skips an invalid resolvedAt rather than returning NaN', () => {
    const incidents = [
      makeIncident({ createdAt: ago(3 * HOUR), resolvedAt: ago(HOUR) }),
      makeIncident({ resolvedAt: 'garbage' }),
    ]
    expect(meanTimeToResolveMs(incidents)).toBe(2 * HOUR)
  })
})

describe('AC-01 taskCounts', () => {
  it('AC-01: completed = done; pending = todo + in_progress', () => {
    const tasks = [
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
      makeTask({ status: 'todo' }),
      makeTask({ status: 'in_progress' }),
    ]
    expect(taskCounts(tasks)).toEqual({ completed: 2, pending: 2 })
  })

  it('AC-01: empty input gives zeros', () => {
    expect(taskCounts([])).toEqual({ completed: 0, pending: 0 })
  })
})

describe('AC-01 createdInLastDays', () => {
  it('AC-01: counts an incident created 6 days ago', () => {
    expect(createdInLastDays([makeIncident({ createdAt: ago(6 * DAY) })], NOW, 7)).toBe(1)
  })

  it('AC-01: does not count an incident created 8 days ago', () => {
    expect(createdInLastDays([makeIncident({ createdAt: ago(8 * DAY) })], NOW, 7)).toBe(0)
  })

  it('AC-01: counts an incident created exactly 7 days ago (boundary)', () => {
    expect(createdInLastDays([makeIncident({ createdAt: ago(7 * DAY) })], NOW, 7)).toBe(1)
  })

  it('AC-01: accepts a Date for now', () => {
    expect(createdInLastDays([makeIncident({ createdAt: ago(DAY) })], new Date(NOW), 7)).toBe(1)
  })

  it('AC-01: empty input gives zero', () => {
    expect(createdInLastDays([], NOW, 7)).toBe(0)
  })
})
