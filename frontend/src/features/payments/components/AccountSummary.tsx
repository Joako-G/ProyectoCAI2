import type { Discipline } from '../../disciplines/types/discipline';
import type { Member } from '../../members/types/member';
import { formatPeriod } from '../../pricing/utils/pricing-format';
import type { MemberAccount } from '../types/payment';
import { conceptLabel, STANDING_LABEL } from '../utils/payment-format';

interface AccountSummaryProps {
  member: Member;
  account: MemberAccount;
  disciplines: Discipline[];
  /** Whether to list the owed concepts; the collecting form lists them itself, as checkboxes. */
  showOwed: boolean;
}

const STATUS_LABEL = { active: 'Activo', inactive: 'Inactivo' } as const;

/** Presentational: who the member is and where the account stands (RF-07). */
export function AccountSummary({ member, account, disciplines, showOwed }: AccountSummaryProps) {
  const months = `${account.unpaidPeriodCount} ${account.unpaidPeriodCount === 1 ? 'mes adeudado' : 'meses adeudados'}`;
  return (
    <>
      <section className="card payments-section" aria-label="Socio">
        <h2 className="payments-section__title">{member.firstName} {member.lastName}</h2>
        <p className="payments-meta">
          <span>N° {member.memberNumber}</span> · <span>DNI {member.dni}</span> ·{' '}
          <span className={`status-chip status-chip--${member.status}`}>{STATUS_LABEL[member.status]}</span>
        </p>
      </section>
      <section className="card payments-section" aria-label="Estado de cuenta">
        <h2 className="payments-section__title">Estado de cuenta</h2>
        <p className="payments-meta">
          <strong>{STANDING_LABEL[account.standing]}</strong>
          {account.unpaidPeriodCount > 0 ? <> · {months}</> : null}
        </p>
        {showOwed ? (
          account.owed.length === 0 ? <p className="members-page__notice">No hay conceptos adeudados.</p> : (
            <ul className="payments-owed" aria-label="Conceptos adeudados">
              {account.owed.map((entry) => (
                <li key={entry.period}>
                  <strong>{formatPeriod(entry.period)}</strong>: {entry.concepts.map((concept) => conceptLabel(concept, disciplines)).join(', ')}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    </>
  );
}
