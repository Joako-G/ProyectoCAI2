import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchBackupStatus, runBackup } from '../services/backup-api';
import type { BackupStatus } from '../types/backup';
import { describeLoadError, describeRunError } from '../utils/backup-format';

export type BackupState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; status: BackupStatus };

export type RunState = { phase: 'idle' } | { phase: 'running' } | { phase: 'done' } | { phase: 'error'; message: string };

/** Loads the backup status and makes a copy now. */
export function useBackups() {
  const [state, setState] = useState<BackupState>({ phase: 'loading' });
  const [run, setRun] = useState<RunState>({ phase: 'idle' });
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    try {
      const status = await fetchBackupStatus(current.signal);
      if (!current.signal.aborted) setState({ phase: 'ready', status });
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

  const makeCopy = useCallback(async () => {
    setRun({ phase: 'running' });
    try {
      await runBackup();
      setRun({ phase: 'done' });
    } catch (error: unknown) {
      setRun({ phase: 'error', message: describeRunError(error) });
    }
    // Whatever happened, the server holds the truth: a failed copy shows as the last failure.
    await load();
  }, [load]);

  return { state, run, reload, makeCopy };
}
