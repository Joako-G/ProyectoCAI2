import { useCallback, useEffect, useRef, useState } from 'react';
import { describeReportError } from '../utils/report-format';

export type ReportState<T> =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; report: T };

type Load<T> = (signal: AbortSignal) => Promise<T>;

/** Runs one report on demand; a newer run cancels the one before it, and `retry` repeats the last one. */
export function useReport<T>() {
  const [state, setState] = useState<ReportState<T>>({ phase: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const last = useRef<Load<T> | null>(null);

  const run = useCallback((load: Load<T>) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    last.current = load;
    setState({ phase: 'loading' });
    load(current.signal).then(
      (report) => {
        if (!current.signal.aborted) setState({ phase: 'ready', report });
      },
      (error: unknown) => {
        if (!current.signal.aborted) setState({ phase: 'error', message: describeReportError(error) });
      },
    );
  }, []);

  const retry = useCallback(() => {
    if (last.current) run(last.current);
  }, [run]);

  useEffect(() => () => controller.current?.abort(), []);

  return { state, run, retry };
}
