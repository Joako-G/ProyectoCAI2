import { formatIsoDate } from '../../members/utils/member-format';
import type { DisciplineRoster } from '../types/roster';

const STATUS_LABEL = { active: 'Activo', ended: 'Dejó' } as const;

/** Presentational: one discipline with its current and past students. */
export function RosterBlock({ roster: { discipline, students } }: { roster: DisciplineRoster }) {
  return (
    <section className="roster-block" aria-labelledby={`roster-${discipline.id}`}>
      <h2 id={`roster-${discipline.id}`} className="roster-block__title">{discipline.name}</h2>
      {students.length === 0 ? (
        <p className="members-page__notice">Esta disciplina todavía no tiene alumnos.</p>
      ) : (
        <table className="members-table">
          <caption className="visually-hidden">Alumnos de {discipline.name}</caption>
          <thead>
            <tr className="table-head">
              <th scope="col">Nombre</th>
              <th scope="col">N° de socio</th>
              <th scope="col">Desde</th>
              <th scope="col">Hasta</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={`${student.memberId}-${student.startDate}`}>
                <td><span className="members-table__name">{student.fullName}</span></td>
                <td className="members-table__number">{student.memberNumber}</td>
                <td className="members-table__mono">{formatIsoDate(student.startDate)}</td>
                <td className="members-table__mono">{student.endDate ? formatIsoDate(student.endDate) : '—'}</td>
                <td>
                  <span className={`status-chip status-chip--${student.status === 'active' ? 'active' : 'inactive'}`}>
                    {STATUS_LABEL[student.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
