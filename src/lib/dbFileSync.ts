/** Dev-server endpoint (see vite.config.ts) that writes the posted bytes to data/incident-dashboard.db. */
export const DB_FILE_ENDPOINT = '/__db';

/**
 * Mirrors the SQLite bytes to a .db file in the project folder via the Vite dev server.
 * Dev only and best-effort: IndexedDB stays the source of truth, so failures are ignored.
 */
export async function syncDbFile(bytes: Uint8Array): Promise<boolean> {
  if (!import.meta.env.DEV || typeof fetch !== 'function') return false;
  try {
    const res = await fetch(DB_FILE_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Blob([bytes as BlobPart]),
    });
    return res.ok;
  } catch {
    return false;
  }
}
