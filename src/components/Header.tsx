interface HeaderProps {
  onNewIncident: () => void;
}

export function Header({ onNewIncident }: HeaderProps): JSX.Element {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-gray-900">Incident Dashboard</h1>
      <button
        type="button"
        onClick={onNewIncident}
        className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
      >
        New incident
      </button>
    </header>
  );
}
