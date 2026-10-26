import { useState, type FormEvent } from 'react';
import { fetchMembers } from '../../members/services/members-api';
import type { Member } from '../../members/types/member';
import { describeReadError } from '../utils/payment-format';
import { MemberPayments } from './MemberPayments';

interface PaymentsViewProps {
  /** Whether the user may register payments (`payments:collect`). */
  canCollect: boolean;
  /** Whether the user may annul payments (`payments:annul`). */
  canAnnul: boolean;
}

type SearchState =
  | { phase: 'idle' }
  | { phase: 'searching' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; members: Member[] };

/** Container of the payments feature: find a member by DNI, then work on their account. */
export function PaymentsView({ canCollect, canAnnul }: PaymentsViewProps) {
  const [dni, setDni] = useState('');
  const [search, setSearch] = useState<SearchState>({ phase: 'idle' });
  const [chosen, setChosen] = useState<Member>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = dni.trim();
    if (!term) return;
    setChosen(undefined);
    setSearch({ phase: 'searching' });
    try {
      const members = await fetchMembers({ search: term, status: 'all' });
      setSearch({ phase: 'done', members });
      if (members.length === 1) setChosen(members[0]);
    } catch (error) {
      setSearch({ phase: 'error', message: describeReadError(error) });
    }
  }

  return (
    <div className="payments-view">
      <section className="card payments-section" aria-label="Cobros">
        <form className="members-toolbar__search" role="search" onSubmit={handleSubmit}>
          <label className="members-toolbar__search-field">
            <span className="members-toolbar__search-label table-head">DNI del socio</span>
            <input type="search" inputMode="numeric" autoComplete="off" placeholder="DNI del socio…" value={dni} onChange={(event) => setDni(event.target.value)} />
          </label>
          <button type="submit" className="button button--secondary" disabled={dni.trim() === '' || search.phase === 'searching'}>Buscar</button>
        </form>
        {search.phase === 'searching' ? <p className="members-page__notice" role="status">Buscando socio…</p> : null}
        {search.phase === 'error' ? (
          <p className="members-page__notice members-page__notice--error" role="alert">
            <strong>No se pudo buscar el socio.</strong> {search.message}
          </p>
        ) : null}
        {search.phase === 'done' && search.members.length === 0 ? (
          <p className="members-page__notice">No se encontró ningún socio con ese DNI.</p>
        ) : null}
        {search.phase === 'done' && search.members.length > 1 ? (
          <ul className="payments-matches" aria-label="Socios encontrados">
            {search.members.map((member) => (
              <li key={member.id}>
                <button type="button" className="button button--secondary" aria-pressed={chosen?.id === member.id} onClick={() => setChosen(member)}>
                  {member.firstName} {member.lastName} · N° {member.memberNumber} · DNI {member.dni}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {chosen ? <MemberPayments key={chosen.id} member={chosen} canCollect={canCollect} canAnnul={canAnnul} /> : null}
    </div>
  );
}
