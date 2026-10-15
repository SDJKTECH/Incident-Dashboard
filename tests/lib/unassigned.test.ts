import { describe, it, expect } from 'vitest'
import { countUnassignedOpen } from '../../src/lib/unassigned'
import { makeIncident } from '../helpers/factories'

describe('countUnassignedOpen', () => {
  it('AC-01.7: counts open incidents with empty assignee', () => {
    expect(countUnassignedOpen([makeIncident({ status: 'open', assignee: '' })])).toBe(1)
  })

  it('AC-01.7: counts investigating incidents with empty assignee', () => {
    expect(countUnassignedOpen([makeIncident({ status: 'investigating', assignee: '' })])).toBe(1)
  })

  it('AC-01.7: counts whitespace-only assignee as unassigned', () => {
    expect(countUnassignedOpen([makeIncident({ status: 'open', assignee: '  ' })])).toBe(1)
  })

  it('AC-01.7: does not count an assigned incident', () => {
    expect(countUnassignedOpen([makeIncident({ status: 'open', assignee: 'alice' })])).toBe(0)
  })

  it('AC-01.8: does not count resolved incidents with empty assignee', () => {
    expect(countUnassignedOpen([makeIncident({ status: 'resolved', assignee: '' })])).toBe(0)
  })

  it('AC-01.8: does not count closed incidents with empty assignee', () => {
    expect(countUnassignedOpen([makeIncident({ status: 'closed', assignee: '' })])).toBe(0)
  })

  it('AC-01.8: empty input returns 0', () => {
    expect(countUnassignedOpen([])).toBe(0)
  })

  it('AC-01.7: counts only matching incidents in a mixed list', () => {
    const list = [
      makeIncident({ status: 'open', assignee: '' }),
      makeIncident({ status: 'investigating', assignee: ' ' }),
      makeIncident({ status: 'open', assignee: 'bob' }),
      makeIncident({ status: 'resolved', assignee: '' }),
      makeIncident({ status: 'closed', assignee: '' }),
    ]
    expect(countUnassignedOpen(list)).toBe(2)
  })
})
