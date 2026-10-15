import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IncidentList } from '../../src/components/IncidentList'
import { makeIncident } from '../helpers/factories'

describe('AC-02 IncidentList', () => {
  it('AC-02: shows an empty-state message when there are no incidents', () => {
    render(<IncidentList incidents={[]} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('No incidents match your filters.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('AC-02: renders one card per incident', () => {
    const incs = [makeIncident({ title: 'One' }), makeIncident({ title: 'Two' })]
    render(<IncidentList incidents={incs} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'One' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Two' })).toBeInTheDocument()
    expect(screen.queryByText(/No incidents match/)).not.toBeInTheDocument()
  })

  it('AC-05: severity and status are conveyed as text, not colour alone', () => {
    const inc = makeIncident({ title: 'Sev', severity: 'critical', status: 'investigating' })
    render(<IncidentList incidents={[inc]} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const card = screen.getByRole('article')
    expect(within(card).getByText('critical')).toBeInTheDocument()
    expect(within(card).getByText('investigating')).toBeInTheDocument()
  })

  it('AC-05: icon-less edit/delete buttons carry descriptive aria-labels', () => {
    const inc = makeIncident({ title: 'Disk full' })
    render(<IncidentList incidents={[inc]} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Edit incident "Disk full"' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete incident "Disk full"' })).toBeInTheDocument()
  })

  it('AC-03: edit and delete buttons call back with the incident', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const a = makeIncident({ title: 'A' })
    const b = makeIncident({ title: 'B' })
    render(<IncidentList incidents={[a, b]} onEdit={onEdit} onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: 'Edit incident "B"' }))
    expect(onEdit).toHaveBeenCalledWith(b)
    await user.click(screen.getByRole('button', { name: 'Delete incident "A"' }))
    expect(onDelete).toHaveBeenCalledWith(a)
  })

  it('AC-03: shows assignee (or Unassigned) and tags', () => {
    const a = makeIncident({ title: 'A', assignee: 'ann', tags: ['db'] })
    const b = makeIncident({ title: 'B', assignee: '' })
    render(<IncidentList incidents={[a, b]} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('ann')).toBeInTheDocument()
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
    expect(screen.getByText('db')).toBeInTheDocument()
  })
})
