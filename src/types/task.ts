import type { Severity } from './incident';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  incidentId?: string; // optional link to an Incident
  title: string;
  status: TaskStatus;
  priority: Severity;
  dueDate?: string; // ISO 8601
  createdAt: string; // ISO 8601
}
