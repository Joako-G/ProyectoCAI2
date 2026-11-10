import type { Discipline } from '../../disciplines/types/discipline';
import { disciplineNames } from '../../disciplines/utils/discipline-labels';
import type { Member } from '../types/member';
import type { StandingGroup } from '../types/member-summary';
import { calculateAge, formatAge, formatIsoDate } from '../utils/member-format';
import { STANDING_CHIP_LABEL } from '../utils/member-standing';

interface MembersTableProps {
  members: Member[];
  /** Today's club date (`YYYY-MM-DD`), used to derive ages. */
  today: string;
  /** Discipline catalog used to show names instead of ids. */
  disciplines?: Discipline[];
  /** Account standing of each active member, from the summary; an active member missing from it shows nothing. */
  standingById?: ReadonlyMap<string, StandingGroup>;
  /** Opens a member. The whole row is clickable; the name button makes it reachable by keyboard. */
  onOpen?: (member: Member) => void;
}

function AccountCell({ member, standing }: { member: Member; standing: StandingGroup | undefined }) {
  if (member.status === 'inactive') return <span className="account-chip account-chip--inactive">Inactivo</span>;
  // The counts did not load (or the member is new to them): the cell stays empty rather than guess.
  if (!standing) return null;
  return <span className={`account-chip account-chip--${standing}`}>{STANDING_CHIP_LABEL[standing]}</span>;
}

export function MembersTable({ members, today, disciplines = [], standingById, onOpen }: MembersTableProps) {
  return (
    <table className="members-table members-table--stack members-register">
      <caption className="visually-hidden">Listado de socios</caption>
      <thead>
        <tr className="table-head">
          <th scope="col">N° socio</th>
          <th scope="col">Socio</th>
          <th scope="col">DNI</th>
          <th scope="col">Disciplinas</th>
          <th scope="col">Socio desde</th>
          <th scope="col">Cuenta</th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <tr
            key={member.id}
            className={onOpen ? 'members-table__row--clickable' : undefined}
            onClick={onOpen ? () => onOpen(member) : undefined}
          >
            <td className="members-table__number" data-label="N° socio">{member.memberNumber}</td>
            <td>
              <div className="members-table__person">
                {onOpen ? (
                  <button type="button" className="members-table__name members-table__name-button">
                    {member.firstName} {member.lastName}
                  </button>
                ) : (
                  <span className="members-table__name">
                    {member.firstName} {member.lastName}
                  </span>
                )}
                <span className="members-table__meta">
                  {member.category} · {formatAge(calculateAge(member.birthDate, today))}
                </span>
              </div>
            </td>
            <td className="members-table__mono" data-label="DNI">{member.dni}</td>
            <td className="members-table__disciplines" data-label="Disciplinas">
              {disciplineNames(member.disciplineIds, disciplines).join(', ') || '—'}
            </td>
            <td className="members-table__mono" data-label="Socio desde">{formatIsoDate(member.memberSince)}</td>
            <td data-label="Cuenta">
              <AccountCell member={member} standing={standingById?.get(member.id)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
