import { describe, expect, it } from 'vitest'
import {
  INCIDENT_COLUMNS,
  INSERT_INCIDENT,
  INSERT_TASK,
  TASK_COLUMNS,
  incidentToRow,
  rowToIncident,
  rowToTask,
  taskToRow,
} from '../../src/lib/sqliteMapping'
import { isIncident, isTask } from '../../src/lib/validation'
import { runMigrations } from '../../src/lib/sqliteSchema'
import { makeIncident, makeTask } from '../helpers/factories'
import { newDb } from '../helpers/sqlJs'

describe('AC-04 sqliteMapping: incident rows', () => {
  it('AC-04: incidentToRow follows column order, tags as JSON, absent resolvedAt as NULL', () => {
    const i = makeIncident({ id: 'a', tags: ['x', 'y'] })
    const row = incidentToRow(i)
    expect(row).toHaveLength(INCIDENT_COLUMNS.split(',').length)
    expect(row[0]).toBe('a')
    expect(row[6]).toBe('["x","y"]')
    expect(row[9]).toBeNull()
  })

  it('AC-04: resolvedAt present is written as the string', () => {
    expect(incidentToRow(makeIncident({ resolvedAt: 'R' }))[9]).toBe('R')
  })

  it('AC-04: rowToIncident maps NULL resolvedAt to an absent key', () => {
    const obj = rowToIncident(incidentToRow(makeIncident())) as Record<string, unknown>
    expect('resolvedAt' in obj).toBe(false)
    expect(isIncident(obj)).toBe(true)
  })

  it('AC-04: pure round trip preserves a full incident, including empty strings and empty tags', () => {
    const full = makeIncident({ resolvedAt: '2026-01-01T00:00:00.000Z', tags: ['a', 'b'], assignee: 'bob' })
    expect(rowToIncident(incidentToRow(full))).toEqual(full)
    const minimal = makeIncident({ description: '', assignee: '', tags: [] })
    expect(rowToIncident(incidentToRow(minimal))).toEqual(minimal)
  })

  it.each([
    ['malformed JSON', '{oops'],
    ['JSON string instead of array', '"abc"'],
    ['JSON object instead of array', '{"a":1}'],
    ['array with non-strings', '[1,2]'],
    ['NULL', null],
  ])('AC-04: bad tags (%s) yield an object that fails isIncident, never throw', (_n, tags) => {
    const row = [...incidentToRow(makeIncident())]
    row[6] = tags
    let obj: unknown
    expect(() => {
      obj = rowToIncident(row)
    }).not.toThrow()
    expect(isIncident(obj)).toBe(false)
  })

  it('AC-04: rows with wrong enum values fail validation', () => {
    const row = [...incidentToRow(makeIncident())]
    row[3] = 'urgent'
    expect(isIncident(rowToIncident(row))).toBe(false)
  })
})

describe('AC-04 sqliteMapping: task rows', () => {
  it('AC-04: taskToRow writes absent optional fields as NULL', () => {
    const row = taskToRow(makeTask({ id: 't' }))
    expect(row).toHaveLength(TASK_COLUMNS.split(',').length)
    expect(row[1]).toBeNull()
    expect(row[5]).toBeNull()
  })

  it('AC-04: rowToTask maps NULL optional columns to absent keys', () => {
    const obj = rowToTask(taskToRow(makeTask())) as Record<string, unknown>
    expect('incidentId' in obj).toBe(false)
    expect('dueDate' in obj).toBe(false)
    expect(isTask(obj)).toBe(true)
  })

  it('AC-04: pure round trip preserves full and minimal tasks', () => {
    const full = makeTask({ incidentId: 'i1', dueDate: '2026-02-01', status: 'done', priority: 'high' })
    expect(rowToTask(taskToRow(full))).toEqual(full)
    const min = makeTask()
    expect(rowToTask(taskToRow(min))).toEqual(min)
  })

  it('AC-04: a bad status row fails validation', () => {
    const row = [...taskToRow(makeTask())]
    row[3] = 'blocked'
    expect(isTask(rowToTask(row))).toBe(false)
  })
})

describe('AC-04 sqliteMapping: round trip through real SQLite', () => {
  it('AC-04: insert statements and select columns agree with the schema', async () => {
    const db = await newDb()
    runMigrations(db)
    const incs = [
      makeIncident({ tags: ['a', 'b "quoted"', 'café'], resolvedAt: '2026-01-02T00:00:00.000Z' }),
      makeIncident({ description: '', assignee: '', tags: [] }),
    ]
    const tasks = [makeTask({ incidentId: incs[0].id, dueDate: '2026-03-03' }), makeTask()]
    for (const i of incs) db.run(INSERT_INCIDENT, incidentToRow(i))
    for (const t of tasks) db.run(INSERT_TASK, taskToRow(t))

    const incRows = db.exec(`SELECT ${INCIDENT_COLUMNS} FROM incidents ORDER BY rowid`)[0].values
    const taskRows = db.exec(`SELECT ${TASK_COLUMNS} FROM tasks ORDER BY rowid`)[0].values
    expect(incRows.map(rowToIncident)).toEqual(incs)
    expect(taskRows.map(rowToTask)).toEqual(tasks)
    // NULL columns really are NULL in SQLite.
    expect(incRows[1][9]).toBeNull()
    expect(taskRows[1][1]).toBeNull()
    expect(taskRows[1][5]).toBeNull()
    db.close()
  })
})
