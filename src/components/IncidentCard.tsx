import type { Incident } from '../types/incident';
import { Badge } from './Badge';

interface IncidentCardProps {
  incident: Incident;
  onEdit: (incident: Incident) => void;
  onDelete: (incident: Incident) => void;
}

const BTN =
  'rounded-md border border-gray-400 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export function IncidentCard({ incident, onEdit, onDelete }: IncidentCardProps): JSX.Element {
  return (
    <article className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 break-words text-lg font-semibold text-gray-900">{incident.title}</h3>
        <div className="flex flex-wrap gap-2">
          <Badge kind="severity" value={incident.severity} />
          <Badge kind="status" value={incident.status} />
        </div>
      </div>
      {incident.description && (
        <p className="mt-2 break-words text-sm text-gray-800">{incident.description}</p>
      )}
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
        <div className="flex gap-1">
          <dt className="font-medium">Assignee:</dt>
          <dd>{incident.assignee || 'Unassigned'}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">Created:</dt>
          <dd>{formatDate(incident.createdAt)}</dd>
        </div>
      </dl>
      {incident.tags.length > 0 && (
        <ul aria-label="Tags" className="mt-2 flex flex-wrap gap-1">
          {incident.tags.map((t) => (
            <li key={t} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800">
              {t}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={BTN}
          aria-label={`Edit incident "${incident.title}"`}
          onClick={() => onEdit(incident)}
        >
          Edit
        </button>
        <button
          type="button"
          className={BTN}
          aria-label={`Delete incident "${incident.title}"`}
          onClick={() => onDelete(incident)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
