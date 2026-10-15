import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StorageNotice } from '../../src/components/StorageNotice'

describe('AC-04 StorageNotice', () => {
  it('AC-04: shows a non-blocking status notice for corrupt data', () => {
    render(<StorageNotice loadStatus="corrupt" persistOk />)
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent(/invalid/i)
    expect(notice).not.toHaveTextContent(/unavailable/i)
  })

  it('AC-04: shows an unavailable warning when storage is unavailable', () => {
    render(<StorageNotice loadStatus="unavailable" persistOk={false} />)
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent(/unavailable/i)
    expect(screen.getAllByText(/Storage is unavailable/)).toHaveLength(1)
  })

  it('AC-04: shows the warning when a write failed (persistOk=false)', () => {
    render(<StorageNotice loadStatus="ok" persistOk={false} />)
    expect(screen.getByRole('status')).toHaveTextContent(/unavailable/i)
  })

  it('AC-04: shows both messages for corrupt + write failure', () => {
    render(<StorageNotice loadStatus="corrupt" persistOk={false} />)
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent(/invalid/i)
    expect(notice).toHaveTextContent(/unavailable/i)
  })

  it('AC-04: renders nothing for ok', () => {
    const { container } = render(<StorageNotice loadStatus="ok" persistOk />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('AC-04: renders nothing for empty', () => {
    const { container } = render(<StorageNotice loadStatus="empty" persistOk />)
    expect(container).toBeEmptyDOMElement()
  })

  it('AC-04: renders nothing while loading, even if persistOk is false or migrated is set', () => {
    const { container, rerender } = render(<StorageNotice loadStatus="loading" persistOk />)
    expect(container).toBeEmptyDOMElement()
    rerender(<StorageNotice loadStatus="loading" persistOk={false} migrated />)
    expect(container).toBeEmptyDOMElement()
  })

  it('AC-04: shows a polite status notice after legacy data was migrated, mentioning the backup', () => {
    render(<StorageNotice loadStatus="ok" persistOk migrated />)
    const notice = screen.getByRole('status')
    expect(notice).toHaveAttribute('aria-live', 'polite')
    expect(notice).toHaveTextContent(/imported/i)
    expect(notice).toHaveTextContent(/backup/i)
    expect(notice).not.toHaveTextContent(/warning/i)
  })

  it('AC-04: the migrated notice is replaced by warnings when storage is unavailable', () => {
    render(<StorageNotice loadStatus="unavailable" persistOk={false} migrated />)
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent(/unavailable/i)
    expect(notice).not.toHaveTextContent(/imported/i)
  })

  it('AC-04: the warning is announced as a polite live region', () => {
    render(<StorageNotice loadStatus="corrupt" persistOk />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })
})
