import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MetricsGrid } from '../../src/components/MetricsGrid'
import { makeIncident, makeTask } from '../helpers/factories'

const HOUR = 3600_000
const DAY = 24 * HOUR
const NOW = Date.parse('2025-06-15T12:00:00.000Z')
const ago = (ms: number): string => new Date(NOW - ms).toISOString()

function metric(label: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: label })
  const card = heading.parentElement
  if (!card) throw new Error('no card')
  return card
}

describe('AC-01 MetricsGrid', () => {
  it('AC-01: renders a region labelled Metrics', () => {
    render(<MetricsGrid incidents={[]} tasks={[]} now={NOW} />)
    expect(screen.getByRole('region', { name: 'Metrics' })).toBeInTheDocument()
  })

  it('AC-01: per-severity counts include open/investigating and ignore resolved/closed', () => {
    const incidents = [
      makeIncident({ severity: 'critical', status: 'open' }),
      makeIncident({ severity: 'critical', status: 'investigating' }),
      makeIncident({ severity: 'critical', status: 'resolved' }),
      makeIncident({ severity: 'high', status: 'closed' }),
      makeIncident({ severity: 'medium', status: 'open' }),
    ]
    render(<MetricsGrid incidents={incidents} tasks={[]} now={NOW} />)
    expect(screen.getByTestId('open-critical')).toHaveTextContent('2')
    expect(screen.getByTestId('open-high')).toHaveTextContent('0')
    expect(screen.getByTestId('open-medium')).toHaveTextContent('1')
    expect(screen.getByTestId('open-low')).toHaveTextContent('0')
  })

  it('AC-01: MTTR shows N/A (never NaN or 0) when nothing is resolved', () => {
    render(<MetricsGrid incidents={[makeIncident()]} tasks={[]} now={NOW} />)
    const card = metric('MTTR')
    expect(card).toHaveTextContent('N/A')
    expect(card).not.toHaveTextContent('NaN')
    expect(card).not.toHaveTextContent(/\b0(\.0)?\s*[hd]\b/)
    expect(document.body).not.toHaveTextContent('NaN')
  })

  it('AC-01: MTTR shows the formatted mean for resolved incidents', () => {
    const incidents = [
      makeIncident({ createdAt: ago(10 * HOUR), resolvedAt: ago(8 * HOUR), status: 'resolved' }),
      makeIncident({ createdAt: ago(10 * HOUR), resolvedAt: ago(4 * HOUR), status: 'resolved' }),
    ]
    render(<MetricsGrid incidents={incidents} tasks={[]} now={NOW} />)
    expect(metric('MTTR')).toHaveTextContent('4.0 h')
  })

  it('AC-01: MTTR switches to days for means of 48h or more', () => {
    const incidents = [
      makeIncident({ createdAt: ago(5 * DAY), resolvedAt: ago(2 * DAY), status: 'resolved' }),
    ]
    render(<MetricsGrid incidents={incidents} tasks={[]} now={NOW} />)
    expect(metric('MTTR')).toHaveTextContent('3.0 d')
  })

  it('AC-01: shows completed vs pending task counts', () => {
    const tasks = [
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
      makeTask({ status: 'todo' }),
      makeTask({ status: 'in_progress' }),
    ]
    render(<MetricsGrid incidents={[]} tasks={tasks} now={NOW} />)
    const card = metric('Tasks completed vs pending')
    expect(card).toHaveTextContent('3 / 2')
    expect(within(card).getByText('3 completed, 2 pending')).toBeInTheDocument()
  })

  it('AC-01: last-7-days counts a 6-day-old incident but not an 8-day-old one', () => {
    const incidents = [
      makeIncident({ createdAt: ago(6 * DAY) }),
      makeIncident({ createdAt: ago(8 * DAY) }),
    ]
    render(<MetricsGrid incidents={incidents} tasks={[]} now={NOW} />)
    const card = metric('Created in last 7 days')
    expect(within(card).getByText('1')).toBeInTheDocument()
  })

  it('AC-01: last-7-days is 0 with an 8-day-old incident only', () => {
    render(
      <MetricsGrid incidents={[makeIncident({ createdAt: ago(8 * DAY) })]} tasks={[]} now={NOW} />,
    )
    expect(within(metric('Created in last 7 days')).getByText('0')).toBeInTheDocument()
  })

  it('AC-01: empty state shows zeros everywhere and N/A MTTR', () => {
    render(<MetricsGrid incidents={[]} tasks={[]} now={NOW} />)
    expect(screen.getByTestId('open-critical')).toHaveTextContent('0')
    expect(metric('MTTR')).toHaveTextContent('N/A')
    expect(metric('Tasks completed vs pending')).toHaveTextContent('0 / 0')
  })

  it('AC-01: rerender with new props updates the values immediately', () => {
    const { rerender } = render(<MetricsGrid incidents={[]} tasks={[]} now={NOW} />)
    expect(screen.getByTestId('open-high')).toHaveTextContent('0')
    rerender(
      <MetricsGrid
        incidents={[makeIncident({ severity: 'high', status: 'open' })]}
        tasks={[makeTask({ status: 'done' })]}
        now={NOW}
      />,
    )
    expect(screen.getByTestId('open-high')).toHaveTextContent('1')
    expect(metric('Tasks completed vs pending')).toHaveTextContent('1 / 0')
  })
})

describe('AC-01.6 / AC-01.8 / AC-01.9 / AC-01.10 new metric cards', () => {
  it('AC-01.6: Unassigned open incidents counts only open/investigating with blank assignee', () => {
    const incidents = [
      makeIncident({ status: 'open', assignee: '' }),
      makeIncident({ status: 'investigating', assignee: '   ' }),
      makeIncident({ status: 'open', assignee: 'alice' }),
      makeIncident({ status: 'resolved', assignee: '' }),
      makeIncident({ status: 'closed', assignee: '' }),
    ]
    render(<MetricsGrid incidents={incidents} tasks={[]} now={NOW} />)
    expect(within(metric('Unassigned open incidents')).getByText('2')).toBeInTheDocument()
  })

  it('AC-01.6: Unassigned open incidents is 0 when empty', () => {
    render(<MetricsGrid incidents={[]} tasks={[]} now={NOW} />)
    expect(within(metric('Unassigned open incidents')).getByText('0')).toBeInTheDocument()
  })

  it('AC-01.8: Resolved in last 7 days shows 1 for a 6-day and an 8-day resolved pair', () => {
    const incidents = [
      makeIncident({ status: 'resolved', createdAt: ago(20 * DAY), resolvedAt: ago(6 * DAY) }),
      makeIncident({ status: 'resolved', createdAt: ago(20 * DAY), resolvedAt: ago(8 * DAY) }),
    ]
    render(<MetricsGrid incidents={incidents} tasks={[]} now={NOW} />)
    expect(within(metric('Resolved in last 7 days')).getByText('1')).toBeInTheDocument()
  })

  it('AC-01.8: Resolved in last 7 days is 0 when nothing is resolved', () => {
    render(<MetricsGrid incidents={[makeIncident()]} tasks={[]} now={NOW} />)
    expect(within(metric('Resolved in last 7 days')).getByText('0')).toBeInTheDocument()
  })

  it('AC-01.9: Average age of open incidents shows N/A (never NaN) with no open incidents', () => {
    const incidents = [
      makeIncident({ status: 'resolved', createdAt: ago(2 * DAY), resolvedAt: ago(1 * DAY) }),
      makeIncident({ status: 'closed', createdAt: ago(3 * DAY) }),
    ]
    render(<MetricsGrid incidents={incidents} tasks={[]} now={NOW} />)
    const card = metric('Average age of open incidents')
    expect(card).toHaveTextContent('N/A')
    expect(card).not.toHaveTextContent('NaN')
  })

  it('AC-01.9: Average age of open incidents shows N/A for empty data', () => {
    render(<MetricsGrid incidents={[]} tasks={[]} now={NOW} />)
    const card = metric('Average age of open incidents')
    expect(card).toHaveTextContent('N/A')
    expect(card).not.toHaveTextContent('NaN')
  })

  it('AC-01.9: Average age of open incidents is formatted in hours', () => {
    const incidents = [
      makeIncident({ status: 'open', createdAt: ago(10 * HOUR) }),
      makeIncident({ status: 'investigating', createdAt: ago(14 * HOUR) }),
      makeIncident({ status: 'resolved', createdAt: ago(40 * DAY), resolvedAt: ago(39 * DAY) }),
    ]
    render(<MetricsGrid incidents={incidents} tasks={[]} now={NOW} />)
    const card = metric('Average age of open incidents')
    expect(card).toHaveTextContent('12.0 h')
    expect(card).not.toHaveTextContent('NaN')
  })

  it('AC-01.9: Average age of open incidents switches to days at 48h or more', () => {
    render(
      <MetricsGrid
        incidents={[makeIncident({ status: 'open', createdAt: ago(3 * DAY) })]}
        tasks={[]}
        now={NOW}
      />,
    )
    expect(metric('Average age of open incidents')).toHaveTextContent('3.0 d')
  })

  it('AC-01.10: rerendering with new data updates all three new cards', () => {
    const { rerender } = render(<MetricsGrid incidents={[]} tasks={[]} now={NOW} />)
    expect(within(metric('Unassigned open incidents')).getByText('0')).toBeInTheDocument()
    expect(within(metric('Resolved in last 7 days')).getByText('0')).toBeInTheDocument()
    expect(metric('Average age of open incidents')).toHaveTextContent('N/A')

    rerender(
      <MetricsGrid
        incidents={[
          makeIncident({ status: 'open', assignee: '', createdAt: ago(6 * HOUR) }),
          makeIncident({ status: 'resolved', createdAt: ago(5 * DAY), resolvedAt: ago(1 * DAY) }),
        ]}
        tasks={[]}
        now={NOW}
      />,
    )
    expect(within(metric('Unassigned open incidents')).getByText('1')).toBeInTheDocument()
    expect(within(metric('Resolved in last 7 days')).getByText('1')).toBeInTheDocument()
    const age = metric('Average age of open incidents')
    expect(age).toHaveTextContent('6.0 h')
    expect(age).not.toHaveTextContent('N/A')
    expect(document.body).not.toHaveTextContent('NaN')
  })
})

describe('AC-05 MetricsGrid responsive layout', () => {
  it('AC-05: the grid stacks on mobile and reflows with sm:/lg: variants', () => {
    render(<MetricsGrid incidents={[]} tasks={[]} now={NOW} />)
    const grid = screen.getByRole('region', { name: 'Metrics' })
    expect(grid).toHaveClass('grid', 'grid-cols-1')
    const classes = grid.className.split(/\s+/)
    expect(classes.some((c) => c.startsWith('sm:grid-cols-'))).toBe(true)
    expect(classes.some((c) => c.startsWith('lg:grid-cols-'))).toBe(true)
  })
})
