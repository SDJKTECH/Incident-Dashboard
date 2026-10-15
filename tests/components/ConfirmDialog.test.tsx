import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../../src/components/ConfirmDialog'

function setup(): { onConfirm: () => void; onCancel: () => void } {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      title="Delete incident"
      message="Really delete?"
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return { onConfirm, onCancel }
}

describe('AC-03 ConfirmDialog', () => {
  it('AC-03: shows title and message in a labelled dialog', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Delete incident' })).toBeInTheDocument()
    expect(screen.getByText('Really delete?')).toBeInTheDocument()
  })

  it('AC-03: Cancel is focused first (safe default)', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('AC-03: Cancel calls onCancel and not onConfirm', async () => {
    const { onConfirm, onCancel } = setup()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('AC-03: confirm button calls onConfirm', async () => {
    const { onConfirm, onCancel } = setup()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('AC-05: Escape cancels without confirming', async () => {
    const { onConfirm, onCancel } = setup()
    await userEvent.setup().keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('AC-03: pressing Enter on the initially focused Cancel does not confirm', async () => {
    const { onConfirm, onCancel } = setup()
    await userEvent.setup().keyboard('{Enter}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
