import { useCallback, useEffect, useState } from 'react';
import { describeError } from '../../disciplines/hooks/useDisciplinesList';
import { fetchPricing } from '../services/pricing-api';
import type { PricingConfig } from '../types/pricing';

export type PricingState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; config: PricingConfig };

/** Loads the pricing configuration once per mount; `reload` shows the loading state, `refresh` does not. */
export function usePricingConfig() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PricingState>({ phase: 'loading' });
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: 'loading' });
    setStale(false);
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
   * re-read fails the last config stays on screen and `stale` turns on until a later re-read succeeds.
   */
  const refresh = useCallback(async () => {
    try {
      setState({ phase: 'ready', config: await fetchPricing() });
      setStale(false);
    } catch {
      setStale(true);
    }
  }, []);

  return { state, stale, reload, refresh };
}
