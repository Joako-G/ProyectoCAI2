import { useCallback, useEffect, useRef, useState } from 'react';
import { checkAccess, recognizeAccess } from '../services/access-api';
import type { AccessCheck } from '../types/access';
import { describeCheckError, describeRecognizeError } from '../utils/access-format';
import { ApiError } from '../../members/services/members-api';

export type AccessState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; check: AccessCheck };

/** How a face recognition ended: `unavailable` means the server has no face recognition (503), so stop trying. */
export type RecognizeOutcome = 'answered' | 'failed' | 'unavailable';

/** Runs one entrance check at a time (by DNI or by face) and abandons a pending one when the screen closes. */
export function useAccessCheck() {
  const [state, setState] = useState<AccessState>({ phase: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);

  useEffect(() => () => controller.current?.abort(), []);

  /** Resolves undefined when another check is still running, else the answer or the error. */
  const run = useCallback(async (ask: (signal: AbortSignal) => Promise<AccessCheck>, describe: (error: unknown) => string) => {
    if (busy.current) return undefined;
    busy.current = true;
    const current = new AbortController();
    controller.current = current;
    setState({ phase: 'checking' });
    try {
      const answer = await ask(current.signal);
      if (!current.signal.aborted) setState({ phase: 'done', check: answer });
      return { ok: true as const };
    } catch (error: unknown) {
      if (!current.signal.aborted) setState({ phase: 'error', message: describe(error) });
      return { ok: false as const, error };
    } finally {
      busy.current = false;
    }
  }, []);

  /** Resolves true when an answer arrived, false when the check failed or another is still running. */
  const check = useCallback(async (dni: string): Promise<boolean> => {
    const outcome = await run((signal) => checkAccess(dni, signal), describeCheckError);
    return outcome?.ok ?? false;
  }, [run]);

  const recognize = useCallback(async (descriptor: readonly number[]): Promise<RecognizeOutcome> => {
    const outcome = await run((signal) => recognizeAccess(descriptor, signal), describeRecognizeError);
    if (outcome?.ok) return 'answered';
    return outcome && outcome.error instanceof ApiError && outcome.error.status === 503 ? 'unavailable' : 'failed';
  }, [run]);

  return { state, check, recognize };
}
