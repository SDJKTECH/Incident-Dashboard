import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useFilters } from '../../src/hooks/useFilters'
import { DEFAULT_FILTERS } from '../../src/lib/filtering'

describe('AC-02 useFilters', () => {
  it('AC-02: starts with default filters', () => {
    const { result } = renderHook(() => useFilters())
    expect(result.current.filters).toEqual(DEFAULT_FILTERS)
  })

  it('AC-02: setFilter updates a single key and keeps others', () => {
    const { result } = renderHook(() => useFilters())
    act(() => result.current.setFilter('status', 'open'))
    act(() => result.current.setFilter('severity', 'high'))
    expect(result.current.filters).toEqual({ ...DEFAULT_FILTERS, status: 'open', severity: 'high' })
  })

  it('AC-02: setFilter to undefined unsets a filter', () => {
    const { result } = renderHook(() => useFilters())
    act(() => result.current.setFilter('tag', 'db'))
    act(() => result.current.setFilter('tag', undefined))
    expect(result.current.filters.tag).toBeUndefined()
  })

  it('AC-02: clearFilters resets filters, search and sort to defaults', () => {
    const { result } = renderHook(() => useFilters())
    act(() => {
      result.current.setFilter('status', 'closed')
      result.current.setFilter('assignee', 'ann')
      result.current.setFilter('dateFrom', '2025-01-01')
      result.current.setFilter('query', 'abc')
      result.current.setFilter('sortKey', 'severity')
      result.current.setFilter('sortDir', 'asc')
    })
    expect(result.current.filters.query).toBe('abc')
    act(() => result.current.clearFilters())
    expect(result.current.filters).toEqual(DEFAULT_FILTERS)
  })
})
