import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppData, LoadResult } from '../../src/types/store'
import type { Incident } from '../../src/types/incident'
import { makeIncident } from '../helpers/factories'
import { createFakeAdapter } from '../helpers/fakeAdapter'
import type { FakeAdapter, FakeAdapterOptions } from '../helpers/fakeAdapter'

const holder = vi.hoisted(() => ({ adapter: null as unknown as PersistenceAdapterLike }))
interface PersistenceAdapterLike {
  load: () => Promise<LoadResult>
  save: (d: AppData) => Promise<boolean>
}

vi.mock('../../src/lib/sqliteStorage', () => ({
  getSqliteAdapter: (): PersistenceAdapterLike => holder.adapter,
}))

import App from '../../src/App'

let adapter: FakeAdapter

function installAdapter(opts: FakeAdapterOptions = {}): FakeAdapter {
  adapter = createFakeAdapter(opts)
  holder.adapter = adapter
  return adapter
}

beforeEach(() => {
  installAdapter()
})

function seed(incidents: Incident[]): void {
  installAdapter({ initial: { data: { incidents, tasks: [] }, status: 'ok' } })
}

function stored(): AppData {
  return adapter.lastSaved()
}

/** Renders the app and waits for async hydration to finish. */
async function renderApp(): Promise<ReturnType<typeof render>> {
  const r = render(<App />)
  await waitFor(() => expect(screen.queryByText('Loading your data...')).not.toBeInTheDocument())
  return r
}

async function createIncident(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  severity = 'high',
): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'New incident' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Title'), title)
  await user.selectOptions(within(dialog).getByLabelText('Severity'), severity)
  await user.click(within(dialog).getByRole('button', { name: 'Create incident' }))
}

describe('AC-01 / AC-03 App empty state', () => {
  it('AC-03: renders the title, metrics and an empty-state message with no data', async () => {
    await renderApp()
    expect(screen.getByRole('heading', { name: 'Incident Dashboard', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Metrics' })).toBeInTheDocument()
    expect(screen.getByText('No incidents match your filters.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('AC-01: empty app shows MTTR N/A and zero counts', async () => {
    await renderApp()
    expect(screen.getByTestId('open-critical')).toHaveTextContent('0')
    const cardFor = (label: string): HTMLElement => {
      const card = screen.getByRole('heading', { name: label }).parentElement
      if (!card) throw new Error(`No card for ${label}`)
      return card
    }
    expect(within(cardFor('MTTR')).getByText('N/A')).toBeInTheDocument()
    expect(within(cardFor('Unassigned open incidents')).getByText('0')).toBeInTheDocument()
    expect(within(cardFor('Resolved in last 7 days')).getByText('0')).toBeInTheDocument()
    expect(within(cardFor('Average age of open incidents')).getByText('N/A')).toBeInTheDocument()
  })
})

describe('AC-03 App create', () => {
  it('AC-03: creating via the UI adds it to the list and updates metrics, closing the modal', async () => {
    const user = userEvent.setup()
    await renderApp()
    await createIncident(user, 'Payment API down', 'critical')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Incidents' })
    expect(within(list).getByRole('heading', { name: 'Payment API down' })).toBeInTheDocument()
    expect(screen.getByTestId('open-critical')).toHaveTextContent('1')
    expect(screen.getByTestId('open-high')).toHaveTextContent('0')
    expect(screen.queryByText('No incidents match your filters.')).not.toBeInTheDocument()
  })

  it('AC-03: an empty title shows an inline error and saves nothing', async () => {
    const user = userEvent.setup()
    await renderApp()
    await user.click(screen.getByRole('button', { name: 'New incident' }))
    await user.click(screen.getByRole('button', { name: 'Create incident' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Title is required')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('No incidents match your filters.')).toBeInTheDocument()
    expect(adapter.save).not.toHaveBeenCalled()
  })
})

describe('AC-03 App edit', () => {
  it('AC-03: editing updates the list and metrics', async () => {
    seed([makeIncident({ id: 'e1', title: 'Old title', severity: 'high', status: 'open' })])
    const user = userEvent.setup()
    await renderApp()
    expect(screen.getByTestId('open-high')).toHaveTextContent('1')
    await user.click(screen.getByRole('button', { name: 'Edit incident "Old title"' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit incident' })
    const title = within(dialog).getByLabelText('Title')
    expect(title).toHaveValue('Old title')
    await user.clear(title)
    await user.type(title, 'New title')
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'resolved')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'New title' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Old title' })).not.toBeInTheDocument()
    expect(screen.getByTestId('open-high')).toHaveTextContent('0')
    const saved = stored().incidents[0]
    expect(saved.title).toBe('New title')
    expect(saved.status).toBe('resolved')
    expect(saved.resolvedAt).toBeTruthy()
  })
})

describe('AC-03 App delete', () => {
  it('AC-03: delete requires confirmation; cancel keeps the incident', async () => {
    seed([makeIncident({ id: 'd1', title: 'Keep me' })])
    const user = userEvent.setup()
    await renderApp()
    await user.click(screen.getByRole('button', { name: 'Delete incident "Keep me"' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete incident' })
    expect(dialog).toHaveTextContent('Keep me')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Keep me' })).toBeInTheDocument()
    expect(adapter.save).not.toHaveBeenCalled()
  })

  it('AC-03: confirming removes the incident from list, metrics and storage', async () => {
    seed([makeIncident({ id: 'd2', title: 'Remove me', severity: 'low', status: 'open' })])
    const user = userEvent.setup()
    await renderApp()
    expect(screen.getByTestId('open-low')).toHaveTextContent('1')
    await user.click(screen.getByRole('button', { name: 'Delete incident "Remove me"' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }),
    )
    expect(screen.queryByRole('heading', { name: 'Remove me' })).not.toBeInTheDocument()
    expect(screen.getByText('No incidents match your filters.')).toBeInTheDocument()
    expect(screen.getByTestId('open-low')).toHaveTextContent('0')
    expect(stored().incidents).toHaveLength(0)
  })

  it('AC-05: Escape on the delete confirmation cancels it', async () => {
    seed([makeIncident({ title: 'Esc me' })])
    const user = userEvent.setup()
    await renderApp()
    await user.click(screen.getByRole('button', { name: 'Delete incident "Esc me"' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Esc me' })).toBeInTheDocument()
  })
})

describe('AC-02 App filters', () => {
  const incidents = [
    makeIncident({ id: 'f1', title: 'Alpha outage', severity: 'high', status: 'open', assignee: 'ann' }),
    makeIncident({ id: 'f2', title: 'Beta glitch', severity: 'low', status: 'closed', assignee: 'bob' }),
    makeIncident({ id: 'f3', title: 'Gamma slow', severity: 'critical', status: 'open', assignee: 'bob', description: 'Needs ALPHA fix' }),
  ]

  it('AC-02: a filter narrows the list; the empty state appears with no matches', async () => {
    seed(incidents)
    const user = userEvent.setup()
    await renderApp()
    const filters = screen.getByRole('region', { name: 'Filters' })
    expect(screen.getAllByRole('article')).toHaveLength(3)
    await user.selectOptions(within(filters).getByLabelText('Status'), 'closed')
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Beta glitch' })).toBeInTheDocument()
    await user.selectOptions(within(filters).getByLabelText('Severity'), 'critical')
    expect(screen.queryAllByRole('article')).toHaveLength(0)
    expect(screen.getByText('No incidents match your filters.')).toBeInTheDocument()
  })

  it('AC-02: search is case-insensitive over title and description', async () => {
    seed(incidents)
    const user = userEvent.setup()
    await renderApp()
    await user.type(screen.getByLabelText('Search'), 'alpha')
    const headings = screen.getAllByRole('heading', { level: 3, name: /outage|slow/ })
    expect(headings.map((h) => h.textContent).sort()).toEqual(['Alpha outage', 'Gamma slow'])
  })

  it('AC-02: sorting by severity descending puts critical first', async () => {
    seed(incidents)
    const user = userEvent.setup()
    await renderApp()
    await user.selectOptions(screen.getByLabelText('Sort by'), 'severity')
    const titles = screen
      .getAllByRole('article')
      .map((a) => within(a).getByRole('heading').textContent)
    expect(titles).toEqual(['Gamma slow', 'Alpha outage', 'Beta glitch'])
    await user.selectOptions(screen.getByLabelText('Direction'), 'asc')
    const asc = screen
      .getAllByRole('article')
      .map((a) => within(a).getByRole('heading').textContent)
    expect(asc).toEqual(['Beta glitch', 'Alpha outage', 'Gamma slow'])
  })

  it('AC-02: Clear filters resets filters, search and sort', async () => {
    seed(incidents)
    const user = userEvent.setup()
    await renderApp()
    await user.selectOptions(screen.getByLabelText('Assignee'), 'ann')
    await user.type(screen.getByLabelText('Search'), 'alpha')
    await user.selectOptions(screen.getByLabelText('Sort by'), 'severity')
    expect(screen.getAllByRole('article')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByLabelText('Assignee')).toHaveValue('')
    expect(screen.getByLabelText('Search')).toHaveValue('')
    expect(screen.getByLabelText('Sort by')).toHaveValue('date')
    expect(screen.getByLabelText('Direction')).toHaveValue('desc')
  })

  it('AC-02: filters do not change metrics (metrics cover all incidents)', async () => {
    seed(incidents)
    const user = userEvent.setup()
    await renderApp()
    await user.selectOptions(screen.getByLabelText('Status'), 'closed')
    expect(screen.getByTestId('open-high')).toHaveTextContent('1')
    expect(screen.getByTestId('open-critical')).toHaveTextContent('1')
  })
})

describe('AC-04 App persistence and corrupt storage', () => {
  it('AC-04: corrupt JSON shows a notice and the app still renders', async () => {
    installAdapter({ initial: { data: { incidents: [], tasks: [] }, status: 'corrupt' } })
    await renderApp()
    expect(screen.getByRole('status')).toHaveTextContent(/invalid/i)
    expect(screen.getByRole('heading', { name: 'Incident Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('No incidents match your filters.')).toBeInTheDocument()
  })

  it('AC-04: wrong-shape data shows a notice and the app still renders', async () => {
    installAdapter({ initial: { data: { incidents: [], tasks: [] }, status: 'corrupt' } })
    await renderApp()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New incident' })).toBeInTheDocument()
  })

  it('AC-04: corrupt data is not overwritten until the user makes a change', async () => {
    installAdapter({ initial: { data: { incidents: [], tasks: [] }, status: 'corrupt' } })
    const user = userEvent.setup()
    await renderApp()
    expect(adapter.save).not.toHaveBeenCalled()
    await createIncident(user, 'Fresh start')
    expect(stored().incidents).toHaveLength(1)
    expect(stored().incidents[0].title).toBe('Fresh start')
  })

  it('AC-04: no notice for a missing key', async () => {
    await renderApp()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('AC-04: data persists across unmount and remount', async () => {
    const user = userEvent.setup()
    const first = await renderApp()
    await createIncident(user, 'Survives reload', 'critical')
    expect(stored().incidents).toHaveLength(1)
    first.unmount()
    await renderApp()
    expect(screen.getByRole('heading', { name: 'Survives reload' })).toBeInTheDocument()
    expect(screen.getByTestId('open-critical')).toHaveTextContent('1')
  })

  it('AC-04: shows a warning and keeps working in memory when storage writes fail', async () => {
    installAdapter({ saveOk: false })
    const user = userEvent.setup()
    await renderApp()
    await createIncident(user, 'In memory only')
    expect(screen.getByRole('heading', { name: 'In memory only' })).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent(/unavailable/i)
  })

  it('AC-04: unavailable storage at load shows the warning and the app still works', async () => {
    installAdapter({ loadThrows: true })
    const user = userEvent.setup()
    await renderApp()
    expect(screen.getByRole('status')).toHaveTextContent(/unavailable/i)
    await createIncident(user, 'Still works')
    expect(screen.getByRole('heading', { name: 'Still works' })).toBeInTheDocument()
  })

  it('AC-04: shows the migrated notice when legacy data was imported', async () => {
    installAdapter({
      initial: { data: { incidents: [makeIncident({ title: 'Imported' })], tasks: [] }, status: 'ok', migrated: true },
    })
    await renderApp()
    expect(screen.getByRole('status')).toHaveTextContent(/imported/i)
    expect(screen.getByRole('heading', { name: 'Imported' })).toBeInTheDocument()
  })
})

describe('AC-04 App async loading state', () => {
  it('AC-04: shows a loading status live region until hydrated, then removes it', async () => {
    const a = installAdapter({
      deferLoad: true,
      initial: { data: { incidents: [makeIncident({ title: 'Late arrival' })], tasks: [] }, status: 'ok' },
    })
    render(<App />)
    const region = screen.getByRole('status')
    expect(region).toHaveTextContent('Loading your data...')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('heading', { name: 'Late arrival' })).not.toBeInTheDocument()
    // Non-blocking: the app chrome is already usable.
    expect(screen.getByRole('button', { name: 'New incident' })).toBeInTheDocument()
    a.release()
    expect(await screen.findByRole('heading', { name: 'Late arrival' })).toBeInTheDocument()
    expect(screen.queryByText('Loading your data...')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'false')
  })

  it('AC-04: no storage notice is rendered while loading', async () => {
    const a = installAdapter({
      deferLoad: true,
      initial: { data: { incidents: [], tasks: [] }, status: 'corrupt' },
    })
    render(<App />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument()
    a.release()
    expect(await screen.findByText(/invalid/i)).toBeInTheDocument()
  })
})

describe('AC-05 App keyboard and focus', () => {
  it('AC-05: the New incident modal can be opened and closed by keyboard, restoring focus', async () => {
    const user = userEvent.setup()
    await renderApp()
    const trigger = screen.getByRole('button', { name: 'New incident' })
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: 'New incident' })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
