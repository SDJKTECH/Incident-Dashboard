import { afterEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY, loadState } from '../../src/lib/storage'
import type { AppData } from '../../src/types/store'
import type { Incident } from '../../src/types/incident'
import type { Task } from '../../src/types/task'

const incident: Incident = {
  id: 'i1',
  title: 'DB down',
  description: 'desc',
  severity: 'high',
  status: 'resolved',
  assignee: 'sam',
  tags: ['db', 'prod'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  resolvedAt: '2026-01-02T00:00:00.000Z',
}
const task: Task = {
  id: 't1',
  incidentId: 'i1',
  title: 'Fix',
  status: 'in_progress',
  priority: 'low',
  dueDate: '2026-02-01',
  createdAt: '2026-01-01T00:00:00.000Z',
}
const valid: AppData = { incidents: [incident], tasks: [task] }

function seed(v: unknown): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AC-04 storage key', () => {
  it('AC-04: uses the versioned key incident-dashboard:v1', () => {
    expect(STORAGE_KEY).toBe('incident-dashboard:v1')
    seed(valid)
    expect(localStorage.getItem('incident-dashboard:v1')).not.toBeNull()
  })
})

describe('AC-04 legacy read', () => {
  it('AC-04: seeded legacy data loads as the same incidents and tasks', () => {
    seed(valid)
    const res = loadState()
    expect(res.status).toBe('ok')
    expect(res.data).toEqual(valid)
  })

  it('AC-04: empty arrays load as ok', () => {
    seed({ incidents: [], tasks: [] })
    expect(loadState()).toEqual({ data: { incidents: [], tasks: [] }, status: 'ok' })
  })

  it('AC-04: optional fields may be absent', () => {
    const inc: Record<string, unknown> = { ...incident }
    delete inc.resolvedAt
    const tk: Record<string, unknown> = { ...task }
    delete tk.incidentId
    delete tk.dueDate
    seed({ incidents: [inc], tasks: [tk] })
    expect(loadState().status).toBe('ok')
  })
})

describe('AC-04 missing / malformed', () => {
  it('AC-04: missing key -> empty status with empty data', () => {
    expect(loadState()).toEqual({ data: { incidents: [], tasks: [] }, status: 'empty' })
  })

  it('AC-04: malformed JSON -> corrupt without throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    let res: ReturnType<typeof loadState> | undefined
    expect(() => {
      res = loadState()
    }).not.toThrow()
    expect(res?.status).toBe('corrupt')
    expect(res?.data).toEqual({ incidents: [], tasks: [] })
  })

  it.each([['null'], ['42'], ['"str"'], ['[]']])(
    'AC-04: non-object JSON %s -> corrupt',
    (raw) => {
      localStorage.setItem(STORAGE_KEY, raw)
      expect(loadState().status).toBe('corrupt')
    },
  )
})

describe('AC-04 wrong shapes', () => {
  const cases: Array<[string, unknown]> = [
    ['incidents not an array', { incidents: {}, tasks: [] }],
    ['tasks not an array', { incidents: [], tasks: 'x' }],
    ['tasks missing', { incidents: [] }],
    ['incidents missing', { tasks: [] }],
    ['bad severity enum', { incidents: [{ ...incident, severity: 'urgent' }], tasks: [] }],
    ['bad incident status enum', { incidents: [{ ...incident, status: 'done' }], tasks: [] }],
    ['tags not string[]', { incidents: [{ ...incident, tags: [1, 2] }], tasks: [] }],
    ['tags not an array', { incidents: [{ ...incident, tags: 'a' }], tasks: [] }],
    ['incident missing title', { incidents: [{ ...incident, title: undefined }], tasks: [] }],
    ['incident entry is null', { incidents: [null], tasks: [] }],
    ['resolvedAt wrong type', { incidents: [{ ...incident, resolvedAt: 5 }], tasks: [] }],
    ['task bad priority', { incidents: [], tasks: [{ ...task, priority: 'p0' }] }],
    ['task bad status', { incidents: [], tasks: [{ ...task, status: 'blocked' }] }],
    ['task incidentId wrong type', { incidents: [], tasks: [{ ...task, incidentId: 3 }] }],
    ['one bad item among valid ones', { incidents: [incident, { ...incident, id: 5 }], tasks: [] }],
  ]
  it.each(cases)('AC-04: %s -> corrupt with empty data', (_name, value) => {
    seed(value)
    const res = loadState()
    expect(res.status).toBe('corrupt')
    expect(res.data).toEqual({ incidents: [], tasks: [] })
  })
})

describe('AC-04 unavailable storage', () => {
  it('AC-04: getItem throwing -> unavailable, empty data, no throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const res = loadState()
    expect(res).toEqual({ data: { incidents: [], tasks: [] }, status: 'unavailable' })
  })
})

describe('AC-04 saveState removed', () => {
  it('AC-04: storage module no longer exports saveState or validators', async () => {
    const mod: Record<string, unknown> = await import('../../src/lib/storage')
    expect(mod.saveState).toBeUndefined()
    expect(mod.isIncident).toBeUndefined()
    expect(mod.isTask).toBeUndefined()
    expect(mod.isAppData).toBeUndefined()
  })
})
