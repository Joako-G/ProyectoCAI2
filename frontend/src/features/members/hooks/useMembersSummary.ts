import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchMembersSummary } from '../services/members-api';
import type { MembersSummary } from '../types/member-summary';

export type MembersSummaryState =
  | { phase: 'loading' }
  /** `stale` keeps the last counts that loaded, so a failed refresh does not drop what is on screen. */
  | { phase: 'error'; message: string; stale?: MembersSummary }
  | { phase: 'ready'; summary: MembersSummary };

export interface MembersSummaryController {
  state: MembersSummaryState;
  /** Fetches the counts again; the figures on screen stay until the new ones arrive. */
  refresh: () => void;
}

const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor.';

/** The last counts that loaded, if any. */
export function lastSummary(state: MembersSummaryState): MembersSummary | undefined {
  if (state.phase === 'ready') return state.summary;
  if (state.phase === 'error') return state.stale;
  return undefined;
}

/** Container logic of the stat cards: the counts and the member ids of each standing group. */
export function useMembersSummary(): MembersSummaryController {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<MembersSummaryState>({ phase: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    fetchMembersSummary(controller.signal).then(
      (summary) => {
        if (!controller.signal.aborted) setState({ phase: 'ready', summary });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          const message = error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE;
          setState((previous) => ({ phase: 'error', message, stale: lastSummary(previous) }));
        }
      },
    );

    return () => controller.abort();
  }, [attempt]);

  const refresh = useCallback(() => setAttempt((current) => current + 1), []);

  return { state, refresh };
}
