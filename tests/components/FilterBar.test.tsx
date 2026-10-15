import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FilterBar } from '../../src/components/FilterBar'
import { DEFAULT_FILTERS } from '../../src/lib/filtering'
import type { FilterState } from '../../src/types/filters'
import { makeIncident } from '../helpers/factories'

const incidents = [
  makeIncident({ assignee: 'ann', tags: ['db'] }),
  makeIncident({ assignee: 'bob', tags: ['ui', 'db'] }),
]

function setup(filters: FilterState = DEFAULT_FILTERS): {
  onChange: ReturnType<typeof vi.fn>
  onClear: ReturnType<typeof vi.fn>
} {
  const onChange = vi.fn()
  const onClear = vi.fn()
  render(<FilterBar filters={filters} incidents={incidents} onChange={onChange} onClear={onClear} />)
  return { onChange, onClear }
}

describe('AC-02 FilterBar', () => {
  it('AC-05: every control has an associated label', () => {
    setup()
    for (const name of [
      'Search',
      'Status',
      'Severity',
      'Assignee',
      'Tag',
      'Created from',
      'Created to',
      'Sort by',
      'Direction',
    ]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }
    expect(screen.getByRole('region', { name: 'Filters' })).toBeInTheDocument()
  })

  it('AC-02: choosing a status calls onChange("status", value)', async () => {
    const { onChange } = setup()
    await userEvent.setup().selectOptions(screen.getByLabelText('Status'), 'investigating')
    expect(onChange).toHaveBeenCalledWith('status', 'investigating')
  })

  it('AC-02: choosing a severity calls onChange("severity", value)', async () => {
    const { onChange } = setup()
    await userEvent.setup().selectOptions(screen.getByLabelText('Severity'), 'critical')
    expect(onChange).toHaveBeenCalledWith('severity', 'critical')
  })

  it('AC-02: assignee and tag options are derived from incidents', async () => {
    const { onChange } = setup()
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Assignee'), 'bob')
    expect(onChange).toHaveBeenCalledWith('assignee', 'bob')
    await user.selectOptions(screen.getByLabelText('Tag'), 'ui')
    expect(onChange).toHaveBeenCalledWith('tag', 'ui')
    const tagSelect = screen.getByLabelText('Tag')
    expect(Array.from(tagSelect.querySelectorAll('option')).map((o) => o.textContent)).toEqual([
      'All',
      'db',
      'ui',
    ])
  })

  it('AC-02: selecting All passes undefined', async () => {
    const { onChange } = setup({ ...DEFAULT_FILTERS, status: 'open', severity: 'high', assignee: 'ann', tag: 'db' })
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Status'), 'All')
    expect(onChange).toHaveBeenLastCalledWith('status', undefined)
    await user.selectOptions(screen.getByLabelText('Severity'), 'All')
    expect(onChange).toHaveBeenLastCalledWith('severity', undefined)
    await user.selectOptions(screen.getByLabelText('Assignee'), 'All')
    expect(onChange).toHaveBeenLastCalledWith('assignee', undefined)
    await user.selectOptions(screen.getByLabelText('Tag'), 'All')
    expect(onChange).toHaveBeenLastCalledWith('tag', undefined)
  })

  it('AC-02: typing in search calls onChange("query", text)', async () => {
    const { onChange } = setup()
    await userEvent.setup().type(screen.getByLabelText('Search'), 'a')
    expect(onChange).toHaveBeenCalledWith('query', 'a')
  })

  it('AC-02: date inputs call onChange with dateFrom/dateTo', async () => {
    const { onChange } = setup()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Created from'), '2025-03-15')
    expect(onChange).toHaveBeenCalledWith('dateFrom', '2025-03-15')
    await user.type(screen.getByLabelText('Created to'), '2025-03-20')
    expect(onChange).toHaveBeenCalledWith('dateTo', '2025-03-20')
  })

  it('AC-02: sort controls call onChange with sortKey/sortDir', async () => {
    const { onChange } = setup()
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Sort by'), 'severity')
    expect(onChange).toHaveBeenCalledWith('sortKey', 'severity')
    await user.selectOptions(screen.getByLabelText('Direction'), 'asc')
    expect(onChange).toHaveBeenCalledWith('sortDir', 'asc')
  })

  it('AC-02: reflects the current filter state in the controls', () => {
    setup({ ...DEFAULT_FILTERS, status: 'closed', query: 'foo', sortKey: 'severity', sortDir: 'asc' })
    expect(screen.getByLabelText('Status')).toHaveValue('closed')
    expect(screen.getByLabelText('Search')).toHaveValue('foo')
    expect(screen.getByLabelText('Sort by')).toHaveValue('severity')
    expect(screen.getByLabelText('Direction')).toHaveValue('asc')
  })

  it('AC-02: Clear filters button calls onClear', async () => {
    const { onClear } = setup()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
