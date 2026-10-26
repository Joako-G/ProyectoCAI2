import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError } from '../../disciplines/hooks/useDisciplinesList';
import { fetchPricing } from '../services/pricing-api';
import type { PricingConfig } from '../types/pricing';

export type PricingState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; config: PricingConfig };

/** Why a re-read ran: after a write the server confirmed, or after a write that failed or whose outcome is unknown. */
export type RefreshReason = 'after-save' | 'after-failure';

/** Loads the pricing configuration once per mount; `reload` shows the loading state, `refresh` does not. */
export function usePricingConfig() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PricingState>({ phase: 'loading' });
  // When set, the last re-read failed; the reason decides whether the screen may say the change was saved.
  const [stale, setStale] = useState<RefreshReason | null>(null);
  const latestRefresh = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: 'loading' });
    setStale(null);
    fetchPricing(controller.signal).then(
      (config) => {
        if (!controller.signal.aborted) setState({ phase: 'ready', config });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ phase: 'error', message: describeError(error) });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  /**
   * Re-reads after a write without unmounting the forms the user is looking at. It never throws: if the
   * re-read fails the last config stays on screen and `stale` records the reason until a later re-read
   * succeeds. Only the most recent re-read may change the screen, so an older one finishing late is ignored.
   */
  const refresh = useCallback(async (reason: RefreshReason) => {
    const id = ++latestRefresh.current;
    try {
      const config = await fetchPricing();
      if (id !== latestRefresh.current) return;
      setState({ phase: 'ready', config });
      setStale(null);
    } catch {
      if (id === latestRefresh.current) setStale(reason);
    }
  }, []);

  return { state, stale, reload, refresh };
}
