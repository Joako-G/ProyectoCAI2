import type { Member } from '../types/member';
import { calculateAge, formatIsoDate } from '../utils/member-format';

interface MembersTableProps {
  members: Member[];
  /** Today's club date (`YYYY-MM-DD`), used to derive ages. */
  today: string;
}

const STATUS_LABEL = { active: 'Activo', inactive: 'Inactivo' } as const;

function ageLabel(age: number): string {
  return `${age} ${age === 1 ? 'año' : 'años'}`;
}

export function MembersTable({ members, today }: MembersTableProps) {
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
          <tr key={member.id}>
            <td className="members-table__number">{member.memberNumber}</td>
            <td>
              <div className="members-table__person">
                <span className="members-table__name">
                  {member.firstName} {member.lastName}
                </span>
                <span className="members-table__meta">
                  {member.category} · {ageLabel(calculateAge(member.birthDate, today))}
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
