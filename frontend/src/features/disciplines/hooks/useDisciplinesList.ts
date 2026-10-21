import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchDisciplines } from '../services/disciplines-api';
import type { Discipline, DisciplineStatusFilter } from '../types/discipline';

export type DisciplinesListState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; disciplines: Discipline[] };

export const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor.';

export function describeError(error: unknown): string {
  return error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE;
}

/** Container logic of the disciplines list: owns the filters and fetches on every change. */
export function useDisciplinesList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DisciplineStatusFilter>('all');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DisciplinesListState>({ phase: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: 'loading' });

    fetchDisciplines({ search, status }, controller.signal).then(
      (disciplines) => {
        if (!controller.signal.aborted) setState({ phase: 'ready', disciplines });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ phase: 'error', message: describeError(error) });
      },
    );

    return () => controller.abort();
  }, [search, status, attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  // Submitting the same text again acts as a refresh: the unchanged state alone would not refetch.
  const submitSearch = useCallback((next: string) => {
    setSearch(next);
    setAttempt((current) => current + 1);
  }, []);

  return { search, status, state, setSearch: submitSearch, setStatus, reload };
}
