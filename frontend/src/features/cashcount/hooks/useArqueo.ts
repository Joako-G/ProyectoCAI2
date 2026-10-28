import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../members/services/members-api';
import { closeDay, fetchHistory, fetchPreview } from '../services/cashcount-api';
import type { CashCount, CashCountPreview, CloseDayInput } from '../types/cashcount';
import { describeCloseError, describeLoadError } from '../utils/cashcount-format';

export type ArqueoState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; preview: CashCountPreview; history: CashCount[] };

export type CloseState = { phase: 'idle' } | { phase: 'saving' } | { phase: 'error'; message: string };

/** Loads today's expected totals and the closed days, and closes the day. */
export function useArqueo() {
  const [state, setState] = useState<ArqueoState>({ phase: 'loading' });
  const [closing, setClosing] = useState<CloseState>({ phase: 'idle' });
  const [alreadyClosed, setAlreadyClosed] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    try {
      const [preview, history] = await Promise.all([fetchPreview(current.signal), fetchHistory(current.signal)]);
      if (!current.signal.aborted) setState({ phase: 'ready', preview, history });
    } catch (error: unknown) {
      if (!current.signal.aborted) setState({ phase: 'error', message: describeLoadError(error) });
    }
  }, []);

  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);

  const reload = useCallback(() => {
    setState({ phase: 'loading' });
    void load();
  }, [load]);

  const close = useCallback(async (input: CloseDayInput) => {
    setClosing({ phase: 'saving' });
    setAlreadyClosed(false);
    try {
      await closeDay(input);
      setClosing({ phase: 'idle' });
    } catch (error: unknown) {
      // Another close beat this one: show what the server holds instead of an error.
      if (error instanceof ApiError && error.status === 409) {
        setAlreadyClosed(true);
        setClosing({ phase: 'idle' });
      } else {
        setClosing({ phase: 'error', message: describeCloseError(error) });
        // A failure whose outcome is unknown (network, 5xx) may still have stored the close.
        if (!(error instanceof ApiError) || error.status >= 500) await load();
        return;
      }
    }
    await load();
  }, [load]);

  return { state, closing, alreadyClosed, reload, close };
}
