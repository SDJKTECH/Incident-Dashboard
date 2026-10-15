import { describe, expect, it } from 'vitest'
import { formatDuration, newId } from '../../src/lib/format'

describe('AC-03 newId', () => {
  it('AC-03: returns non-empty strings', () => {
    const id = newId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('AC-03: returns unique ids across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()))
    expect(ids.size).toBe(1000)
  })
})

describe('AC-01 formatDuration', () => {
  const H = 3600_000

  it('AC-01: null gives N/A', () => {
    expect(formatDuration(null)).toBe('N/A')
  })

  it('AC-01: NaN and Infinity give N/A', () => {
    expect(formatDuration(Number.NaN)).toBe('N/A')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('N/A')
  })

  it('AC-01: formats hours below 48h', () => {
    expect(formatDuration(5.5 * H)).toBe('5.5 h')
    expect(formatDuration(0)).toBe('0.0 h')
    expect(formatDuration(47 * H)).toBe('47.0 h')
  })

  it('AC-01: formats days from 48h', () => {
    expect(formatDuration(48 * H)).toBe('2.0 d')
    expect(formatDuration(60 * H)).toBe('2.5 d')
  })
})
