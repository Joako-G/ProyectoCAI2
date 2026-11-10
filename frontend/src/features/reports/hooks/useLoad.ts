import { useEffect, useRef, useState } from 'react';
import { describeReportError } from '../utils/report-format';

export type LoadState<T> =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: T };

type Tagged<T> = { key: string; state: LoadState<T> };

/**
 * Loads something when `key` changes and again on `retry`; a newer load cancels the one before it. The key stands for
 * everything `load` depends on. What was loaded for an earlier key is never handed out for the current one, not even
 * for the render in which the key changes, so a caller never mixes new inputs with old data.
 */
export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, key: string): { state: LoadState<T>; retry: () => void } {
  const [tagged, setTagged] = useState<Tagged<T>>({ key, state: { phase: 'loading' } });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(load);
  latest.current = load;

  useEffect(() => {
    const controller = new AbortController();
    setTagged({ key, state: { phase: 'loading' } });
    latest.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setTagged({ key, state: { phase: 'ready', data } });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setTagged({ key, state: { phase: 'error', message: describeReportError(error) } });
      },
    );
    return () => controller.abort();
  }, [key, attempt]);

  return { state: tagged.key === key ? tagged.state : { phase: 'loading' }, retry: () => setAttempt((value) => value + 1) };
}
