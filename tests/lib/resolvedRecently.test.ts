import { describe, it, expect } from 'vitest'
import { resolvedInLastDays } from '../../src/lib/resolvedRecently'
import { makeIncident } from '../helpers/factories'

const NOW = new Date('2025-06-15T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const ago = (d: number): string => new Date(NOW.getTime() - d * DAY).toISOString()

describe('resolvedInLastDays', () => {
  it('AC-01.5: counts incident resolved 6 days ago', () => {
    expect(resolvedInLastDays([makeIncident({ resolvedAt: ago(6) })], NOW, 7)).toBe(1)
  })

  it('AC-01.5: does not count incident resolved 8 days ago', () => {
    expect(resolvedInLastDays([makeIncident({ resolvedAt: ago(8) })], NOW, 7)).toBe(0)
  })

  it('AC-01.5: exactly 7 days ago is counted (inclusive)', () => {
    expect(resolvedInLastDays([makeIncident({ resolvedAt: ago(7) })], NOW, 7)).toBe(1)
  })

  it('AC-01.7: future resolvedAt is not counted', () => {
    expect(resolvedInLastDays([makeIncident({ resolvedAt: ago(-1) })], NOW, 7)).toBe(0)
  })

  it('AC-01.7: missing resolvedAt is not counted', () => {
    expect(resolvedInLastDays([makeIncident()], NOW, 7)).toBe(0)
  })

  it('AC-01.7: invalid resolvedAt is not counted', () => {
    expect(resolvedInLastDays([makeIncident({ resolvedAt: 'garbage' })], NOW, 7)).toBe(0)
  })

  it('AC-01.9: closed incident with resolvedAt is counted', () => {
    const inc = makeIncident({ status: 'closed', resolvedAt: ago(2) })
    expect(resolvedInLastDays([inc], NOW, 7)).toBe(1)
  })

  it('AC-01.9: Date and number forms of now give the same result', () => {
    const list = [
      makeIncident({ resolvedAt: ago(1) }),
      makeIncident({ resolvedAt: ago(7) }),
      makeIncident({ resolvedAt: ago(9) }),
    ]
    expect(resolvedInLastDays(list, NOW.getTime(), 7)).toBe(resolvedInLastDays(list, NOW, 7))
    expect(resolvedInLastDays(list, NOW.getTime(), 7)).toBe(2)
  })

  it('AC-01.9: empty input gives 0', () => {
    expect(resolvedInLastDays([], NOW, 7)).toBe(0)
  })
})
