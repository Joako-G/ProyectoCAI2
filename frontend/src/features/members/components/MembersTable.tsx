import type { Member } from '../types/member';
import { calculateAge, formatAge, formatIsoDate } from '../utils/member-format';

interface MembersTableProps {
  members: Member[];
  /** Today's club date (`YYYY-MM-DD`), used to derive ages. */
  today: string;
  /** Opens a member. The whole row is clickable; the name button makes it reachable by keyboard. */
  onOpen?: (member: Member) => void;
}

const STATUS_LABEL = { active: 'Activo', inactive: 'Inactivo' } as const;

export function MembersTable({ members, today, onOpen }: MembersTableProps) {
  return (
    <table className="members-table">
      <caption className="visually-hidden">Listado de socios</caption>
      <thead>
        <tr className="table-head">
          <th scope="col">N° socio</th>
          <th scope="col">Socio</th>
          <th scope="col">DNI</th>
          <th scope="col">Socio desde</th>
          <th scope="col">Estado</th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <tr
            key={member.id}
            className={onOpen ? 'members-table__row--clickable' : undefined}
            onClick={onOpen ? () => onOpen(member) : undefined}
          >
            <td className="members-table__number">{member.memberNumber}</td>
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
            <td className="members-table__mono">{member.dni}</td>
            <td className="members-table__mono">{formatIsoDate(member.memberSince)}</td>
            <td>
              <span className={`status-chip status-chip--${member.status}`}>
                {STATUS_LABEL[member.status]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
