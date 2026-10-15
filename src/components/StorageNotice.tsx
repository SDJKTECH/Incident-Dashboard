import type { LoadStatus } from '../types/store';

interface StorageNoticeProps {
  loadStatus: LoadStatus;
  persistOk: boolean;
  migrated?: boolean;
}

export function StorageNotice({
  loadStatus,
  persistOk,
  migrated = false,
}: StorageNoticeProps): JSX.Element | null {
  if (loadStatus === 'loading') return null;
  const warnings: string[] = [];
  if (loadStatus === 'corrupt') {
    warnings.push('Stored data was invalid and was ignored. Starting with empty data.');
  }
  if (loadStatus === 'unavailable' || !persistOk) {
    warnings.push("Storage is unavailable. Your changes won't be saved after you close this page.");
  }
  const showMigrated = migrated && warnings.length === 0;
  if (warnings.length === 0 && !showMigrated) return null;
  if (showMigrated) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border border-blue-700 bg-blue-50 p-3 text-sm text-blue-900"
      >
        <p>Your existing data was imported into the new database. The old copy was kept as a backup.</p>
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md border border-yellow-600 bg-yellow-50 p-3 text-sm text-yellow-900"
    >
      {warnings.map((m) => (
        <p key={m}>Warning: {m}</p>
      ))}
    </div>
  );
}
