import { useCallback, useState } from 'react';
import type { FilterState } from '../types/filters';
import { DEFAULT_FILTERS } from '../lib/filtering';

export interface UseFilters {
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  clearFilters: () => void;
}

/** In-memory filter/search/sort state. Persistence is deferred. */
export function useFilters(): UseFilters {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const setFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]): void => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const clearFilters = useCallback((): void => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return { filters, setFilter, clearFilters };
}
