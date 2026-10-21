import type { Discipline } from '../types/discipline';

interface DisciplinesTableProps {
  disciplines: Discipline[];
  onEdit: (discipline: Discipline) => void;
  onDeactivate: (discipline: Discipline) => void;
  onReactivate: (discipline: Discipline) => void;
}

const STATUS_LABEL = { active: 'Activa', inactive: 'Inactiva' } as const;

export function DisciplinesTable({ disciplines, onEdit, onDeactivate, onReactivate }: DisciplinesTableProps) {
  return (
    <table className="members-table">
      <caption className="visually-hidden">Listado de disciplinas</caption>
      <thead>
        <tr className="table-head">
          <th scope="col">Disciplina</th>
          <th scope="col">Profesor</th>
          <th scope="col">Estado</th>
          <th scope="col">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {disciplines.map((discipline) => (
          <tr key={discipline.id}>
            <td>
              <span className="members-table__name">{discipline.name}</span>
            </td>
            <td>{discipline.teacherName}</td>
            <td>
              <span className={`status-chip status-chip--${discipline.status}`}>
                {STATUS_LABEL[discipline.status]}
              </span>
            </td>
            <td>
              <div className="disciplines-table__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  aria-label={`Editar ${discipline.name}`}
                  onClick={() => onEdit(discipline)}
                >
                  Editar
                </button>
                {discipline.status === 'active' ? (
                  <button
                    type="button"
                    className="button button--danger"
                    aria-label={`Dar de baja ${discipline.name}`}
                    onClick={() => onDeactivate(discipline)}
                  >
                    Dar de baja
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button button--primary"
                    aria-label={`Reactivar ${discipline.name}`}
                    onClick={() => onReactivate(discipline)}
                  >
                    Reactivar
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
