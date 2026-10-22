import { useCallback, useEffect, useState } from 'react';
import { fetchDisciplines } from '../services/disciplines-api';
import type { Discipline } from '../types/discipline';
import { describeError } from './useDisciplinesList';

export type DisciplineCatalogState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; disciplines: Discipline[] };

export interface DisciplineCatalog {
  state: DisciplineCatalogState;
  retry: () => void;
}

/** Disciplines to display: the whole catalog (active and inactive) once loaded, none before. */
export function catalogDisciplines({ state }: DisciplineCatalog): Discipline[] {
  return state.phase === 'ready' ? state.disciplines : [];
}

/** Loads the whole discipline catalog once per mount, so screens can resolve ids to names. */
export function useDisciplineCatalog(): DisciplineCatalog {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DisciplineCatalogState>({ phase: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: 'loading' });

    fetchDisciplines({ search: '', status: 'all' }, controller.signal).then(
      (disciplines) => {
        if (!controller.signal.aborted) setState({ phase: 'ready', disciplines });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ phase: 'error', message: describeError(error) });
      },
    );

    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return { state, retry };
}
