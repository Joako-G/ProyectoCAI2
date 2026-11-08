import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../members/services/members-api';
import { fetchEntriesToday } from '../services/entries-api';
import type { EntriesDay } from '../types/entries';
import { describeEntriesError } from '../utils/entries-format';

export interface EntriesTodayState {
  /** The last day read; kept on screen while a newer read runs or fails. */
  day?: EntriesDay;
  loading: boolean;
  /** `unavailable`: the server has no database. `error`: the read failed, with a Spanish message. */
  problem?: { kind: 'unavailable' } | { kind: 'error'; message: string };
}

/**
 * Reads today's entries, again whenever `refreshKey` changes and every `refreshMs`.
 * A newer read cancels a pending one, and closing the screen cancels everything.
 */
export function useEntriesToday(refreshKey: number, refreshMs: number) {
  const [state, setState] = useState<EntriesTodayState>({ loading: true });
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState((previous) => ({ ...previous, loading: true }));
    try {
      const day = await fetchEntriesToday(current.signal);
      if (!current.signal.aborted) setState({ day, loading: false });
    } catch (error: unknown) {
      if (current.signal.aborted) return;
      const problem = error instanceof ApiError && error.status === 503
        ? ({ kind: 'unavailable' } as const)
        : ({ kind: 'error', message: describeEntriesError(error) } as const);
      setState((previous) => ({ day: problem.kind === 'unavailable' ? undefined : previous.day, loading: false, problem }));
    }
  }, []);

  // refreshKey is a trigger, not data: each new value asks for a fresh read.
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const timer = setInterval(() => void load(), refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs]);

  useEffect(() => () => controller.current?.abort(), []);

  return { state, reload: load };
}
