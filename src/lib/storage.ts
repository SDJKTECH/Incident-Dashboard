import type { AppData, LoadResult } from '../types/store';
import { isAppData } from './validation';

export const STORAGE_KEY = 'incident-dashboard:v1';

function emptyData(): AppData {
  return { incidents: [], tasks: [] };
}

/** Legacy LocalStorage reader (kept for migration). */
export function loadState(): LoadResult {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { data: emptyData(), status: 'unavailable' };
  }
  if (raw === null) return { data: emptyData(), status: 'empty' };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isAppData(parsed)) {
      return {
        data: { incidents: parsed.incidents, tasks: parsed.tasks },
        status: 'ok',
      };
    }
  } catch {
    // fall through to corrupt
  }
  return { data: emptyData(), status: 'corrupt' };
}
