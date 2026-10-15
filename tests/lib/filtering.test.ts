import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  applyView,
  filterIncidents,
  searchIncidents,
  sortIncidents,
  uniqueAssignees,
  uniqueTags,
} from '../../src/lib/filtering'
import type { FilterState } from '../../src/types/filters'
import { makeIncident } from '../helpers/factories'

const f = (over: Partial<FilterState> = {}): FilterState => ({ ...DEFAULT_FILTERS, ...over })
// Local-time timestamps keep day comparisons timezone-safe.
const local = (y: number, m: number, d: number, h = 12): string =>
  new Date(y, m - 1, d, h, 0, 0).toISOString()

describe('AC-02 filterIncidents', () => {
  const a = makeIncident({ status: 'open', severity: 'high', assignee: 'ann', tags: ['db', 'p1'] })
  const b = makeIncident({ status: 'resolved', severity: 'high', assignee: 'bob', tags: ['db'] })
  const c = makeIncident({ status: 'open', severity: 'low', assignee: 'ann', tags: ['ui'] })
  const all = [a, b, c]

  it('AC-02: filters by status alone', () => {
    expect(filterIncidents(all, f({ status: 'open' }))).toEqual([a, c])
  })
  it('AC-02: filters by severity alone', () => {
    expect(filterIncidents(all, f({ severity: 'high' }))).toEqual([a, b])
  })
  it('AC-02: filters by assignee alone', () => {
    expect(filterIncidents(all, f({ assignee: 'bob' }))).toEqual([b])
  })
  it('AC-02: filters by tag alone', () => {
    expect(filterIncidents(all, f({ tag: 'db' }))).toEqual([a, b])
    expect(filterIncidents(all, f({ tag: 'ui' }))).toEqual([c])
  })
  it('AC-02: multiple filters combine with AND', () => {
    expect(filterIncidents(all, f({ status: 'open', severity: 'high', tag: 'db' }))).toEqual([a])
    expect(filterIncidents(all, f({ status: 'resolved', assignee: 'ann' }))).toEqual([])
  })
  it('AC-02: no filters returns everything', () => {
    expect(filterIncidents(all, f())).toEqual(all)
  })

  describe('date range', () => {
    const d1 = makeIncident({ createdAt: local(2025, 3, 10, 12) })
    const d2 = makeIncident({ createdAt: local(2025, 3, 15, 12) })
    const d3 = makeIncident({ createdAt: local(2025, 3, 20, 12) })
    const d4 = makeIncident({ createdAt: local(2025, 3, 21, 12) })
    const dates = [d1, d2, d3, d4]

    it('AC-02: includes incidents on both boundary days', () => {
      const res = filterIncidents(dates, f({ dateFrom: '2025-03-15', dateTo: '2025-03-20' }))
      expect(res).toEqual([d2, d3])
    })
    it('AC-02: boundary day is inclusive regardless of time of day', () => {
      const late = makeIncident({ createdAt: local(2025, 3, 20, 23) })
      const early = makeIncident({ createdAt: local(2025, 3, 15, 1) })
      expect(
        filterIncidents([late, early], f({ dateFrom: '2025-03-15', dateTo: '2025-03-20' })),
      ).toEqual([late, early])
    })
    it('AC-02: supports open-ended ranges', () => {
      expect(filterIncidents(dates, f({ dateFrom: '2025-03-20' }))).toEqual([d3, d4])
      expect(filterIncidents(dates, f({ dateTo: '2025-03-10' }))).toEqual([d1])
    })
    it('AC-02: excludes incidents with an invalid createdAt when a range is set', () => {
      const bad = makeIncident({ createdAt: 'nope' })
      expect(filterIncidents([bad], f({ dateFrom: '2025-01-01' }))).toEqual([])
    })
  })
})

describe('AC-02 searchIncidents', () => {
  const t = makeIncident({ title: 'Database Outage', description: 'primary down' })
  const d = makeIncident({ title: 'Login slow', description: 'Caused by DATABASE load' })
  const o = makeIncident({ title: 'Typo', description: 'footer' })

  it('AC-02: matches case-insensitive substrings in title', () => {
    expect(searchIncidents([t, o], 'outAGE')).toEqual([t])
    expect(searchIncidents([t, o], 'base out')).toEqual([t])
  })
  it('AC-02: matches case-insensitive substrings in description', () => {
    expect(searchIncidents([t, d, o], 'database')).toEqual([t, d])
    expect(searchIncidents([o], 'OOT')).toEqual([o])
  })
  it('AC-02: empty or blank query returns all', () => {
    expect(searchIncidents([t, d, o], '')).toEqual([t, d, o])
    expect(searchIncidents([t, d, o], '   ')).toEqual([t, d, o])
  })
  it('AC-02: no match returns empty list', () => {
    expect(searchIncidents([t, d, o], 'zzz')).toEqual([])
  })
})

describe('AC-02 sortIncidents', () => {
  const low = makeIncident({ severity: 'low', createdAt: '2025-01-03T12:00:00.000Z' })
  const med = makeIncident({ severity: 'medium', createdAt: '2025-01-01T12:00:00.000Z' })
  const high = makeIncident({ severity: 'high', createdAt: '2025-01-04T12:00:00.000Z' })
  const crit = makeIncident({ severity: 'critical', createdAt: '2025-01-02T12:00:00.000Z' })
  const all = [low, med, high, crit]

  it('AC-02: severity desc orders critical > high > medium > low', () => {
    expect(sortIncidents(all, 'severity', 'desc')).toEqual([crit, high, med, low])
  })
  it('AC-02: severity asc is the reverse', () => {
    expect(sortIncidents(all, 'severity', 'asc')).toEqual([low, med, high, crit])
  })
  it('AC-02: date desc is newest first', () => {
    expect(sortIncidents(all, 'date', 'desc')).toEqual([high, low, crit, med])
  })
  it('AC-02: date asc is oldest first', () => {
    expect(sortIncidents(all, 'date', 'asc')).toEqual([med, crit, low, high])
  })
  it('AC-02: does not mutate its input', () => {
    const copy = [...all]
    sortIncidents(all, 'severity', 'desc')
    expect(all).toEqual(copy)
  })
  it('AC-02: is stable for equal keys', () => {
    const x = makeIncident({ severity: 'high' })
    const y = makeIncident({ severity: 'high' })
    expect(sortIncidents([x, y], 'severity', 'desc')).toEqual([x, y])
    expect(sortIncidents([x, y], 'severity', 'asc')).toEqual([x, y])
  })
})

describe('AC-02 applyView and defaults', () => {
  it('AC-02: DEFAULT_FILTERS are empty query, date, desc', () => {
    expect(DEFAULT_FILTERS).toEqual({ query: '', sortKey: 'date', sortDir: 'desc' })
  })
  it('AC-02: applyView combines filter, search and sort', () => {
    const a = makeIncident({ title: 'db a', severity: 'low', status: 'open' })
    const b = makeIncident({ title: 'db b', severity: 'high', status: 'open' })
    const c = makeIncident({ title: 'db c', severity: 'high', status: 'closed' })
    const d = makeIncident({ title: 'other', severity: 'critical', status: 'open' })
    const res = applyView(
      [a, b, c, d],
      f({ status: 'open', query: 'DB', sortKey: 'severity', sortDir: 'desc' }),
    )
    expect(res).toEqual([b, a])
  })
  it('AC-02: applyView with no matches returns an empty array', () => {
    expect(applyView([makeIncident()], f({ query: 'nothing-here' }))).toEqual([])
  })
  it('AC-02: applyView does not mutate input', () => {
    const input = [makeIncident({ severity: 'low' }), makeIncident({ severity: 'high' })]
    const copy = [...input]
    applyView(input, f({ sortKey: 'severity' }))
    expect(input).toEqual(copy)
  })
})

describe('AC-02 uniqueAssignees / uniqueTags', () => {
  const incs = [
    makeIncident({ assignee: 'bob', tags: ['z', 'a'] }),
    makeIncident({ assignee: 'ann', tags: ['a', ' m '] }),
    makeIncident({ assignee: '  ', tags: ['', 'a'] }),
    makeIncident({ assignee: 'bob' }),
  ]
  it('AC-02: uniqueAssignees is sorted, distinct and non-blank', () => {
    expect(uniqueAssignees(incs)).toEqual(['ann', 'bob'])
  })
  it('AC-02: uniqueTags is sorted, distinct and non-blank', () => {
    expect(uniqueTags(incs)).toEqual(['a', 'm', 'z'])
  })
  it('AC-02: empty input gives empty lists', () => {
    expect(uniqueAssignees([])).toEqual([])
    expect(uniqueTags([])).toEqual([])
  })
})
