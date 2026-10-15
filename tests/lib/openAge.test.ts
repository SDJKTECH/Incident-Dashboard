import { describe, it, expect } from 'vitest'
import { meanOpenAgeMs } from '../../src/lib/openAge'
import { makeIncident } from '../helpers/factories'

const NOW = new Date('2025-06-15T12:00:00.000Z')
const NOW_MS = NOW.getTime()
const HOUR = 3_600_000

function ago(ms: number): string {
  return new Date(NOW_MS - ms).toISOString()
}

describe('meanOpenAgeMs', () => {
  it('AC-01.7: returns null for empty input', () => {
    expect(meanOpenAgeMs([], NOW)).toBeNull()
  })

  it('AC-01.7: returns null when every incident is resolved or closed', () => {
    const list = [
      makeIncident({ status: 'resolved', createdAt: ago(HOUR) }),
      makeIncident({ status: 'closed', createdAt: ago(2 * HOUR) }),
    ]
    expect(meanOpenAgeMs(list, NOW)).toBeNull()
  })

  it('AC-01.7: exact mean over open and investigating, ignoring resolved/closed', () => {
    const list = [
      makeIncident({ status: 'open', createdAt: ago(2 * HOUR) }),
      makeIncident({ status: 'investigating', createdAt: ago(4 * HOUR) }),
      makeIncident({ status: 'resolved', createdAt: ago(100 * HOUR) }),
      makeIncident({ status: 'closed', createdAt: ago(200 * HOUR) }),
    ]
    expect(meanOpenAgeMs(list, NOW)).toBe(3 * HOUR)
  })

  it('AC-01.10: an unparseable createdAt is skipped', () => {
    const list = [
      makeIncident({ status: 'open', createdAt: ago(2 * HOUR) }),
      makeIncident({ status: 'open', createdAt: 'not-a-date' }),
    ]
    expect(meanOpenAgeMs(list, NOW)).toBe(2 * HOUR)
  })

  it('AC-01.10: returns null when the only open incident has an unparseable createdAt', () => {
    const list = [makeIncident({ status: 'open', createdAt: 'garbage' })]
    expect(meanOpenAgeMs(list, NOW)).toBeNull()
  })

  it('AC-01.10: a future createdAt counts as age 0', () => {
    const list = [
      makeIncident({ status: 'open', createdAt: new Date(NOW_MS + 5 * HOUR).toISOString() }),
      makeIncident({ status: 'investigating', createdAt: ago(4 * HOUR) }),
    ]
    expect(meanOpenAgeMs(list, NOW)).toBe(2 * HOUR)
  })

  it('AC-01.7: Date and number forms of now agree', () => {
    const list = [
      makeIncident({ status: 'open', createdAt: ago(HOUR) }),
      makeIncident({ status: 'investigating', createdAt: ago(3 * HOUR) }),
    ]
    expect(meanOpenAgeMs(list, NOW_MS)).toBe(meanOpenAgeMs(list, NOW))
    expect(meanOpenAgeMs(list, NOW_MS)).toBe(2 * HOUR)
  })
})
