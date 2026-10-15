import type { Incident } from '../types/incident';
import { IncidentCard } from './IncidentCard';

interface IncidentListProps {
  incidents: readonly Incident[];
  onEdit: (incident: Incident) => void;
  onDelete: (incident: Incident) => void;
}

export function IncidentList({ incidents, onEdit, onDelete }: IncidentListProps): JSX.Element {
  if (incidents.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-400 bg-white p-6 text-center text-gray-700">
        No incidents match your filters.
      </p>
    );
  }
  return (
    <ul aria-label="Incidents" className="space-y-3">
      {incidents.map((inc) => (
        <li key={inc.id}>
          <IncidentCard incident={inc} onEdit={onEdit} onDelete={onDelete} />
        </li>
      ))}
    </ul>
  );
}
