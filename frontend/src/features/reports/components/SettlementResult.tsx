import { formatPeriod, formatPesos } from '../../pricing/utils/pricing-format';
import type { DisciplineSettlement } from '../types/report';

/** Presentational: who paid a discipline's fee for a month and what that fee came to. No DNI, by the club's decision. */
export function SettlementResult({ report }: { report: DisciplineSettlement }) {
  const month = formatPeriod(report.period);
  return (
    <section className="report-result report-sheet" aria-label="Resultado de liquidación">
      <h2>Liquidación de {report.discipline.name}</h2>
      <p className="report-result__range">{report.discipline.name}, {month}</p>

      {report.students.length === 0 ? (
        <p className="members-page__notice">Ningún socio pagó la cuota de esta disciplina en el mes elegido.</p>
      ) : (
        <table className="members-table">
          <caption className="visually-hidden">Socios de {report.discipline.name} con la cuota de {month} paga</caption>
          <thead>
            <tr className="table-head"><th scope="col">Nombre</th><th scope="col">N° de socio</th><th scope="col">Mes</th></tr>
          </thead>
          <tbody>
            {report.students.map((student) => (
              <tr key={student.memberNumber}>
                <td><span className="members-table__name">{student.fullName}</span></td>
                <td className="members-table__number">{student.memberNumber}</td>
                <td className="members-table__mono">{formatPeriod(student.period)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="report-result__total">
        <span>Cuotas de la disciplina</span> <strong data-testid="settlement-fees">{formatPesos(report.feeTotal)}</strong>
      </p>
      <p className="report-result__total">
        <span>Recargos por pago tardío (aparte)</span> <strong data-testid="settlement-surcharges">{formatPesos(report.surchargeTotal)}</strong>
      </p>
    </section>
  );
}
