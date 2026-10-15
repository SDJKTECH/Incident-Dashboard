import { useState } from 'react';
import type { Incident } from './types/incident';
import type { NewIncidentInput, IncidentSubmitResult } from './types/inputs';
import { useIncidents } from './hooks/useIncidents';
import { useFilters } from './hooks/useFilters';
import { applyView } from './lib/filtering';
import { Header } from './components/Header';
import { StorageNotice } from './components/StorageNotice';
import { MetricsGrid } from './components/MetricsGrid';
import { FilterBar } from './components/FilterBar';
import { IncidentList } from './components/IncidentList';
import { IncidentModal } from './components/IncidentModal';
import { ConfirmDialog } from './components/ConfirmDialog';

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; incident: Incident }
  | { kind: 'delete'; incident: Incident };

export default function App(): JSX.Element {
  const store = useIncidents();
  const { filters, setFilter, clearFilters } = useFilters();
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });

  const visible = applyView(store.incidents, filters);
  const close = (): void => setModal({ kind: 'none' });

  const submit = (input: NewIncidentInput): IncidentSubmitResult => {
    if (modal.kind === 'edit') return store.updateIncident(modal.incident.id, input);
    return store.createIncident(input);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
        <Header onNewIncident={() => setModal({ kind: 'create' })} />
        <StorageNotice
          loadStatus={store.loadStatus}
          persistOk={store.persistOk}
          migrated={store.migrated}
        />
        {store.loadStatus === 'loading' && (
          <p
            role="status"
            aria-live="polite"
            className="rounded-md border border-gray-300 bg-white p-3 text-sm text-gray-700"
          >
            Loading your data...
          </p>
        )}
        <main className="space-y-4" aria-busy={store.loadStatus === 'loading'}>
          <MetricsGrid incidents={store.incidents} tasks={store.tasks} />
          <FilterBar
            filters={filters}
            incidents={store.incidents}
            onChange={setFilter}
            onClear={clearFilters}
          />
          <IncidentList
            incidents={visible}
            onEdit={(incident) => setModal({ kind: 'edit', incident })}
            onDelete={(incident) => setModal({ kind: 'delete', incident })}
          />
        </main>
      </div>
      {modal.kind === 'create' && (
        <IncidentModal mode="create" onSubmit={submit} onClose={close} />
      )}
      {modal.kind === 'edit' && (
        <IncidentModal mode="edit" incident={modal.incident} onSubmit={submit} onClose={close} />
      )}
      {modal.kind === 'delete' && (
        <ConfirmDialog
          title="Delete incident"
          message={`Delete incident "${modal.incident.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          onCancel={close}
          onConfirm={() => {
            store.deleteIncident(modal.incident.id);
            close();
          }}
        />
      )}
    </div>
  );
}
