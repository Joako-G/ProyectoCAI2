import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAccount, fetchHistory } from '../services/payments-api';
import type { MemberAccount, Payment } from '../types/payment';
import { describeReadError } from '../utils/payment-format';

export type MemberAccountState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; account: MemberAccount; history: Payment[] };

/** Why a re-read ran: after a write the server confirmed, or after a write that failed or whose outcome is unknown. */
export type RefreshReason = 'after-save' | 'after-failure';

const readBoth = (memberId: string, signal?: AbortSignal) =>
  Promise.all([fetchAccount(memberId, signal), fetchHistory(memberId, signal)]);

/** Loads a member's account and payment history; `reload` shows the loading state, `refresh` does not. */
export function useMemberAccount(memberId: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<MemberAccountState>({ phase: 'loading' });
  // When set, the last re-read failed; the reason decides whether the screen may say the write was saved.
  const [stale, setStale] = useState<RefreshReason | null>(null);
  const latestRefresh = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: 'loading' });
    setStale(null);
    readBoth(memberId, controller.signal).then(
      ([account, history]) => {
        if (!controller.signal.aborted) setState({ phase: 'ready', account, history });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ phase: 'error', message: describeReadError(error) });
      },
    );
    return () => controller.abort();
  }, [memberId, attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  /**
   * Re-reads after a write without hiding what the user is looking at. It never throws: if the re-read
   * fails the last data stays on screen and `stale` records the reason until a later re-read succeeds.
   * Only the most recent re-read may change the screen.
   */
  const refresh = useCallback(async (reason: RefreshReason) => {
    const id = ++latestRefresh.current;
    try {
      const [account, history] = await readBoth(memberId);
      if (id !== latestRefresh.current) return;
      setState({ phase: 'ready', account, history });
      setStale(null);
    } catch {
      if (id === latestRefresh.current) setStale(reason);
    }
  }, [memberId]);

  return { state, stale, reload, refresh };
}
