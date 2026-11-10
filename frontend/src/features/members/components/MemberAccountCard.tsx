import { Link } from 'react-router';
import { useMemberAccountStanding } from '../hooks/useMemberAccountStanding';
import type { StandingGroup } from '../types/member-summary';
import { STANDING_CHIP_LABEL } from '../utils/member-standing';

interface MemberAccountCardProps {
  memberId: string;
  dni: string;
}

// The account endpoint speaks of standings; the list speaks of groups. A deregistered account is a "vencido" one.
const GROUP_BY_STANDING = { up_to_date: 'upToDate', debtor: 'debtors', deregistered: 'overdue' } as const satisfies Record<string, StandingGroup>;

/**
 * The "Cuenta" card of the member record: where the account stands and the way to Cobros already searched for this
 * member. Rendered only for users with `payments:read`; a failed read shows one short line and never blocks the record.
 */
export function MemberAccountCard({ memberId, dni }: MemberAccountCardProps) {
  const state = useMemberAccountStanding(memberId);
  const group = state.phase === 'ready' ? GROUP_BY_STANDING[state.account.standing] : undefined;
  const unpaid = state.phase === 'ready' ? state.account.unpaidPeriodCount : 0;

  return (
    <section className="card member-card" aria-label="Cuenta">
      <h3 className="member-card__title">Cuenta</h3>

      {state.phase === 'loading' ? <p className="member-card__note" role="status">Cargando cuenta…</p> : null}
      {state.phase === 'error' ? <p className="member-card__note member-card__note--error">{state.message}</p> : null}
      {group ? (
        <p className="member-account__standing">
          <span className={`account-chip account-chip--${group}`}>{STANDING_CHIP_LABEL[group]}</span>
          {unpaid > 0 ? <span>{unpaid} {unpaid === 1 ? 'mes adeudado' : 'meses adeudados'}</span> : null}
        </p>
      ) : null}

      <Link
        className={`member-card__action${group === 'upToDate' ? '' : ' member-card__action--primary'}`}
        to={`/cobros?dni=${encodeURIComponent(dni)}`}
      >
        Cobrar cuota
      </Link>
    </section>
  );
}
