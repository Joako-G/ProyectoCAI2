import { roleLabel } from '../../users/utils/user-format';
import type { AuditEntry } from '../types/audit';
import { memberNumberOf } from '../utils/audit-filters';
import { actionLabel, actionTone, changedFieldsLabel, formatInstant } from '../utils/audit-format';

interface AuditTableProps {
  entries: readonly AuditEntry[];
  /** Filters the log by a member number; offered on the records that are a member. */
  onFilterMember: (memberNumber: string) => void;
}

/** The rows of the log. Under 640px each row stacks as a card, like the members table. */
export function AuditTable({ entries, onFilterMember }: AuditTableProps) {
  return (
    <table className="members-table members-table--stack audit-table">
      <caption className="visually-hidden">Registro de auditoría</caption>
      <thead>
        <tr className="table-head">
          <th scope="col">Fecha</th><th scope="col">Usuario</th><th scope="col">Acción</th>
          <th scope="col">Registro</th><th scope="col">Campos modificados</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const memberNumber = memberNumberOf(entry);
          return (
            <tr key={entry.id}>
              <td className="audit-table__date" data-label="Fecha">{formatInstant(entry.at)}</td>
              <td data-label="Usuario">
                <span className="audit-table__user">
                  <span className="audit-table__name">{entry.actor.name}</span>
                  <span className="audit-table__role">{roleLabel(entry.actor.role)}</span>
                </span>
              </td>
              <td data-label="Acción">
                <span className={`audit-badge audit-badge--${actionTone(entry.action)}`}>{actionLabel(entry.action)}</span>
              </td>
              <td data-label="Registro">
                {memberNumber ? (
                  <button
                    type="button"
                    className="audit-table__record audit-table__record--link"
                    title={`Ver solo los registros del socio ${memberNumber}`}
                    onClick={() => onFilterMember(memberNumber)}
                  >
                    {entry.entityLabel}
                  </button>
                ) : (
                  <span className="audit-table__record">{entry.entityLabel}</span>
                )}
              </td>
              <td className="audit-table__fields" data-label="Campos modificados">{changedFieldsLabel(entry.changedFields)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
