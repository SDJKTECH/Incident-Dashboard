export const DB_NAME = 'incident-dashboard';
export const STORE_NAME = 'sqlite';
export const BLOB_KEY = 'db';

export type ReadBlobResult =
  | { ok: true; blob: Uint8Array | null; corrupt?: true }
  | { ok: false; error: string };

export type WriteBlobResult = { ok: true } | { ok: false; error: string };

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'IndexedDB error';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (): void => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (): void => resolve(req.result);
    req.onerror = (): void => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = (): void => reject(new Error('IndexedDB open blocked'));
  });
}

/** Reads the stored database blob. Never throws. A null blob means nothing is stored yet. */
export async function readDbBlob(): Promise<ReadBlobResult> {
  try {
    const db = await openDb();
    try {
      return await new Promise<ReadBlobResult>((resolve) => {
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(BLOB_KEY);
        req.onsuccess = (): void => {
          const v: unknown = req.result;
          if (v === undefined || v === null) {
            resolve({ ok: true, blob: null });
            return;
          }
          const bytes =
            v instanceof Uint8Array ? v : v instanceof ArrayBuffer ? new Uint8Array(v) : null;
          // Wrong type or zero-length: a stored value that cannot be a database is corrupt.
          if (bytes === null || bytes.length === 0) resolve({ ok: true, blob: null, corrupt: true });
          else resolve({ ok: true, blob: bytes });
        };
        req.onerror = (): void => resolve({ ok: false, error: errMsg(req.error) });
      });
    } finally {
      db.close();
    }
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Writes the database blob. Never throws; resolves after the transaction completes. */
export async function writeDbBlob(blob: Uint8Array): Promise<WriteBlobResult> {
  try {
    const db = await openDb();
    try {
      return await new Promise<WriteBlobResult>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(blob, BLOB_KEY);
        tx.oncomplete = (): void => resolve({ ok: true });
        tx.onerror = (): void => resolve({ ok: false, error: errMsg(tx.error) });
        tx.onabort = (): void => resolve({ ok: false, error: errMsg(tx.error) });
      });
    } finally {
      db.close();
    }
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
