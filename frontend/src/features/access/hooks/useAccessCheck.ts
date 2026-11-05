import { useCallback, useEffect, useRef, useState } from 'react';
import { checkAccess } from '../services/access-api';
import type { AccessCheck } from '../types/access';
import { describeCheckError } from '../utils/access-format';

export type AccessState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; check: AccessCheck };

/** Runs one entrance check at a time and abandons a pending one when the screen closes. */
export function useAccessCheck() {
  const [state, setState] = useState<AccessState>({ phase: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);

  useEffect(() => () => controller.current?.abort(), []);

  /** Resolves true when an answer arrived, false when the check failed or another is still running. */
  const check = useCallback(async (dni: string): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    const current = new AbortController();
    controller.current = current;
    setState({ phase: 'checking' });
    try {
      const answer = await checkAccess(dni, current.signal);
      if (!current.signal.aborted) setState({ phase: 'done', check: answer });
      return true;
    } catch (error: unknown) {
      if (!current.signal.aborted) setState({ phase: 'error', message: describeCheckError(error) });
      return false;
    } finally {
      busy.current = false;
    }
  }, []);

  return { state, check };
}
