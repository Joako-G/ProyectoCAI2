import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDebtNotices } from '../services/notices-api';
import type { DebtNoticeList } from '../types/notice';
import { describeLoadError } from '../utils/notice-format';

export type DebtNoticesState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; list: DebtNoticeList };

/** Loads the members with debt and cancels a read that a newer one replaces. */
export function useDebtNotices() {
  const [state, setState] = useState<DebtNoticesState>({ phase: 'loading' });
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    try {
      const list = await fetchDebtNotices(current.signal);
      if (!current.signal.aborted) setState({ phase: 'ready', list });
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

  return { state, reload };
}
