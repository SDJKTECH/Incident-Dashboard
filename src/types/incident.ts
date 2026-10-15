export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  assignee: string;
  tags: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  resolvedAt?: string; // ISO 8601; set when status becomes resolved
}
