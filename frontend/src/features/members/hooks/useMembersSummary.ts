import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchMembersSummary } from '../services/members-api';
import type { MembersSummary } from '../types/member-summary';

export type MembersSummaryState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; summary: MembersSummary };

export interface MembersSummaryController {
  state: MembersSummaryState;
  /** Fetches the counts again; the figures on screen stay until the new ones arrive. */
  refresh: () => void;
}

const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor.';

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
          setState({ phase: 'error', message: error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE });
        }
      },
    );

    return () => controller.abort();
  }, [attempt]);

  const refresh = useCallback(() => setAttempt((current) => current + 1), []);

  return { state, refresh };
}
