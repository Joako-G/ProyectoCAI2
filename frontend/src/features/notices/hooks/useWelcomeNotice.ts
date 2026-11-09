import { useCallback, useEffect, useState } from 'react';
import { fetchWelcomeNotice } from '../services/notices-api';
import type { WelcomeNotice } from '../types/notice';

export type WelcomeNoticeState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; notice: WelcomeNotice };

/** Prepares the welcome of a payment as soon as it mounts, so the send link is a plain anchor the browser will open. */
export function useWelcomeNotice(paymentId: string) {
  const [state, setState] = useState<WelcomeNoticeState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: 'loading' });
    fetchWelcomeNotice(paymentId, controller.signal)
      .then((notice) => {
        if (!controller.signal.aborted) setState({ phase: 'ready', notice });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ phase: 'error' });
      });
    return () => controller.abort();
  }, [paymentId, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  return { state, retry };
}
