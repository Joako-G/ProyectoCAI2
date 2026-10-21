import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchMembers } from '../services/members-api';
import type { Member, MemberStatusFilter } from '../types/member';

export type MembersListState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; members: Member[] };

const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor.';

function describeError(error: unknown): string {
  return error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE;
}

/** Container logic of the members list: owns the filters and fetches on every change. */
export function useMembersList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MemberStatusFilter>('all');
  const [disciplineId, setDisciplineId] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<MembersListState>({ phase: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: 'loading' });

    fetchMembers({ search, status, disciplineId }, controller.signal).then(
      (members) => {
        if (!controller.signal.aborted) setState({ phase: 'ready', members });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ phase: 'error', message: describeError(error) });
      },
    );

    return () => controller.abort();
  }, [search, status, disciplineId, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  // Submitting the same text again acts as a refresh: the unchanged state alone would not refetch.
  const submitSearch = useCallback((next: string) => {
    setSearch(next);
    setAttempt((current) => current + 1);
  }, []);

  return { search, status, disciplineId, state, setSearch: submitSearch, setStatus, setDisciplineId, retry };
}
