import { describe, expect, it } from 'vitest'
import { isAppData, isIncident, isTask } from '../../src/lib/validation'
import { makeIncident, makeTask } from '../helpers/factories'

describe('AC-04 validation: isIncident', () => {
  it('AC-04: accepts a valid incident with and without resolvedAt', () => {
    expect(isIncident(makeIncident())).toBe(true)
    expect(isIncident(makeIncident({ resolvedAt: '2026-01-01T00:00:00.000Z' }))).toBe(true)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string', 'x'],
    ['number', 3],
    ['array', []],
  ])('AC-04: rejects non-object %s', (_n, v) => {
    expect(isIncident(v)).toBe(false)
  })

  const base = makeIncident()
  it.each([
    ['id wrong type', { ...base, id: 1 }],
    ['title missing', { ...base, title: undefined }],
    ['description wrong type', { ...base, description: null }],
    ['bad severity', { ...base, severity: 'urgent' }],
    ['bad status', { ...base, status: 'done' }],
    ['assignee wrong type', { ...base, assignee: 5 }],
    ['tags not an array', { ...base, tags: 'a' }],
    ['tags with non-strings', { ...base, tags: ['a', 1] }],
    ['createdAt wrong type', { ...base, createdAt: 1 }],
    ['updatedAt missing', { ...base, updatedAt: undefined }],
    ['resolvedAt wrong type', { ...base, resolvedAt: 5 }],
    ['resolvedAt null', { ...base, resolvedAt: null }],
  ])('AC-04: rejects incident with %s', (_n, v) => {
    expect(isIncident(v)).toBe(false)
  })
})

describe('AC-04 validation: isTask', () => {
  it('AC-04: accepts valid tasks with and without optional fields', () => {
    expect(isTask(makeTask())).toBe(true)
    expect(isTask(makeTask({ incidentId: 'i', dueDate: '2026-01-01' }))).toBe(true)
  })

  const base = makeTask()
  it.each([
    ['null', null],
    ['array', []],
    ['bad status', { ...base, status: 'blocked' }],
    ['bad priority', { ...base, priority: 'p0' }],
    ['title wrong type', { ...base, title: 2 }],
    ['id missing', { ...base, id: undefined }],
    ['createdAt wrong type', { ...base, createdAt: 2 }],
    ['incidentId wrong type', { ...base, incidentId: 3 }],
    ['dueDate wrong type', { ...base, dueDate: 3 }],
    ['incidentId null', { ...base, incidentId: null }],
  ])('AC-04: rejects task: %s', (_n, v) => {
    expect(isTask(v)).toBe(false)
  })
})

describe('AC-04 validation: isAppData', () => {
  it('AC-04: accepts empty and populated data', () => {
    expect(isAppData({ incidents: [], tasks: [] })).toBe(true)
    expect(isAppData({ incidents: [makeIncident()], tasks: [makeTask()] })).toBe(true)
  })

  it.each([
    ['null', null],
    ['array', []],
    ['incidents missing', { tasks: [] }],
    ['tasks missing', { incidents: [] }],
    ['incidents not array', { incidents: {}, tasks: [] }],
    ['tasks not array', { incidents: [], tasks: 'x' }],
    ['one bad incident among valid', { incidents: [makeIncident(), { id: 5 }], tasks: [] }],
    ['one bad task among valid', { incidents: [], tasks: [makeTask(), { id: 5 }] }],
  ])('AC-04: rejects %s', (_n, v) => {
    expect(isAppData(v)).toBe(false)
  })
})
