import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Incident, IncidentStatus, Severity } from '../types/incident';
import type { IncidentSubmitResult, NewIncidentInput } from '../types/inputs';
import { INCIDENT_STATUSES, SEVERITIES } from '../lib/constants';
import { Modal } from './Modal';

interface IncidentModalProps {
  mode: 'create' | 'edit';
  incident?: Incident;
  /** Parent maps to createIncident (create) or updateIncident(id, input) (edit). */
  onSubmit: (input: NewIncidentInput) => IncidentSubmitResult;
  onClose: () => void;
}

const CONTROL =
  'w-full rounded-md border border-gray-400 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700';
const LABEL = 'mb-1 block text-sm font-medium text-gray-800';
const BTN =
  'rounded-md border px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2';

function parseTags(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(',')) {
    const t = part.trim();
    if (t !== '' && !out.includes(t)) out.push(t);
  }
  return out;
}

export function IncidentModal({ mode, incident, onSubmit, onClose }: IncidentModalProps): JSX.Element {
  const [title, setTitle] = useState(incident?.title ?? '');
  const [description, setDescription] = useState(incident?.description ?? '');
  const [severity, setSeverity] = useState<Severity>(incident?.severity ?? 'medium');
  const [status, setStatus] = useState<IncidentStatus>(incident?.status ?? 'open');
  const [assignee, setAssignee] = useState(incident?.assignee ?? '');
  const [tagsText, setTagsText] = useState((incident?.tags ?? []).join(', '));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const result = onSubmit({
      title,
      description,
      severity,
      status,
      assignee: assignee.trim(),
      tags: parseTags(tagsText),
    });
    if (result.ok) {
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <Modal title={mode === 'create' ? 'New incident' : 'Edit incident'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="incident-title" className={LABEL}>
            Title
          </label>
          <input
            id="incident-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={error ? true : undefined}
            className={CONTROL}
          />
        </div>
        <div>
          <label htmlFor="incident-description" className={LABEL}>
            Description
          </label>
          <textarea
            id="incident-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={CONTROL}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="incident-severity" className={LABEL}>
              Severity
            </label>
            <select
              id="incident-severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
              className={CONTROL}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="incident-status" className={LABEL}>
              Status
            </label>
            <select
              id="incident-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as IncidentStatus)}
              className={CONTROL}
            >
              {INCIDENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="incident-assignee" className={LABEL}>
            Assignee
          </label>
          <input
            id="incident-assignee"
            type="text"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className={CONTROL}
          />
        </div>
        <div>
          <label htmlFor="incident-tags" className={LABEL}>
            Tags (comma-separated)
          </label>
          <input
            id="incident-tags"
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            className={CONTROL}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className={`${BTN} border-gray-400 bg-white text-gray-900 hover:bg-gray-100`}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${BTN} border-blue-700 bg-blue-700 text-white hover:bg-blue-800`}
          >
            {mode === 'create' ? 'Create incident' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
