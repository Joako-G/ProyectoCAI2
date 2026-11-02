import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAuditLog } from '../services/audit-api';
import type { AuditFailedWrites, AuditEntry } from '../types/audit';
import { describeLoadError } from '../utils/audit-format';

export type AuditLogState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; entries: AuditEntry[]; failedWrites: AuditFailedWrites };

/** Loads the audit log and cancels a read that a newer one replaces. */
export function useAuditLog() {
  const [state, setState] = useState<AuditLogState>({ phase: 'loading' });
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    try {
      const { entries, failedWrites } = await fetchAuditLog(current.signal);
      if (!current.signal.aborted) setState({ phase: 'ready', entries, failedWrites });
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
