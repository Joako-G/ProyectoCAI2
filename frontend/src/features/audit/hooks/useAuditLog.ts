import { useCallback, useEffect, useRef, useState } from 'react';
import { auditUrl, fetchAuditLog } from '../services/audit-api';
import type { AuditActor, AuditEntry, AuditFailedWrites, AuditFilters } from '../types/audit';
import { describeLoadError } from '../utils/audit-format';

export type AuditLogState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  /** `refreshing` is true while a new filter is being fetched: the previous rows stay on screen until it answers. */
  | { phase: 'ready'; entries: AuditEntry[]; failedWrites: AuditFailedWrites; actors: AuditActor[]; refreshing: boolean };

/** Loads the audit log for the filters and cancels a read that a newer one replaces. */
export function useAuditLog(filters: AuditFilters) {
  const [state, setState] = useState<AuditLogState>({ phase: 'loading' });
  const controller = useRef<AbortController | null>(null);
  // A new filter object each render would refetch forever; the URL it produces is the real identity.
  const url = auditUrl(filters);
  const latest = useRef(filters);
  latest.current = filters;

  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState((previous) => (previous.phase === 'ready' ? { ...previous, refreshing: true } : previous));
    try {
      const { entries, failedWrites, actors } = await fetchAuditLog(latest.current, current.signal);
      if (!current.signal.aborted) setState({ phase: 'ready', entries, failedWrites, actors, refreshing: false });
    } catch (error: unknown) {
      if (!current.signal.aborted) setState({ phase: 'error', message: describeLoadError(error) });
    }
  }, []);

  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load, url]);

  const reload = useCallback(() => {
    setState({ phase: 'loading' });
    void load();
  }, [load]);

  return { state, reload, url };
}
