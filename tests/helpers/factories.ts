import type { Incident } from '../../src/types/incident'
import type { Task } from '../../src/types/task'

let n = 0

export function makeIncident(over: Partial<Incident> = {}): Incident {
  n += 1
  return {
    id: `inc-${n}`,
    title: `Incident ${n}`,
    description: '',
    severity: 'medium',
    status: 'open',
    assignee: '',
    tags: [],
    createdAt: '2025-06-15T12:00:00.000Z',
    updatedAt: '2025-06-15T12:00:00.000Z',
    ...over,
  }
}

export function makeTask(over: Partial<Task> = {}): Task {
  n += 1
  return {
    id: `task-${n}`,
    title: `Task ${n}`,
    status: 'todo',
    priority: 'medium',
    createdAt: '2025-06-15T12:00:00.000Z',
    ...over,
  }
}
