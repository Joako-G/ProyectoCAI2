import { useCallback, useEffect, useState } from 'react';
import { describeError } from '../../disciplines/hooks/useDisciplinesList';
import { fetchRoster } from '../services/roster-api';
import type { DisciplineRoster } from '../types/roster';

export type RosterState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; rosters: DisciplineRoster[] };

/** Loads the signed-in teacher's rosters once per mount, and again on `reload`. */
export function useRoster() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RosterState>({ phase: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: 'loading' });
    fetchRoster(controller.signal).then(
      (rosters) => {
        if (!controller.signal.aborted) setState({ phase: 'ready', rosters });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ phase: 'error', message: describeError(error) });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);
  return { state, reload };
}
