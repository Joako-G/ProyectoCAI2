import { useCallback, useEffect, useState } from 'react';
import { ApiError, getMember } from '../services/members-api';
import type { Member } from '../types/member';

export type MemberDetailState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; member: Member };

export const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor.';

export function describeError(error: unknown): string {
  return error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE;
}

/**
 * Container logic: loads one member and lets callers swap in the fresh copy returned by a mutation.
 * A `null` id loads nothing (the create form has no member yet).
 */
export function useMemberDetail(id: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<MemberDetailState>({ phase: 'loading' });

  useEffect(() => {
    if (id === null) return;
    const controller = new AbortController();
    setState({ phase: 'loading' });

    getMember(id, controller.signal).then(
      (member) => {
        if (!controller.signal.aborted) setState({ phase: 'ready', member });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ phase: 'error', message: describeError(error) });
      },
    );

    return () => controller.abort();
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const replace = useCallback((member: Member) => setState({ phase: 'ready', member }), []);

  return { state, retry, replace };
}
