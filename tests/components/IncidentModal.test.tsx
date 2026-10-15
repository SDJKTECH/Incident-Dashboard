import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IncidentModal } from '../../src/components/IncidentModal'
import type { IncidentSubmitResult, NewIncidentInput } from '../../src/types/inputs'
import { makeIncident } from '../helpers/factories'

const OK: IncidentSubmitResult = { ok: true }

function Harness(props: {
  onSubmit: (i: NewIncidentInput) => IncidentSubmitResult
  onClose?: () => void
  mode?: 'create' | 'edit'
}): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open trigger
      </button>
      {open && (
        <IncidentModal
          mode={props.mode ?? 'create'}
          onSubmit={props.onSubmit}
          onClose={() => {
            props.onClose?.()
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

function dialogEl(): HTMLElement {
  return screen.getByRole('dialog')
}

describe('AC-03 IncidentModal validation and submit', () => {
  it('AC-03: empty title shows an inline role=alert error, does not close', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(i: NewIncidentInput) => IncidentSubmitResult>(() => ({
      ok: false,
      error: 'Title is required',
    }))
    const onClose = vi.fn()
    render(<IncidentModal mode="create" onSubmit={onSubmit} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Create incident' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('alert')).toHaveTextContent('Title is required')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('AC-03: submits trimmed assignee, parsed tags and chosen fields, then closes', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(i: NewIncidentInput) => IncidentSubmitResult>(() => OK)
    const onClose = vi.fn()
    render(<IncidentModal mode="create" onSubmit={onSubmit} onClose={onClose} />)
    const dialog = dialogEl()
    await user.type(within(dialog).getByLabelText('Title'), 'DB down')
    await user.type(within(dialog).getByLabelText('Description'), 'primary is unreachable')
    await user.selectOptions(within(dialog).getByLabelText('Severity'), 'critical')
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'investigating')
    await user.type(within(dialog).getByLabelText('Assignee'), '  ann  ')
    await user.type(within(dialog).getByLabelText(/Tags/), ' db , p1,, db ,  ')
    await user.click(within(dialog).getByRole('button', { name: 'Create incident' }))
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'DB down',
      description: 'primary is unreachable',
      severity: 'critical',
      status: 'investigating',
      assignee: 'ann',
      tags: ['db', 'p1'],
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('AC-03: whitespace-only title is passed to onSubmit (validation owned by store)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(i: NewIncidentInput) => IncidentSubmitResult>(() => ({
      ok: false,
      error: 'Title is required',
    }))
    render(<IncidentModal mode="create" onSubmit={onSubmit} onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Title'), '   ')
    await user.click(screen.getByRole('button', { name: 'Create incident' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('AC-03: edit mode is prefilled from the incident and labelled Save changes', () => {
    const inc = makeIncident({
      title: 'Existing',
      description: 'desc',
      severity: 'high',
      status: 'resolved',
      assignee: 'bob',
      tags: ['x', 'y'],
    })
    render(<IncidentModal mode="edit" incident={inc} onSubmit={() => OK} onClose={vi.fn()} />)
    const dialog = dialogEl()
    expect(within(dialog).getByRole('heading', { name: 'Edit incident' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Existing')
    expect(within(dialog).getByLabelText('Description')).toHaveValue('desc')
    expect(within(dialog).getByLabelText('Severity')).toHaveValue('high')
    expect(within(dialog).getByLabelText('Status')).toHaveValue('resolved')
    expect(within(dialog).getByLabelText('Assignee')).toHaveValue('bob')
    expect(within(dialog).getByLabelText(/Tags/)).toHaveValue('x, y')
    expect(within(dialog).getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })
})

describe('AC-05 IncidentModal accessibility', () => {
  it('AC-05: every form field has an accessible label', () => {
    render(<IncidentModal mode="create" onSubmit={() => OK} onClose={vi.fn()} />)
    const dialog = dialogEl()
    for (const name of ['Title', 'Description', 'Severity', 'Status', 'Assignee', /Tags/]) {
      expect(within(dialog).getByLabelText(name)).toBeInTheDocument()
    }
    expect(within(dialog).getAllByRole('textbox').length).toBeGreaterThanOrEqual(4)
  })

  it('AC-05: has role=dialog, aria-modal and is labelled by its title', () => {
    render(<IncidentModal mode="create" onSubmit={() => OK} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'New incident' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(document.getElementById(labelId as string)).toHaveTextContent('New incident')
  })

  it('AC-05: focus moves into the dialog on open', async () => {
    const user = userEvent.setup()
    render(<Harness onSubmit={() => OK} />)
    await user.click(screen.getByRole('button', { name: 'Open trigger' }))
    expect(dialogEl().contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(screen.getByLabelText('Title'))
  })

  it('AC-05: Tab wraps from last to first focusable element', async () => {
    const user = userEvent.setup()
    render(<IncidentModal mode="create" onSubmit={() => OK} onClose={vi.fn()} />)
    const dialog = dialogEl()
    const submit = within(dialog).getByRole('button', { name: 'Create incident' })
    submit.focus()
    await user.tab()
    expect(document.activeElement).toBe(within(dialog).getByLabelText('Title'))
  })

  it('AC-05: Shift+Tab wraps from first to last focusable element', async () => {
    const user = userEvent.setup()
    render(<IncidentModal mode="create" onSubmit={() => OK} onClose={vi.fn()} />)
    const dialog = dialogEl()
    within(dialog).getByLabelText('Title').focus()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: 'Create incident' }),
    )
  })

  it('AC-05: focus never escapes the dialog over many Tab presses', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <button type="button">Outside</button>
        <IncidentModal mode="create" onSubmit={() => OK} onClose={vi.fn()} />
      </div>,
    )
    const dialog = dialogEl()
    for (let i = 0; i < 12; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('AC-05: Escape closes the modal', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<IncidentModal mode="create" onSubmit={() => OK} onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('AC-05: focus returns to the trigger after closing with Escape', async () => {
    const user = userEvent.setup()
    render(<Harness onSubmit={() => OK} />)
    const trigger = screen.getByRole('button', { name: 'Open trigger' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('AC-05: focus returns to the trigger after Cancel', async () => {
    const user = userEvent.setup()
    render(<Harness onSubmit={() => OK} />)
    const trigger = screen.getByRole('button', { name: 'Open trigger' })
    await user.click(trigger)
    await user.click(within(dialogEl()).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
