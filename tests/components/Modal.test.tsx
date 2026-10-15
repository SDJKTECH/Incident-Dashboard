import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from '../../src/components/Modal'

describe('AC-05 Modal', () => {
  it('AC-05: clicking the backdrop closes, clicking inside does not', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal title="T" onClose={onClose}>
        <button type="button">Inside</button>
      </Modal>,
    )
    await user.click(screen.getByRole('button', { name: 'Inside' }))
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('AC-05: with no focusable children the dialog itself takes focus and Tab stays put', async () => {
    const user = userEvent.setup()
    render(
      <Modal title="Empty" onClose={vi.fn()}>
        <p>Just text</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Empty' })
    expect(dialog).toHaveFocus()
    await user.tab()
    expect(dialog).toHaveFocus()
  })
})
